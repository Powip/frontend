/**
 * Tests: matchesCcSearch — criterios del buscador de Gestión COD
 * (mismos que Comercial → Ventas: nombre, teléfono y N° de orden).
 */
import { matchesCcSearch, resolvePowipStoreName } from '../ccPedidoFields';
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

/**
 * resolvePowipStoreName — la columna «Tienda» de CC debe decir de QUÉ TIENDA DE POWIP es el pedido
 * (AMA GREEN tiene 2 tiendas con la misma marca: el vendor de Shopify no las distingue).
 */
describe('resolvePowipStoreName', () => {
  const stores = [
    { id: 'f6ea8d24-3d0c-419b-968d-b8851c71b6c7', name: 'AMAGREEN' },
    { id: '2cb0a83e-7068-44b7-ab76-47318388adc6', name: 'AMAGREEN MINORISTA' },
  ];
  const deTienda = (storeId: string) => ({ storeId }) as unknown as OrderHeader;

  it('devuelve el nombre de la tienda de Powip del pedido cuando la empresa tiene 2 o más tiendas', () => {
    expect(resolvePowipStoreName(deTienda('2cb0a83e-7068-44b7-ab76-47318388adc6'), stores)).toBe('AMAGREEN MINORISTA');
    expect(resolvePowipStoreName(deTienda('f6ea8d24-3d0c-419b-968d-b8851c71b6c7'), stores)).toBe('AMAGREEN');
  });

  it('compara los ids sin distinguir mayúsculas', () => {
    expect(resolvePowipStoreName(deTienda('2CB0A83E-7068-44B7-AB76-47318388ADC6'), stores)).toBe('AMAGREEN MINORISTA');
  });

  it('con una sola tienda (o ninguna) no aporta nada: sería el mismo texto en todas las filas', () => {
    expect(resolvePowipStoreName(deTienda(stores[0].id), [stores[0]])).toBeNull();
    expect(resolvePowipStoreName(deTienda(stores[0].id), [])).toBeNull();
    expect(resolvePowipStoreName(deTienda(stores[0].id), undefined)).toBeNull();
    expect(resolvePowipStoreName(deTienda(stores[0].id), null)).toBeNull();
  });

  it('si la tienda del pedido no está entre las de la empresa devuelve null', () => {
    expect(resolvePowipStoreName(deTienda('00000000-0000-4000-8000-000000000000'), stores)).toBeNull();
  });

  it('ignora nombres vacíos', () => {
    const sinNombre = [{ id: 'a', name: '  ' }, { id: 'b', name: 'Otra' }];
    expect(resolvePowipStoreName(deTienda('a'), sinNombre)).toBeNull();
  });
});
