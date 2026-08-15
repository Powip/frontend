import axios from "axios";

const API_INVENTORY = process.env.NEXT_PUBLIC_API_INVENTORY;

export interface DashboardInventoryItem {
  inventoryItemId: string;
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  availableStock: number;
  physicalStock: number;
  min_stock?: number;
}

const PAGE_LIMIT = 100;

function fetchPage(inventoryId: string, page: number) {
  return axios.get(`${API_INVENTORY}/inventory-item/search`, {
    params: { inventoryId, page, limit: PAGE_LIMIT },
  });
}

/**
 * Trae todos los items de un inventario. Pide la página 1 para conocer el total
 * de páginas y dispara el resto en paralelo (en vez de una por una en serie,
 * como hace metricas/inventario) — con catálogos grandes esto evita que la
 * carga de este widget escale linealmente con la cantidad de páginas.
 */
export async function getInventoryItemsByInventoryId(inventoryId: string): Promise<DashboardInventoryItem[]> {
  const first = await fetchPage(inventoryId, 1);
  const items: DashboardInventoryItem[] = [...(first.data?.data ?? [])];
  const totalPages = first.data?.meta?.totalPages ?? 1;

  if (totalPages > 1) {
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const results = await Promise.all(remainingPages.map((page) => fetchPage(inventoryId, page)));
    results.forEach((res) => items.push(...(res.data?.data ?? [])));
  }

  return items;
}
