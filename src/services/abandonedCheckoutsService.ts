import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

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
  params: {
    page?: number;
    limit?: number;
    status?: string;
    companyId?: string;
    storeId?: string;
  } = {},
): Promise<FindAllResult> => {
  const response = await axiosAuth.get(
    `${GATEWAY.ventas}/abandoned-checkouts`,
    {
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
  companyId: string,
): Promise<Array<{ isConnected: boolean; shop_url: string; needs_reauthorization: boolean }>> => {
  const response = await axiosAuth.get(
    `${GATEWAY.integrations}/shopify/status/${companyId}`,
  );
  return response.data;
};

export const getAbandonedCheckoutStats = async (
  companyId?: string,
): Promise<AbandonedCheckoutStats> => {
  const response = await axiosAuth.get(
    `${GATEWAY.ventas}/abandoned-checkouts/stats`,
    {
      ...(companyId && { params: { companyId } }),
    },
  );
  return response.data;
};
