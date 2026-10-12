import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export interface SaleStore {
  id: string;
  name: string;
  color?: string | null;
  is_legacy?: boolean;
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
  inventoryStoreIds?: string[];
  channels?: SaleSalesChannel[];
}
export interface SaleSalesChannel {
  id: string;
  storeId: string;
  type:
    | "WHATSAPP"
    | "INSTAGRAM"
    | "FACEBOOK"
    | "WEB"
    | "SHOPIFY"
    | "TIKTOK"
    | "MARKETPLACE"
    | "PHYSICAL"
    | "OTHER";
  label: string;
  identifier: string | null;
  externalId: string | null;
  normalizedIdentifier?: string | null;
  isActive?: boolean;
}

export async function fetchSaleContext(companyId: string, signal?: AbortSignal) {
  const { data } = await axiosAuth.get<SaleContext>(`${GATEWAY.ventas}/order-header/sale-context`, {
    signal,
  });
  if (data?.companyId !== companyId) {
    throw new Error("El contexto de venta no pertenece a la empresa activa.");
  }
  const inventoryStoreIds =
    data.inventoryStoreIds ??
    (Array.isArray(data.stores) ? data.stores.map((store) => store?.id) : undefined);
  if (
    !Array.isArray(data.stores) ||
    !Array.isArray(data.inventories) ||
    !Array.isArray(inventoryStoreIds) ||
    inventoryStoreIds.some((id) => typeof id !== "string") ||
    data.stores.some(
      (store) => !store || typeof store.id !== "string" || typeof store.name !== "string",
    ) ||
    data.inventories.some(
      (inventory) =>
        !inventory ||
        typeof inventory.id !== "string" ||
        typeof inventory.name !== "string" ||
        !inventoryStoreIds.includes(inventory.storeId),
    ) ||
    (data.channels !== undefined &&
      (!Array.isArray(data.channels) ||
        data.channels.some(
          (channel) =>
            !channel ||
            typeof channel.id !== "string" ||
            typeof channel.label !== "string" ||
            ![
              "WHATSAPP",
              "INSTAGRAM",
              "FACEBOOK",
              "WEB",
              "SHOPIFY",
              "TIKTOK",
              "MARKETPLACE",
              "PHYSICAL",
              "OTHER",
            ].includes(channel.type) ||
            !data.stores.some((store) => store.id === channel.storeId && !store.is_legacy),
        )))
  ) {
    throw new Error("No se pudo cargar el origen de la venta.");
  }
  return data;
}
