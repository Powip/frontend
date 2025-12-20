import { InventoryItemForSale } from "@/interfaces/IProduct";
import axios from "axios";

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
  q?: string;
  page?: number;
  limit?: number;
}): Promise<SearchInventoryItemsResponse> {
  const res = await axios.get<SearchInventoryItemsResponse>(
    `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/search`,

    { params }
  );

  return res.data;
}
