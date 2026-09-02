import {
  normalizeCourier,
  isShalomCourier,
  isAliclikCourier,
  isEvaCourier,
} from '../courierNormalizer';

describe('normalizeCourier', () => {
  it('normaliza "aliclik" a "Aliclik"', () => {
    expect(normalizeCourier('aliclik')).toBe('Aliclik');
  });

  it('normaliza "ALICLIK" a "Aliclik" (case-insensitive)', () => {
    expect(normalizeCourier('ALICLIK')).toBe('Aliclik');
  });

  it('normaliza "shalom" a "Shalom"', () => {
    expect(normalizeCourier('shalom')).toBe('Shalom');
  });

  it('normaliza "motorizado propio" a "Motorizado Propio"', () => {
    expect(normalizeCourier('motorizado propio')).toBe('Motorizado Propio');
  });

  it('devuelve null si el courier es undefined', () => {
    expect(normalizeCourier(undefined)).toBeNull();
  });

  it('devuelve null si el courier es null', () => {
    expect(normalizeCourier(null)).toBeNull();
  });

  it('devuelve null si el courier es string vacío', () => {
    expect(normalizeCourier('')).toBeNull();
  });

  it('devuelve el valor original si no tiene mapeo definido', () => {
    expect(normalizeCourier('OtraCourier')).toBe('OtraCourier');
  });
});

describe('isAliclikCourier', () => {
  it('devuelve true para "aliclik" en minúsculas', () => {
    expect(isAliclikCourier('aliclik')).toBe(true);
  });

  it('devuelve true para "ALICLIK" en mayúsculas', () => {
    expect(isAliclikCourier('ALICLIK')).toBe(true);
  });

  it('devuelve true para "Aliclik" con mayúscula inicial', () => {
    expect(isAliclikCourier('Aliclik')).toBe(true);
  });

  it('devuelve false para "Shalom"', () => {
    expect(isAliclikCourier('Shalom')).toBe(false);
  });

  it('devuelve false para undefined', () => {
    expect(isAliclikCourier(undefined)).toBe(false);
  });

  it('devuelve false para null', () => {
    expect(isAliclikCourier(null)).toBe(false);
  });

  it('devuelve false para string vacío', () => {
    expect(isAliclikCourier('')).toBe(false);
  });
});

describe('isShalomCourier', () => {
  it('devuelve true para "shalom" en minúsculas', () => {
    expect(isShalomCourier('shalom')).toBe(true);
  });

  it('devuelve true para "SHALOM" en mayúsculas', () => {
    expect(isShalomCourier('SHALOM')).toBe(true);
  });

  it('devuelve false para "aliclik"', () => {
    expect(isShalomCourier('aliclik')).toBe(false);
  });

  it('devuelve false para undefined', () => {
    expect(isShalomCourier(undefined)).toBe(false);
  });

  it('devuelve false para null', () => {
    expect(isShalomCourier(null)).toBe(false);
  });
});

describe('isEvaCourier', () => {
  // Las 7 grafías reales de la tabla couriers.couriers + variantes de caso y
  // espacios. El botón "Enviar a EVA" se muestra si y sólo si esto da true.
  it.each([
    'eva',
    'EVA',
    'Eva',
    'eva courier',
    'EVA COURIER',
    'Eva Courier',
    'EVA COURRIER',
    'Eva Currier',
    'EVA COURIER ',
    '  eva  ',
  ])('devuelve true para %p', (input) => {
    expect(isEvaCourier(input)).toBe(true);
  });

  // Nombres genéricos o que sólo contienen "eva" como subcadena → false.
  it.each([
    'Shalom',
    'Olva Courier',
    'Nicolás',
    'nueva agencia',
    'Evaristo',
    '',
  ])('devuelve false para %p', (input) => {
    expect(isEvaCourier(input)).toBe(false);
  });

  it('devuelve false para undefined', () => {
    expect(isEvaCourier(undefined)).toBe(false);
  });

  it('devuelve false para null', () => {
    expect(isEvaCourier(null)).toBe(false);
  });
});
