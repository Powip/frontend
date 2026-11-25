import {
  isDniDoc,
  isPersonaNaturalError,
  isRucDoc,
  needsDniForDeclaracion,
} from '../shalomPersonaNaturalFix';

describe('shalomPersonaNaturalFix', () => {
  it('reconoce el error de Shalom con o sin tilde y con prefijo', () => {
    expect(isPersonaNaturalError('Error en Shalom API: La declaración jurada solo es para persona natural')).toBe(true);
    expect(isPersonaNaturalError('LA DECLARACION JURADA SOLO ES PARA PERSONA NATURAL')).toBe(true);
    expect(isPersonaNaturalError('Confirma y prepara el pedido antes de despacharlo.')).toBe(false);
    expect(isPersonaNaturalError(undefined)).toBe(false);
  });

  it('distingue RUC (11) de DNI (8)', () => {
    expect(isRucDoc('20123456789')).toBe(true);
    expect(isRucDoc('12345678')).toBe(false);
    expect(isDniDoc('12345678')).toBe(true);
    expect(isDniDoc('1234567')).toBe(false);
  });

  it('solo pide DNI con RUC + declaración jurada + ese error', () => {
    const error = 'La declaración jurada solo es para persona natural';
    expect(needsDniForDeclaracion({ error, recipientDoc: '20123456789', declaracionJurada: 'Ropa' })).toBe(true);
    expect(needsDniForDeclaracion({ error, recipientDoc: '20123456789', declaracionJurada: '' })).toBe(false);
    expect(needsDniForDeclaracion({ error, recipientDoc: '12345678', declaracionJurada: 'Ropa' })).toBe(false);
    expect(needsDniForDeclaracion({ error: 'Otro error', recipientDoc: '20123456789', declaracionJurada: 'Ropa' })).toBe(false);
  });
});
