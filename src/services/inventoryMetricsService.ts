import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { fetchScopeInventories } from "./inventoryCatalogService";

export interface InventoryMetricItem {
  inventoryItemId: string;
  inventoryId: string;
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  availableStock: number;
  physicalStock: number;
  min_stock?: number;
  attributes?: Record<string, string>;
  category?: string;
}

interface MetricsRequest {
  companyId: string;
  accessToken: string;
  scope: "business" | "store";
  storeIds: string[];
  signal?: AbortSignal;
}

const PAGE_SIZE = 100;
const INVALID_RESPONSE = "No se pudo interpretar la respuesta de inventario.";

function stockNumber(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error(INVALID_RESPONSE);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(INVALID_RESPONSE);
  return number;
}

/** Resolve physical warehouses first: linked sales stores must not multiply shared stock. */
export async function fetchInventoryMetrics({
  companyId,
  accessToken,
  scope,
  storeIds,
  signal,
}: MetricsRequest): Promise<InventoryMetricItem[]> {
  if (!companyId || !accessToken || storeIds.length === 0) {
    throw new Error("Selecciona un negocio y una tienda para consultar el inventario.");
  }
  const headers = { Authorization: `Bearer ${accessToken}` };
  const warehouses = await fetchScopeInventories({ companyId, accessToken, scope, storeIds, signal });
  const inventoryIds = warehouses.map((inventory) => inventory.id);

  const results = await Promise.all(
    inventoryIds.map(async (inventoryId) => {
      const items: InventoryMetricItem[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const { data: response } = await axiosAuth.get<{
          data: Array<Record<string, unknown>>;
          meta: { page: number; totalPages: number };
        }>(`${process.env.NEXT_PUBLIC_API_INVENTORY || GATEWAY.logistics}/inventory-item/search`, {
          params: { inventoryId, companyId, page, limit: PAGE_SIZE },
          headers,
          signal,
        });
        totalPages = stockNumber(response?.meta?.totalPages);
        if (
          !Array.isArray(response?.data) ||
          !Number.isInteger(totalPages) ||
          totalPages < 0 ||
          (totalPages === 0 && response.data.length > 0) ||
          Number(response?.meta?.page) !== page
        ) {
          throw new Error(INVALID_RESPONSE);
        }
        for (const row of response.data) {
          if (
            !row ||
            typeof row.inventoryItemId !== "string" ||
            !row.inventoryItemId ||
            typeof row.variantId !== "string" ||
            !row.variantId ||
            typeof row.productId !== "string" ||
            !row.productId ||
            typeof row.productName !== "string"
          ) {
            throw new Error(INVALID_RESPONSE);
          }
          items.push({
            inventoryItemId: row.inventoryItemId,
            inventoryId,
            variantId: row.variantId,
            productId: row.productId,
            productName: row.productName,
            sku: typeof row.sku === "string" ? row.sku : "",
            availableStock: stockNumber(row.availableStock),
            physicalStock: stockNumber(row.physicalStock),
            min_stock: row.min_stock == null ? undefined : stockNumber(row.min_stock),
            category: typeof row.category === "string" ? row.category : undefined,
            attributes:
              row.attributes && typeof row.attributes === "object"
                ? (row.attributes as Record<string, string>)
                : undefined,
          });
        }
        page++;
      } while (page <= totalPages);
      return items;
    }),
  );

  return [...new Map(results.flat().map((item) => [item.inventoryItemId, item])).values()];
}

/** The same SKU can have separate physical stock positions in different warehouses. */
export function aggregateInventoryStock(items: InventoryMetricItem[]): InventoryMetricItem[] {
  const variants = new Map<string, InventoryMetricItem>();
  for (const item of items) {
    const previous = variants.get(item.variantId);
    if (!previous) {
      variants.set(item.variantId, { ...item });
    } else {
      previous.availableStock += item.availableStock;
      previous.physicalStock += item.physicalStock;
      if (item.min_stock !== undefined) {
        previous.min_stock = (previous.min_stock || 0) + item.min_stock;
      }
    }
  }
  return [...variants.values()];
}
