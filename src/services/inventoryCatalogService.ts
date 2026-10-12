import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export interface BusinessInventory {
  id: string;
  name: string;
  storeId: string;
  storeName?: string;
}
export interface InventoryScopeRequest {
  companyId: string;
  accessToken: string;
  scope?: "business" | "store";
  storeIds?: string[];
  signal?: AbortSignal;
}

/** The sale catalog includes physical owners, including warehouses shared by sales channels. */
async function fetchCatalog({ companyId, accessToken, signal }: InventoryScopeRequest): Promise<{ inventories: BusinessInventory[]; storeIds: string[] }> {
  if (!companyId || !accessToken) throw new Error("Selecciona un negocio para consultar los almacenes.");
  const { data: catalog } = await axiosAuth.get(
    `${process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas}/order-header/sale-context`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal },
  );
  const ownerIds = catalog?.inventoryStoreIds ?? (Array.isArray(catalog?.stores) ? catalog.stores.map((store: { id: string }) => store?.id) : undefined);
  if (catalog?.companyId !== companyId || !Array.isArray(ownerIds) || !ownerIds.every((id) => typeof id === "string" && id) ||
    !Array.isArray(catalog.inventories) || catalog.inventories.some((inv: BusinessInventory) =>
      !inv || typeof inv.id !== "string" || !inv.id || typeof inv.name !== "string" || !ownerIds.includes(inv.storeId))) {
    throw new Error("Los almacenes no corresponden al negocio activo.");
  }
  const storeNames = new Map<string, string>((Array.isArray(catalog.stores) ? catalog.stores : []).map((store: { id: string; name?: string }) => [store.id, store.name ?? ""]));
  const inventories = new Map<string, BusinessInventory>();
  for (const inv of catalog.inventories as BusinessInventory[]) {
    const previous = inventories.get(inv.id);
    if (previous && previous.storeId !== inv.storeId) throw new Error("El almacén tiene una asociación de tienda inválida.");
    inventories.set(inv.id, { ...inv, storeName: storeNames.get(inv.storeId) || inv.storeName });
  }
  return { inventories: [...inventories.values()], storeIds: ownerIds };
}

export async function fetchBusinessInventories(request: InventoryScopeRequest): Promise<BusinessInventory[]> {
  return (await fetchCatalog(request)).inventories;
}

export async function fetchScopeInventories(request: InventoryScopeRequest): Promise<BusinessInventory[]> {
  const catalog = await fetchCatalog(request);
  const warehouses = catalog.inventories;
  if (request.scope !== "store") return warehouses;
  if (request.storeIds?.length !== 1) throw new Error("Selecciona una tienda para consultar sus almacenes.");
  const storeId = request.storeIds[0];
  if (!catalog.storeIds.includes(storeId)) throw new Error("La tienda no corresponde al negocio activo.");
  const selected = new Set(warehouses.filter((inv) => inv.storeId === storeId).map((inv) => inv.id));
  const { data: shops } = await axiosAuth.get(
    `${process.env.NEXT_PUBLIC_API_INTEGRATIONS || GATEWAY.integrations}/shopify/status/${request.companyId}`,
    { headers: { Authorization: `Bearer ${request.accessToken}` }, signal: request.signal },
  );
  if (!Array.isArray(shops)) throw new Error("No se pudo interpretar la respuesta de inventario.");
  for (const shop of shops) {
    if (!shop || typeof shop.isConnected !== "boolean") throw new Error("No se pudo interpretar la respuesta de inventario.");
    if (shop.isConnected && shop.store_id === storeId && shop.inventory_id) {
      if (!warehouses.some((inv) => inv.id === shop.inventory_id)) throw new Error("El almacén vinculado a la tienda no pertenece al negocio activo.");
      selected.add(shop.inventory_id);
    }
  }
  return warehouses.filter((inv) => selected.has(inv.id));
}
