import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export interface ShopifyShopStatus {
  isConnected: boolean;
  shop_url: string;
  store_id?: string;
  inventory_id?: string;
}

export const getShopifyStatus = async (
  companyId: string,
): Promise<ShopifyShopStatus[]> => {
  const response = await axiosAuth.get(
    `${GATEWAY.integrations}/shopify/status/${companyId}`,
  );
  return response.data;
};

export const syncShopifyProducts = async (
  shopUrl: string,
  companyId: string,
  inventoryId?: string,
  storeId?: string,
): Promise<unknown> => {
  const response = await axiosAuth.post(`${GATEWAY.integrations}/shopify/sync`, {
    shopUrl,
    companyId,
    inventoryId,
    storeId,
  });
  return response.data;
};

export const getShopifyProducts = async (shopUrl: string): Promise<unknown[]> => {
  const response = await axiosAuth.get(
    `${GATEWAY.integrations}/shopify/products/${shopUrl}`,
  );
  return response.data;
};
