import { resolveGuideOrigin } from '../guideOrigin';

describe('shipping guide source selection', () => {
  it('uses the commercial origin even when the stock belongs to a sister store', () => {
    expect(resolveGuideOrigin([{ storeId: 'web', inventoryId: 'shared-inventory', stockStoreId: 'warehouse' }])).toEqual({ storeId: 'web', error: null });
  });
  it('accepts a batch from the same store and warehouse', () => {
    expect(resolveGuideOrigin([{ storeId: 'web', inventoryId: 'inventory' }, { storeId: 'web', inventoryId: 'inventory' }]).storeId).toBe('web');
  });
  it('rejects a mixed commercial store batch even when it shares a warehouse', () => {
    expect(resolveGuideOrigin([{ storeId: 'web', inventoryId: 'shared' }, { storeId: 'livii', inventoryId: 'shared' }])).toEqual({ storeId: null, error: expect.stringContaining('una sola tienda') });
  });
  it('rejects mixed warehouses within one store', () => {
    expect(resolveGuideOrigin([{ storeId: 'web', inventoryId: 'one' }, { storeId: 'web', inventoryId: 'two' }]).error).toContain('mismo almacén');
  });
  it('retains legacy orders with a known commercial store and no warehouse metadata', () => {
    expect(resolveGuideOrigin([{ storeId: 'web' }, { storeId: 'web' }])).toEqual({ storeId: 'web', error: null });
  });
  it('never fabricates the origin of an order missing its store', () => {
    expect(resolveGuideOrigin([{ storeId: 'web' }, {}])).toEqual({ storeId: null, error: expect.stringContaining('identificar la tienda') });
  });
});
