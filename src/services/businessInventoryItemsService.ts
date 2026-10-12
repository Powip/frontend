import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import { BusinessInventory } from "./inventoryCatalogService";

export interface BusinessInventoryItem extends InventoryItemForSale {
  productId: string;
  inventoryId: string;
  inventoryName: string;
  storeId: string;
  storeName?: string;
}

/** Read every backend page before paginating the union. Never merge physical rows by SKU or variant. */
export async function fetchBusinessInventoryItems({ inventories, companyId, accessToken, signal }: {
  inventories: BusinessInventory[]; companyId: string; accessToken: string; signal?: AbortSignal;
}): Promise<BusinessInventoryItem[]> {
  if (!companyId || !accessToken) throw new Error("La sesión no permite consultar el inventario.");
  const uniqueWarehouses = [...new Map(inventories.map((inv) => [inv.id, inv])).values()];
  const results = await Promise.all(uniqueWarehouses.map(async (inv) => {
    const rows: BusinessInventoryItem[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const { data } = await axiosAuth.get(`${process.env.NEXT_PUBLIC_API_INVENTORY || GATEWAY.logistics}/inventory-item/search`, {
        params: { inventoryId: inv.id, companyId, page, limit: 100 },
        headers: { Authorization: `Bearer ${accessToken}` }, signal,
      });
      totalPages = Number(data?.meta?.totalPages);
      if (!Array.isArray(data?.data) || !Number.isInteger(totalPages) || totalPages < 0 || Number(data?.meta?.page) !== page || (totalPages === 0 && data.data.length)) {
        throw new Error("No se pudo interpretar la respuesta de inventario.");
      }
      for (const row of data.data) {
        if (!row?.inventoryItemId || !row.variantId || typeof row.productName !== "string" ||
          !Number.isFinite(Number(row.availableStock)) || !Number.isFinite(Number(row.physicalStock))) {
          throw new Error("No se pudo interpretar la respuesta de inventario.");
        }
        rows.push({ ...row, inventoryId: inv.id, inventoryName: inv.name, storeId: inv.storeId, storeName: inv.storeName,
          availableStock: Number(row.availableStock), physicalStock: Number(row.physicalStock) });
      }
      page++;
    } while (page <= totalPages);
    return rows;
  }));
  return [...new Map(results.flat().map((row) => [row.inventoryItemId, row])).values()]
    .sort((a, b) => a.productName.localeCompare(b.productName, "es") || a.inventoryId.localeCompare(b.inventoryId) || a.inventoryItemId.localeCompare(b.inventoryItemId));
}

export function filterBusinessInventoryItems(rows: BusinessInventoryItem[], inventoryId: string, search: string) {
  const query = search.trim().toLocaleLowerCase("es");
  return rows.filter((row) => (inventoryId === "all" || row.inventoryId === inventoryId) &&
    (!query || [row.productName, row.sku, row.companySku, ...Object.values(row.attributes ?? {})]
      .some((value) => String(value ?? "").toLocaleLowerCase("es").includes(query))));
}
