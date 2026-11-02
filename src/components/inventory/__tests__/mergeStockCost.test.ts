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
  type MergeWarehouseRow,
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

  describe('tope de 10.000 por fila (FEAT-24 H1-A, revisión final R1)', () => {
    const TOPE = 'El resultado supera el máximo de 10,000 unidades por variante y almacén.';
    const row = (
      inventoryId: string,
      winnerQuantity: number,
      loserQuantity: number,
    ): MergeWarehouseRow => ({
      inventoryName: inventoryId,
      inventoryId,
      winnerQuantity,
      winnerReserved: 0,
      loserQuantity,
      loserReserved: 0,
    });

    it('6.000 en A y 6.000 en B de la madre: "winner" y "sum" son válidos aunque el agregado pase de 10.000', () => {
      const rows = [row('inv-a', 6_000, 2_000), row('inv-b', 6_000, 2_000)];
      const multi: MergeStockSides = {
        winnerQuantity: 12_000,
        winnerReserved: 0,
        loserQuantity: 4_000,
        loserReserved: 0,
        warehouseCount: 2,
      };
      expect(validateMergeStock('winner', multi, '', rows)).toEqual({ finalQuantity: 12_000, error: null });
      expect(validateMergeStock('sum', multi, '', rows)).toEqual({ finalQuantity: 16_000, error: null });
    });

    it('6.000 + 5.000 en el MISMO almacén sigue siendo error', () => {
      const rows = [row('inv-a', 6_000, 5_000)];
      const single: MergeStockSides = {
        winnerQuantity: 6_000,
        winnerReserved: 0,
        loserQuantity: 5_000,
        loserReserved: 0,
        warehouseCount: 1,
      };
      expect(validateMergeStock('sum', single, '', rows)).toEqual({ finalQuantity: 11_000, error: TOPE });
      // varios almacenes, pero la suma de UNA fila pasa del tope
      const multi: MergeStockSides = {
        winnerQuantity: 6_100,
        winnerReserved: 0,
        loserQuantity: 5_000,
        loserReserved: 0,
        warehouseCount: 2,
      };
      const multiRows = [row('inv-a', 6_000, 5_000), row('inv-b', 100, 0)];
      expect(validateMergeStock('sum', multi, '', multiRows).error).toBe(TOPE);
      expect(validateMergeStock('winner', multi, '', multiRows).error).toBeNull();
    });

    it('una fila de 10.001 con varios almacenes es error', () => {
      const multi: MergeStockSides = {
        winnerQuantity: 10_006,
        winnerReserved: 0,
        loserQuantity: 0,
        loserReserved: 0,
        warehouseCount: 2,
      };
      const rows = [row('inv-a', 10_001, 0), row('inv-b', 5, 0)];
      expect(validateMergeStock('winner', multi, '', rows)).toEqual({ finalQuantity: 10_006, error: TOPE });
    });

    it('con varios almacenes pero sin filas falla cerrado: usa el agregado', () => {
      const multi: MergeStockSides = {
        winnerQuantity: 12_000,
        winnerReserved: 0,
        loserQuantity: 0,
        loserReserved: 0,
        warehouseCount: 2,
      };
      expect(validateMergeStock('winner', multi, '').error).toBe(TOPE);
      expect(validateMergeStock('winner', multi, '', []).error).toBe(TOPE);
    });

    it('con un solo almacén se compara el agregado, igual que antes (aunque lleguen filas)', () => {
      const single: MergeStockSides = {
        winnerQuantity: 6_000,
        winnerReserved: 0,
        loserQuantity: 5_000,
        loserReserved: 0,
        warehouseCount: 1,
      };
      expect(validateMergeStock('sum', single, '', [row('inv-a', 6_000, 5_000)]).error).toBe(TOPE);
      expect(validateMergeStock('sum', single, '').error).toBe(TOPE);
    });

    it('el piso de reservas sigue siendo agregado', () => {
      const multi: MergeStockSides = {
        winnerQuantity: 6,
        winnerReserved: 4,
        loserQuantity: 0,
        loserReserved: 4,
        warehouseCount: 2,
      };
      const rows = [row('inv-a', 3, 0), row('inv-b', 3, 0)];
      expect(validateMergeStock('winner', multi, '', rows).error).toBe(
        'Hay 8 unidades reservadas en pedidos; la cantidad no puede ser menor',
      );
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

    // Revisión final R3: ms-logistics toma como candidatas a conteo las filas de
    // la madre (o las de la otra variante si la madre no tiene) cuando no hay stock.
    it('sin stock en ningún lado devuelve las filas 0/0 de la madre', () => {
      const rows = buildMergeWarehouses(
        makeStock('w', [
          ['inv-1', 'Lima', 0, 0],
          ['inv-2', 'Arequipa', 0, 0],
        ]),
        makeStock('l', [['inv-3', 'Cusco', 0, 0]]),
      );
      expect(rows).toEqual([
        { inventoryId: 'inv-1', inventoryName: 'Lima', winnerQuantity: 0, winnerReserved: 0, loserQuantity: 0, loserReserved: 0 },
        { inventoryId: 'inv-2', inventoryName: 'Arequipa', winnerQuantity: 0, winnerReserved: 0, loserQuantity: 0, loserReserved: 0 },
      ]);
    });

    it('sin stock y con la madre sin filas devuelve las filas 0/0 de la otra variante', () => {
      const rows = buildMergeWarehouses(
        makeStock('w', []),
        makeStock('l', [
          ['inv-3', 'Cusco', 0, 0],
          ['inv-4', 'Piura', 0, 0],
        ]),
      );
      expect(rows.map((row) => row.inventoryId)).toEqual(['inv-3', 'inv-4']);
      expect(buildMergeWarehouses(undefined, makeStock('l', [['inv-3', 'Cusco', 0, 0]])).map((row) => row.inventoryId)).toEqual(['inv-3']);
    });

    it('sin stock no duplica un inventory_id repetido en las filas de la madre', () => {
      const rows = buildMergeWarehouses(
        makeStock('w', [
          ['inv-1', 'Lima', 0, 0],
          ['inv-1', 'Lima', 0, 0],
        ]),
        makeStock('l', [['inv-1', 'Lima', 0, 0]]),
      );
      expect(rows.map((row) => row.inventoryId)).toEqual(['inv-1']);
    });

    it('con stock en alguna fila no se agregan las filas 0/0 (regla de siempre)', () => {
      const rows = buildMergeWarehouses(
        makeStock('w', [
          ['inv-1', 'Lima', 5, 0],
          ['inv-2', 'Arequipa', 0, 0],
        ]),
        makeStock('l', []),
      );
      expect(rows.map((row) => row.inventoryId)).toEqual(['inv-1']);
    });

    it('countAllowed sobre las filas 0/0 de varios almacenes de la madre es falso', () => {
      const rows = buildMergeWarehouses(
        makeStock('w', [
          ['inv-1', 'Lima', 0, 0],
          ['inv-2', 'Arequipa', 0, 0],
        ]),
        makeStock('l', []),
      );
      expect(countAllowed({ ...sides, warehouseCount: rows.length })).toBe(false);
    });
  });
});
