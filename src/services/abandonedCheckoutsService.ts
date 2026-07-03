import axios from "axios";

const API_VENTAS =
  process.env.NEXT_PUBLIC_API_VENTAS || "http://localhost:3002";

export interface AbandonedCheckout {
  id: string;
  shopifyCheckoutId: string;
  shopifyCartToken?: string;
  companyId: string;
  storeId?: string;
  status: "OPEN" | "RECOVERED" | "EXPIRED";
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  totalPrice?: number;
  currency?: string;
  itemsData?: Array<{
    variantId: string;
    productId: string;
    title: string;
    quantity: number;
    price: string;
    sku?: string;
  }>;
  abandonedAt?: string;
  recoveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AbandonedCheckoutStats {
  total: number;
  open: number;
  recovered: number;
  expired: number;
  recoveryRate: number;
}

export interface FindAllResult {
  data: AbandonedCheckout[];
  total: number;
  page: number;
  limit: number;
}

export const getAbandonedCheckouts = async (
  accessToken: string,
  params: {
    page?: number;
    limit?: number;
    status?: string;
    companyId?: string;
    storeId?: string;
  } = {},
): Promise<FindAllResult> => {
  const response = await axios.get(
    `${API_VENTAS}/abandoned-checkouts`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        ...(params.status && { status: params.status }),
        ...(params.companyId && { companyId: params.companyId }),
        ...(params.storeId && { storeId: params.storeId }),
      },
    },
  );
  return response.data;
};

export const getShopifyStatus = async (
  accessToken: string,
  companyId: string,
): Promise<Array<{ isConnected: boolean; shop_url: string; needs_reauthorization: boolean }>> => {
  const API_INTEGRATIONS = process.env.NEXT_PUBLIC_API_INTEGRATIONS || 'http://localhost:3007';
  const response = await axios.get(
    `${API_INTEGRATIONS}/shopify/status/${companyId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return response.data;
};

export const getAbandonedCheckoutStats = async (
  accessToken: string,
  companyId?: string,
): Promise<AbandonedCheckoutStats> => {
  const response = await axios.get(
    `${API_VENTAS}/abandoned-checkouts/stats`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      ...(companyId && { params: { companyId } }),
    },
  );
  return response.data;
};
