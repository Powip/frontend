import { InventoryItemForSale } from "@/interfaces/IProduct";
import axiosAuth from "@/lib/axiosAuth";

const API_INVENTORY = process.env.NEXT_PUBLIC_API_INVENTORY;

interface SearchInventoryItemsResponse {
  data: InventoryItemForSale[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function searchInventoryItems(params: {
  inventoryId: string;
  companyId?: string;
  q?: string;
  page?: number;
  limit?: number;
  // Pendientes de soporte en el backend (ms-logistics /inventory-item/search
  // hoy no los filtra) — se mandan igual porque en un GET un query param
  // desconocido no rompe nada; quedan listos para cuando el backend los sume.
  brandId?: string;
  categoryId?: string;
  subcategoryId?: string;
}): Promise<SearchInventoryItemsResponse> {
  const res = await axiosAuth.get<SearchInventoryItemsResponse>(
    `${API_INVENTORY}/inventory-item/search`,
    { params },
  );

  return res.data;
}

export interface ExportInventoryItemsParams {
  inventoryId: string;
  companyId?: string;
  q?: string;
  supplierId?: string;
  brandId?: string;
  categoryId?: string;
  subcategoryId?: string;
}

/**
 * Trae TODOS los items del inventario que matchean el filtro aplicado
 * (sin paginar), usando el modo `all=true` de ms-logistics
 * `/inventory-item/search` (FEAT-09). Pensado para el export a Excel:
 * nunca usar para poblar la tabla en pantalla.
 */
export async function exportInventoryItems(
  params: ExportInventoryItemsParams,
): Promise<InventoryItemForSale[]> {
  const res = await axiosAuth.get<SearchInventoryItemsResponse>(
    `${API_INVENTORY}/inventory-item/search`,
    { params: { ...params, all: true } },
  );

  return res.data.data;
}

// FEAT-17 Anexo B — POST /inventory-item/stock-by-variants: stock/reservas
// agregados (sólo inventarios activos) por variante, usado en el modal
// "Unificar" de reconciliación para mostrar stock antes/después del merge.
// El backend limita el body a 1..100 variantIds, así que acá se parte en
// bloques y se piden en paralelo — el caller nunca se preocupa del límite.
export interface VariantStockInventoryDetail {
  inventory_id: string;
  inventory_name: string;
  store_id: string | null;
  quantity: number;
  reserved_quantity: number;
}

export interface VariantStock {
  variant_id: string;
  quantity: number;
  reserved_quantity: number;
  available: number;
  inventories: VariantStockInventoryDetail[];
}

const STOCK_BY_VARIANTS_CHUNK_SIZE = 100;

export async function getStockByVariants(
  variantIds: string[],
): Promise<VariantStock[]> {
  const uniqueIds = Array.from(new Set(variantIds));
  if (uniqueIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += STOCK_BY_VARIANTS_CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + STOCK_BY_VARIANTS_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (variantIdsChunk) => {
      const res = await axiosAuth.post<VariantStock[]>(
        `${API_INVENTORY}/inventory-item/stock-by-variants`,
        { variantIds: variantIdsChunk },
      );
      return res.data;
    }),
  );

  return results.flat();
}
