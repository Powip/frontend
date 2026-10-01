/**
 * Tests: matchesCcSearch — criterios del buscador de Gestión COD
 * (mismos que Comercial → Ventas: nombre, teléfono y N° de orden).
 */
import { matchesCcSearch } from '../ccPedidoFields';
import { OrderHeader } from '@/interfaces/IOrder';

const order = {
  id: '1',
  orderNumber: 'ORD-0042',
  customer: { fullName: 'María López', phoneNumber: '999 111 222' },
} as unknown as OrderHeader;

describe('matchesCcSearch', () => {
  it.each([
    ['maría', true],
    ['LÓPEZ', true],
    ['999 111', true],
    ['999111222', true], // ignora espacios del teléfono guardado
    ['ord-0042', true],
    ['pedro', false],
    ['123', false],
  ])('"%s" → %s', (term, expected) => {
    expect(matchesCcSearch(order, term)).toBe(expected);
  });

  it('búsqueda vacía o solo espacios no filtra', () => {
    expect(matchesCcSearch(order, '')).toBe(true);
    expect(matchesCcSearch(order, '   ')).toBe(true);
  });

  it('tolera pedidos sin cliente', () => {
    const sinCliente = { id: '2', orderNumber: 'X', customer: null } as unknown as OrderHeader;
    expect(matchesCcSearch(sinCliente, 'juan')).toBe(false);
  });
});
