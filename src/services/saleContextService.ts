import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export interface SaleStore {
  id: string;
  name: string;
}

export interface SaleInventory {
  id: string;
  name: string;
  storeId: string;
}

export interface SaleContext {
  companyId: string;
  stores: SaleStore[];
  inventories: SaleInventory[];
  /** Authorized physical owners, including legacy stores unavailable for new sales. */
  inventoryStoreIds?: string[];
}

export async function fetchSaleContext(companyId: string, signal?: AbortSignal) {
  const { data } = await axiosAuth.get<SaleContext>(
    `${GATEWAY.ventas}/order-header/sale-context`,
    { signal },
  );
  if (data?.companyId !== companyId) {
    throw new Error("El contexto de venta no pertenece a la empresa activa.");
  }
  if (!Array.isArray(data.stores) || !Array.isArray(data.inventories) ||
      data.stores.some((store) => !store || typeof store.id !== "string" || typeof store.name !== "string")) {
    throw new Error("No se pudo cargar el origen de la venta.");
  }
  // Commercial options exclude legacy stores whose warehouses can still supply
  // a sale. Older backends authorize warehouse owners through stores alone.
  const inventoryStoreIds = data.inventoryStoreIds === undefined
    ? data.stores.map((store) => store.id)
    : data.inventoryStoreIds;
  if (!Array.isArray(inventoryStoreIds) ||
      inventoryStoreIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("No se pudo cargar el origen de la venta.");
  }
  const inventoryOwners = new Set(inventoryStoreIds);
  if (data.inventories.some((inventory) => !inventory || typeof inventory.id !== "string" || typeof inventory.name !== "string" ||
      !inventoryOwners.has(inventory.storeId))) {
    throw new Error("No se pudo cargar el origen de la venta.");
  }
  return data;
}
