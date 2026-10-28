import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { ReconciliationMergeStockCostStep } from '../ReconciliationMergeStockCostStep';
import {
  resolveMergeCost,
  validateMergeStock,
  type MergeCostChoice,
  type MergeStockSides,
  type MergeWarehouseRow,
} from '../mergeStockCost';
import type { MergeStockMode } from '@/services/reconciliationTask.service';

const SIDES: MergeStockSides = {
  winnerQuantity: 10,
  winnerReserved: 2,
  loserQuantity: 5,
  loserReserved: 1,
  warehouseCount: 1,
};

// FEAT-24 H1-A (Task 21): stock repartido en dos almacenes.
const MULTI_SIDES: MergeStockSides = { ...SIDES, warehouseCount: 2 };
const MULTI_ROWS: MergeWarehouseRow[] = [
  {
    inventoryId: 'inv-1',
    inventoryName: 'Almacén Lima',
    winnerQuantity: 7,
    winnerReserved: 2,
    loserQuantity: 1,
    loserReserved: 0,
  },
  {
    inventoryId: 'inv-2',
    inventoryName: 'Almacén Arequipa',
    winnerQuantity: 3,
    winnerReserved: 0,
    loserQuantity: 4,
    loserReserved: 1,
  },
];
const MULTI_WAREHOUSE_TEXT =
  'El stock está en varios almacenes: se aplica en cada uno. Para contar, ajusta el stock de cada almacén después.';

function Harness(props: {
  winnerCost?: number;
  loserCost?: number;
  showShopifyNotice?: boolean;
  sides?: MergeStockSides;
  warehouseRows?: MergeWarehouseRow[];
}) {
  const sides = props.sides ?? SIDES;
  const [stockMode, setStockMode] = useState<MergeStockMode | null>(null);
  const [countedRaw, setCountedRaw] = useState('');
  const [costChoice, setCostChoice] = useState<MergeCostChoice>('winner');
  const [customCostRaw, setCustomCostRaw] = useState('');
  const winnerCost = props.winnerCost ?? 30;
  const loserCost = props.loserCost ?? 20;
  return (
    <ReconciliationMergeStockCostStep
      sides={sides}
      warehouseRows={props.warehouseRows}
      winnerCost={winnerCost}
      loserCost={loserCost}
      showShopifyNotice={props.showShopifyNotice ?? false}
      stockMode={stockMode}
      onStockModeChange={setStockMode}
      countedRaw={countedRaw}
      onCountedRawChange={setCountedRaw}
      costChoice={costChoice}
      onCostChoiceChange={setCostChoice}
      customCostRaw={customCostRaw}
      onCustomCostRawChange={setCustomCostRaw}
      stockValidation={validateMergeStock(stockMode, sides, countedRaw)}
      cost={resolveMergeCost(costChoice, winnerCost, loserCost, customCostRaw)}
      disabled={false}
    />
  );
}

describe('ReconciliationMergeStockCostStep', () => {
  it('ninguna opción de stock viene marcada y muestra las reservas que pasan', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: /usar stock de la madre/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /sumar ambos/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /conteo físico/i })).not.toBeChecked();
    expect(screen.getByText(/reservas que pasan a la madre: 1/i)).toBeInTheDocument();
  });

  it('cada opción muestra la cantidad resultante', () => {
    render(<Harness />);
    expect(screen.getByText(/usar stock de la madre \(10\)/i)).toBeInTheDocument();
    expect(screen.getByText(/sumar ambos \(15\)/i)).toBeInTheDocument();
  });

  it('conteo físico muestra el campo y el error si queda por debajo de las reservas', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: /conteo físico/i }));
    await user.type(screen.getByLabelText(/cantidad contada/i), '2');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Hay 3 unidades reservadas en pedidos; la cantidad no puede ser menor',
    );
  });

  it('costo: la madre viene marcada; "Otro valor" muestra el campo', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('radio', { name: /costo de la madre/i })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /otro valor/i }));
    expect(screen.getByLabelText(/nuevo costo/i)).toBeInTheDocument();
  });

  it('con el mismo costo en ambas no ofrece elegir', () => {
    render(<Harness winnerCost={25} loserCost={25} />);
    expect(screen.queryByRole('radio', { name: /costo de la madre/i })).not.toBeInTheDocument();
    expect(screen.getByText(/igual en las dos/i)).toBeInTheDocument();
  });

  it('aviso Shopify solo cuando corresponde, con el texto exacto', () => {
    const text =
      'Este producto se sincroniza periódicamente con Shopify. Si cambia el stock o el precio allá, se va a actualizar acá: ajústalo en Shopify. También puedes cambiarlo de forma manual en Powip.';
    const { rerender } = render(<Harness showShopifyNotice />);
    expect(screen.getByText(text)).toBeInTheDocument();
    rerender(<Harness showShopifyNotice={false} />);
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  });

  it('resumen con stock antes → después, reservado y costo', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: /sumar ambos/i }));
    expect(screen.getByTestId('merge-summary')).toHaveTextContent(/stock 10 → 15 · reservado 3 · costo s\/\s?30\.00/i);
  });

  describe('almacenes (FEAT-24 H1-A, Task 21)', () => {
    it('con un solo almacén ofrece las tres opciones y no muestra el aviso de varios almacenes', () => {
      render(<Harness sides={{ ...SIDES, warehouseCount: 1 }} />);
      expect(screen.getByRole('radio', { name: /usar stock de la madre/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /sumar ambos/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /conteo físico/i })).toBeInTheDocument();
      expect(screen.queryByText(MULTI_WAREHOUSE_TEXT)).not.toBeInTheDocument();
      expect(screen.queryByRole('table', { name: /stock por almacén/i })).not.toBeInTheDocument();
    });

    it('sin ningún almacén con stock también ofrece el conteo físico', () => {
      render(<Harness sides={{ ...SIDES, warehouseCount: 0 }} />);
      expect(screen.getByRole('radio', { name: /conteo físico/i })).toBeInTheDocument();
    });

    it('con dos almacenes solo ofrece "Usar stock de la madre" y "Sumar ambos"', () => {
      render(<Harness sides={MULTI_SIDES} warehouseRows={MULTI_ROWS} />);
      expect(screen.getByRole('radio', { name: /usar stock de la madre/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /sumar ambos/i })).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: /conteo físico/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/cantidad contada/i)).not.toBeInTheDocument();
    });

    it('con dos almacenes muestra el texto exacto y el desglose por almacén de la madre y la otra variante', () => {
      render(<Harness sides={MULTI_SIDES} warehouseRows={MULTI_ROWS} />);
      expect(screen.getByText(MULTI_WAREHOUSE_TEXT)).toBeInTheDocument();

      const table = screen.getByRole('table', { name: /stock por almacén/i });
      const lima = within(table).getByRole('row', { name: /almacén lima/i });
      expect(within(lima).getByRole('cell', { name: /7 físico · 2 reservado/i })).toBeInTheDocument();
      expect(within(lima).getByRole('cell', { name: /1 físico · 0 reservado/i })).toBeInTheDocument();
      const arequipa = within(table).getByRole('row', { name: /almacén arequipa/i });
      expect(within(arequipa).getByRole('cell', { name: /3 físico · 0 reservado/i })).toBeInTheDocument();
      expect(within(arequipa).getByRole('cell', { name: /4 físico · 1 reservado/i })).toBeInTheDocument();
      expect(within(table).getByRole('columnheader', { name: /madre/i })).toBeInTheDocument();
      expect(within(table).getByRole('columnheader', { name: /otra variante/i })).toBeInTheDocument();
    });

    it('con dos almacenes "Sumar ambos" se puede elegir y no da error', async () => {
      const user = userEvent.setup();
      render(<Harness sides={MULTI_SIDES} warehouseRows={MULTI_ROWS} />);
      await user.click(screen.getByRole('radio', { name: /sumar ambos/i }));
      expect(screen.getByRole('radio', { name: /sumar ambos/i })).toBeChecked();
      expect(screen.getByTestId('merge-summary')).toHaveTextContent(/stock 10 → 15/i);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
