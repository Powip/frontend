import { InventoryItemForSale } from "@/interfaces/IProduct";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

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
    `${GATEWAY.logistics}/inventory-item/search`,
    { params },
  );

  return res.data;
}
