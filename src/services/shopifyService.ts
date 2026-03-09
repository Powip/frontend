import axios from "axios";

const API_INTEGRATIONS =
  process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3007";

export interface ShopifyShopStatus {
  isConnected: boolean;
  shop_url: string;
  store_id?: string;
  inventory_id?: string;
}

export const getShopifyStatus = async (
  companyId: string,
): Promise<ShopifyShopStatus[]> => {
  const response = await axios.get(
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
  const response = await axios.post(`${API_INTEGRATIONS}/shopify/sync`, {
    shopUrl,
    companyId,
    inventoryId,
    storeId,
  });
  return response.data;
};

export const getShopifyProducts = async (shopUrl: string): Promise<any[]> => {
  const response = await axios.get(
    `${API_INTEGRATIONS}/shopify/products/${shopUrl}`,
  );
  return response.data;
};
