export interface GuideOrderOrigin {
  storeId?: string | null;
  inventoryId?: string | null;
  stockStoreId?: string | null;
}

export function resolveGuideOrigin(
  orders: readonly GuideOrderOrigin[],
  companyStoreIds: readonly string[],
) {
  if (!orders.length || orders.some((order) => !order.storeId)) {
    return { storeId: null, error: "No se pudo identificar la tienda de los pedidos seleccionados." };
  }
  if (!companyStoreIds.length) {
    return { storeId: null, error: "No se pudieron identificar las tiendas del negocio activo." };
  }
  const stores = new Set(companyStoreIds);
  if (orders.some((order) => !stores.has(order.storeId!))) {
    return { storeId: null, error: "Los pedidos seleccionados deben pertenecer al mismo negocio." };
  }
  // La guía conserva un propietario operativo por compatibilidad con la API.
  // Cada pedido mantiene su tienda comercial y su almacén, sin agruparlos.
  return { storeId: orders[0].storeId!, error: null };
}
