import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

interface CreateInventoryDto {
  name: string;
  store_id: string;
}

export async function createInventory(data: CreateInventoryDto) {
  const res = await axiosAuth.post(`${GATEWAY.logistics}/inventory`, data);
  return res;
}
