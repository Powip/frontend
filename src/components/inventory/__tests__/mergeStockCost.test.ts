import {
  formatMoney,
  parseCountedQuantity,
  parsePriceBase,
  resolveMergeCost,
  totalReserved,
  validateMergeStock,
  type MergeStockSides,
} from '../mergeStockCost';

const sides: MergeStockSides = {
  winnerQuantity: 10,
  winnerReserved: 2,
  loserQuantity: 5,
  loserReserved: 1,
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
    const big = { winnerQuantity: 6_000, winnerReserved: 0, loserQuantity: 5_000, loserReserved: 0 };
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
