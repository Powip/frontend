import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

const API_PRODUCTS = GATEWAY.products;
const API_LOGISTICS = GATEWAY.logistics;

export interface ProductSummary {
  total: number;
}

export interface OutOfStockSummary {
  count: number;
}

export interface OutOfStockItem {
  variantId: string;
  productName: string;
  sku: string;
  availableStock: number;
  physicalStock: number;
}

export const getProductSummary = async (): Promise<ProductSummary> => {
  const response = await axiosAuth.get(`${API_PRODUCTS}/products/summary`);
  return response.data;
};

export const getOutOfStockSummary = async (): Promise<OutOfStockSummary> => {
  const response = await axiosAuth.get(
    `${API_LOGISTICS}/inventory-item/summary/out-of-stock`,
  );
  return response.data;
};

export const getOutOfStockDetails = async (): Promise<OutOfStockItem[]> => {
  const response = await axiosAuth.get(
    `${API_LOGISTICS}/inventory-item/summary/out-of-stock-details`,
  );
  return response.data;
};

export const getCompanyProductCount = async (
  companyId: string,
): Promise<number> => {
  const response = await axiosAuth.get(
    `${API_PRODUCTS}/products/company/${companyId}`,
  );
  return response.data.length;
};

export const getProductById = async (id: string): Promise<any> => {
  const response = await axiosAuth.get(`${API_PRODUCTS}/products/${id}`);
  return response.data;
};

export const updateProduct = async (id: string, payload: any): Promise<any> => {
  const response = await axiosAuth.patch(`${API_PRODUCTS}/products/${id}`, payload);
  return response.data;
};

export const createProduct = async (payload: any): Promise<any> => {
  const response = await axiosAuth.post(`${API_PRODUCTS}/products`, payload);
  return response.data;
};

export const deleteProduct = async (id: string): Promise<any> => {
  const response = await axiosAuth.delete(`${API_PRODUCTS}/products/${id}`);
  return response.data;
};
