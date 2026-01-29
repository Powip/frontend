import axios from "axios";

const API_VENTAS =
  process.env.NEXT_PUBLIC_API_VENTAS || "http://localhost:3002";

export interface GlobalSalesSummary {
  totalSales: number;
  orderCount: number;
}

export interface RejectedPaymentAlert {
  count: number;
  payments: Array<{
    id: string;
    amount: number;
    orderId: string;
    orderNumber: string;
    notes: string;
    date: string;
  }>;
}

export const getGlobalSalesSummary = async (
  accessToken: string,
  fromDate?: string,
  toDate?: string,
): Promise<GlobalSalesSummary> => {
  const params: any = {};
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  const response = await axios.get(
    `${API_VENTAS}/order-header/summary/global`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params,
    },
  );
  return response.data;
};

export const getRejectedPaymentsAlert = async (
  accessToken: string,
): Promise<RejectedPaymentAlert> => {
  const response = await axios.get(`${API_VENTAS}/payments/alerts/rejected`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};

export const getCompanySalesSummary = async (
  accessToken: string,
  companyId: string,
  fromDate?: string,
  toDate?: string,
): Promise<GlobalSalesSummary> => {
  const params: any = {};
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  const response = await axios.get(
    `${API_VENTAS}/order-header/summary/company/${companyId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params,
    },
  );
  return response.data;
};

export interface BillingStats {
  month: string;
  currentYear: number;
  previousYear: number;
  ordersCount: number;
  previousOrdersCount: number;
}

export const getCompanyBilling = async (
  accessToken: string,
  companyId: string,
  year?: number,
): Promise<BillingStats[]> => {
  const params: any = {};
  if (year) params.year = year;

  const response = await axios.get(`${API_VENTAS}/stats/billing`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: {
      storeId: companyId,
      ...params,
    },
  });
  return response.data;
};

export const getGlobalBilling = async (
  accessToken: string,
  year?: number,
): Promise<BillingStats[]> => {
  const params: any = {};
  if (year) params.year = year;

  const response = await axios.get(`${API_VENTAS}/stats/billing/global`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params,
  });
  return response.data;
};
