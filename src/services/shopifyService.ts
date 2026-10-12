import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

const API_INTEGRATIONS =
  process.env.NEXT_PUBLIC_API_INTEGRATIONS || GATEWAY.integrations;

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
    `${API_INTEGRATIONS}/shopify/status/${companyId}`,
  );
  return response.data;
};

export const syncShopifyProducts = async (
  shopUrl: string,
  companyId: string,
  inventoryId?: string,
  storeId?: string,
): Promise<any> => {
  const response = await axiosAuth.post(`${API_INTEGRATIONS}/shopify/sync`, {
    shopUrl,
    companyId,
    inventoryId,
    storeId,
  });
  return response.data;
};

export const getShopifyProducts = async (shopUrl: string): Promise<any[]> => {
  const response = await axiosAuth.get(
    `${API_INTEGRATIONS}/shopify/products/${shopUrl}`,
  );
  return response.data;
};
