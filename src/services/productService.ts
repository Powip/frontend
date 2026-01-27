import axios from "axios";

const API_PRODUCTS =
  process.env.NEXT_PUBLIC_API_PRODUCTOS || "http://localhost:3005";
const API_LOGISTICS =
  process.env.NEXT_PUBLIC_API_INVENTORY || "http://localhost:3004";

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

export const getProductSummary = async (
  accessToken: string,
): Promise<ProductSummary> => {
  const response = await axios.get(`${API_PRODUCTS}/products/summary`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};

export const getOutOfStockSummary = async (
  accessToken: string,
): Promise<OutOfStockSummary> => {
  const response = await axios.get(
    `${API_LOGISTICS}/inventory-item/summary/out-of-stock`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.data;
};

export const getOutOfStockDetails = async (
  accessToken: string,
): Promise<OutOfStockItem[]> => {
  const response = await axios.get(
    `${API_LOGISTICS}/inventory-item/summary/out-of-stock-details`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.data;
};

export const getCompanyProductCount = async (
  accessToken: string,
  companyId: string,
): Promise<number> => {
  const response = await axios.get(
    `${API_PRODUCTS}/products/company/${companyId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.data.length;
};
export const getProductById = async (id: string): Promise<any> => {
  const response = await axios.get(`${API_PRODUCTS}/products/${id}`);
  return response.data;
};

export const updateProduct = async (id: string, payload: any): Promise<any> => {
  const response = await axios.patch(`${API_PRODUCTS}/products/${id}`, payload);
  return response.data;
};

export const createProduct = async (payload: any): Promise<any> => {
  const response = await axios.post(`${API_PRODUCTS}/products`, payload);
  return response.data;
};

export const deleteProduct = async (id: string): Promise<any> => {
  const response = await axios.delete(`${API_PRODUCTS}/products/${id}`);
  return response.data;
};
