import {
  buildMergeWarehouses,
  countAllowed,
  COUNT_MULTI_WAREHOUSE_MESSAGE,
  formatMoney,
  parseCountedQuantity,
  parsePriceBase,
  resolveMergeCost,
  totalReserved,
  validateMergeStock,
  type MergeStockSides,
} from '../mergeStockCost';
import type { VariantStock } from '@/services/inventoryItems.service';

const sides: MergeStockSides = {
  winnerQuantity: 10,
  winnerReserved: 2,
  loserQuantity: 5,
  loserReserved: 1,
  warehouseCount: 1,
};

describe('mergeStockCost', () => {
  it('totalReserved suma las reservas de ambos lados', () => {
    expect(totalReserved(sides)).toBe(3);
  });

  it('sin modo elegido no hay cantidad ni error', () => {
    expect(validateMergeStock(null, sides, '')).toEqual({ finalQuantity: null, error: null });
  });

  it('winner = cantidad de la madre; sum = suma', () => {
    expect(validateMergeStock('winner', sides, '')).toEqual({ finalQuantity: 10, error: null });
    expect(validateMergeStock('sum', sides, '')).toEqual({ finalQuantity: 15, error: null });
  });

  it('count usa lo ingresado; vacío no es error todavía', () => {
    expect(validateMergeStock('count', sides, '12')).toEqual({ finalQuantity: 12, error: null });
    expect(validateMergeStock('count', sides, '')).toEqual({ finalQuantity: null, error: null });
  });

  it('count inválido muestra error de formato', () => {
    expect(validateMergeStock('count', sides, '-1').error).toBe(
      'Ingresa un número entero entre 0 y 10,000',
    );
    expect(validateMergeStock('count', sides, '2.5').finalQuantity).toBeNull();
  });

  it('un resultado mayor que 10.000 es error en cualquier modo (FEAT-24 H0)', () => {
    const big = { winnerQuantity: 6_000, winnerReserved: 0, loserQuantity: 5_000, loserReserved: 0, warehouseCount: 1 };
    const message = 'El resultado supera el máximo de 10,000 unidades por variante y almacén.';
    expect(validateMergeStock('sum', big, '')).toEqual({ finalQuantity: 11_000, error: message });
    expect(validateMergeStock('winner', { ...big, winnerQuantity: 10_001 }, '').error).toBe(message);
    expect(validateMergeStock('count', big, '10000').error).toBeNull();
    expect(validateMergeStock('count', big, '10001').error).toBe('Ingresa un número entero entre 0 y 10,000');
  });

  it('cantidad final menor que las reservas totales es error', () => {
    expect(validateMergeStock('count', sides, '2')).toEqual({
      finalQuantity: 2,
      error: 'Hay 3 unidades reservadas en pedidos; la cantidad no puede ser menor',
    });
    expect(
      validateMergeStock('winner', { ...sides, winnerQuantity: 2 }, '').error,
    ).toBe('Hay 3 unidades reservadas en pedidos; la cantidad no puede ser menor');
    expect(validateMergeStock('count', sides, '3').error).toBeNull();
  });

  it('parseCountedQuantity acepta enteros 0..10.000 (FEAT-24 H0)', () => {
    expect(parseCountedQuantity('0')).toBe(0);
    expect(parseCountedQuantity(' 42 ')).toBe(42);
    expect(parseCountedQuantity('10000')).toBe(10_000);
    expect(parseCountedQuantity('10001')).toBeNull();
    expect(parseCountedQuantity('abc')).toBeNull();
  });

  it('parsePriceBase acepta hasta 2 decimales, con punto o coma', () => {
    expect(parsePriceBase('25.5')).toBe(25.5);
    expect(parsePriceBase('25,50')).toBe(25.5);
    expect(parsePriceBase('0')).toBe(0);
    expect(parsePriceBase('25.555')).toBeNull();
    expect(parsePriceBase('-1')).toBeNull();
    expect(parsePriceBase('100000000')).toBeNull();
  });

  it('resolveMergeCost según la elección', () => {
    expect(resolveMergeCost('winner', 30, 20, '')).toEqual({ value: 30, error: null });
    expect(resolveMergeCost('loser', 30, 20, '')).toEqual({ value: 20, error: null });
    expect(resolveMergeCost('custom', 30, 20, '25,5')).toEqual({ value: 25.5, error: null });
    expect(resolveMergeCost('custom', 30, 20, '')).toEqual({ value: null, error: null });
    expect(resolveMergeCost('custom', 30, 20, 'x').error).toBe(
      'Ingresa un costo válido (número ≥ 0, hasta 2 decimales)',
    );
  });

  it('formatMoney formatea en soles y cae a S/ 0.00', () => {
    expect(formatMoney(20)).toContain('20.00');
    expect(formatMoney(null)).toBe('S/ 0.00');
  });
});

// FEAT-24 H1-A (Task 21): "Conteo físico" solo con stock en como máximo un almacén.
function makeStock(
  variantId: string,
  inventories: Array<[string, string, number, number]>,
): VariantStock {
  return {
    variant_id: variantId,
    quantity: inventories.reduce((sum, row) => sum + row[2], 0),
    reserved_quantity: inventories.reduce((sum, row) => sum + row[3], 0),
    available: 0,
    inventories: inventories.map(([inventory_id, inventory_name, quantity, reserved_quantity]) => ({
      inventory_id,
      inventory_name,
      store_id: null,
      quantity,
      reserved_quantity,
    })),
  };
}

describe('conteo físico y almacenes (FEAT-24 H1-A)', () => {
  it('countAllowed es verdadero con 0 o 1 almacén con stock y falso con 2 o más', () => {
    expect(countAllowed({ ...sides, warehouseCount: 0 })).toBe(true);
    expect(countAllowed({ ...sides, warehouseCount: 1 })).toBe(true);
    expect(countAllowed({ ...sides, warehouseCount: 2 })).toBe(false);
    expect(countAllowed({ ...sides, warehouseCount: 3 })).toBe(false);
  });

  it('validateMergeStock con count y más de un almacén es inválido, con el mensaje de la UI', () => {
    const multi = { ...sides, warehouseCount: 2 };
    expect(validateMergeStock('count', multi, '12')).toEqual({
      finalQuantity: null,
      error: COUNT_MULTI_WAREHOUSE_MESSAGE,
    });
    expect(validateMergeStock('count', multi, '').error).toBe(COUNT_MULTI_WAREHOUSE_MESSAGE);
    expect(COUNT_MULTI_WAREHOUSE_MESSAGE).toBe(
      'El stock está en varios almacenes: se aplica en cada uno. Para contar, ajusta el stock de cada almacén después.',
    );
  });

  it('con más de un almacén, "winner" y "sum" siguen siendo válidos', () => {
    const multi = { ...sides, warehouseCount: 2 };
    expect(validateMergeStock('winner', multi, '')).toEqual({ finalQuantity: 10, error: null });
    expect(validateMergeStock('sum', multi, '')).toEqual({ finalQuantity: 15, error: null });
  });

  it('con un almacén, count sigue validando como antes', () => {
    expect(validateMergeStock('count', { ...sides, warehouseCount: 1 }, '12')).toEqual({
      finalQuantity: 12,
      error: null,
    });
  });

  describe('buildMergeWarehouses', () => {
    it('sin variantes o sin filas de almacén no hay almacenes con stock', () => {
      expect(buildMergeWarehouses(undefined, undefined)).toEqual([]);
      expect(buildMergeWarehouses(makeStock('w', []), makeStock('l', []))).toEqual([]);
    });

    it('el mismo almacén en las dos variantes cuenta una sola vez', () => {
      const rows = buildMergeWarehouses(
        makeStock('w', [['inv-1', 'Lima', 7, 1]]),
        makeStock('l', [['inv-1', 'Lima', 3, 0]]),
      );
      expect(rows).toEqual([
        {
          inventoryId: 'inv-1',
          inventoryName: 'Lima',
          winnerQuantity: 7,
          winnerReserved: 1,
          loserQuantity: 3,
          loserReserved: 0,
        },
      ]);
    });

    it('dos almacenes distintos entre ganadora y perdedora cuentan dos', () => {
      const rows = buildMergeWarehouses(
        makeStock('w', [['inv-1', 'Lima', 7, 0]]),
        makeStock('l', [['inv-2', 'Arequipa', 0, 2]]),
      );
      expect(rows.map((row) => row.inventoryId)).toEqual(['inv-1', 'inv-2']);
      expect(rows[1]).toEqual({
        inventoryId: 'inv-2',
        inventoryName: 'Arequipa',
        winnerQuantity: 0,
        winnerReserved: 0,
        loserQuantity: 0,
        loserReserved: 2,
      });
    });

    it('las filas en 0/0 no cuentan, pero una con solo reservas o con cantidad negativa sí', () => {
      const rows = buildMergeWarehouses(
        makeStock('w', [
          ['inv-1', 'Lima', 5, 0],
          ['inv-2', 'Arequipa', 0, 0],
        ]),
        makeStock('l', [
          ['inv-3', 'Cusco', 0, 1],
          ['inv-4', 'Piura', -2, 0],
          ['inv-5', 'Tacna', 0, 0],
        ]),
      );
      expect(rows.map((row) => row.inventoryId)).toEqual(['inv-1', 'inv-3', 'inv-4']);
    });
  });
});
