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
}): Promise<SearchInventoryItemsResponse> {
  const res = await axiosAuth.get<SearchInventoryItemsResponse>(
    `${GATEWAY.logistics}/inventory-item/search`,
    { params },
  );

  return res.data;
}
