import { resolveGuideOrigin } from '../guideOrigin';

const companyStores = ['web', 'livii', 'warehouse'];

describe('shipping guides belong to one business, not one commercial store', () => {
  it('uses an order store as the operational owner without substituting the warehouse', () => {
    expect(resolveGuideOrigin([{ storeId: 'web', inventoryId: 'shared-inventory', stockStoreId: 'warehouse' }], companyStores)).toEqual({ storeId: 'web', error: null });
  });

  it('accepts different commercial stores and warehouses in one guide', () => {
    const orders = [
      { storeId: 'web', inventoryId: 'one', stockStoreId: 'warehouse' },
      { storeId: 'livii', inventoryId: 'two', stockStoreId: 'livii' },
    ];
    const original = orders.map((order) => ({ ...order }));
    expect(resolveGuideOrigin(orders, companyStores)).toEqual({ storeId: 'web', error: null });
    expect(orders).toEqual(original);
  });

  it('accepts legacy orders without warehouse metadata', () => {
    expect(resolveGuideOrigin([{ storeId: 'web' }, { storeId: 'livii' }], companyStores)).toEqual({ storeId: 'web', error: null });
  });

  it('rejects a store belonging to another business', () => {
    expect(resolveGuideOrigin([{ storeId: 'web' }, { storeId: 'foreign' }], companyStores)).toEqual({ storeId: null, error: expect.stringContaining('mismo negocio') });
  });

  it('does not guess business membership if the company catalogue is unavailable', () => {
    expect(resolveGuideOrigin([{ storeId: 'web' }], [])).toEqual({ storeId: null, error: expect.stringContaining('negocio activo') });
  });

  it.each([
    { orders: [] },
    { orders: [{ storeId: 'web' }, {}] },
    { orders: [{ storeId: '' }] },
  ])('rejects incomplete selections: $orders', ({ orders }) => {
    expect(resolveGuideOrigin(orders, companyStores)).toEqual({ storeId: null, error: expect.stringContaining('identificar la tienda') });
  });
});
