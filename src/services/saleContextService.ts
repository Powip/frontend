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
      data.stores.some((store) => !store || typeof store.id !== "string" || typeof store.name !== "string") ||
      data.inventories.some((inventory) => !inventory || typeof inventory.id !== "string" || typeof inventory.name !== "string" ||
        !data.stores.some((store) => store.id === inventory.storeId))) {
    throw new Error("No se pudo cargar el origen de la venta.");
  }
  return data;
}
