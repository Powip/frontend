export interface GuideOrderOrigin {
  storeId?: string | null;
  inventoryId?: string | null;
  stockStoreId?: string | null;
}

export function resolveGuideOrigin(orders: readonly GuideOrderOrigin[]) {
  if (!orders.length || orders.some((order) => !order.storeId)) {
    return { storeId: null, error: "No se pudo identificar la tienda de los pedidos seleccionados." };
  }
  const stores = new Set(orders.map((order) => order.storeId!));
  if (stores.size !== 1) {
    return { storeId: null, error: "Selecciona pedidos de una sola tienda para crear o añadir a una guía." };
  }
  const warehouses = new Set(orders.map((order) => `${order.inventoryId ?? "legacy"}:${order.stockStoreId ?? "legacy"}`));
  if (warehouses.size !== 1) {
    return { storeId: null, error: "Selecciona pedidos del mismo almacén para crear o añadir a una guía." };
  }
  return { storeId: [...stores][0], error: null };
}
