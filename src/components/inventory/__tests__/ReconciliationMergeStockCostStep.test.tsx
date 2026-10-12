import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { ReconciliationMergeStockCostStep } from '../ReconciliationMergeStockCostStep';
import {
  resolveMergeCost,
  validateMergeStock,
  type MergeCostChoice,
  type MergeStockSides,
} from '../mergeStockCost';
import type { MergeStockMode } from '@/services/reconciliationTask.service';

const SIDES: MergeStockSides = { winnerQuantity: 10, winnerReserved: 2, loserQuantity: 5, loserReserved: 1 };

function Harness(props: { winnerCost?: number; loserCost?: number; showShopifyNotice?: boolean }) {
  const [stockMode, setStockMode] = useState<MergeStockMode | null>(null);
  const [countedRaw, setCountedRaw] = useState('');
  const [costChoice, setCostChoice] = useState<MergeCostChoice>('winner');
  const [customCostRaw, setCustomCostRaw] = useState('');
  const winnerCost = props.winnerCost ?? 30;
  const loserCost = props.loserCost ?? 20;
  return (
    <ReconciliationMergeStockCostStep
      sides={SIDES}
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
      stockValidation={validateMergeStock(stockMode, SIDES, countedRaw)}
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
      'Este producto se sincroniza periódicamente con Shopify. Si cambia el stock o el precio allá, se va a actualizar acá: ajustalo en Shopify. También podés cambiarlo de forma manual en Powip.';
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
});
