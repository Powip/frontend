import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

const API_VENTAS = GATEWAY.ventas;

export interface GlobalSalesSummary {
  totalSales: number;
  orderCount: number;
  income?: Array<{ date: string; amount: number }>;
}

export interface DailyIncome {
  date: string;
  totalIncome: number;
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
  fromDate?: string,
  toDate?: string,
): Promise<GlobalSalesSummary> => {
  const params: any = {};
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  const response = await axiosAuth.get(
    `${API_VENTAS}/order-header/summary/global`,
    { params },
  );
  return response.data;
};

export const getRejectedPaymentsAlert = async (): Promise<RejectedPaymentAlert> => {
  const response = await axiosAuth.get(`${API_VENTAS}/payments/alerts/rejected`);
  return response.data;
};

export const getCompanySalesSummary = async (
  companyId: string,
  fromDate?: string,
  toDate?: string,
): Promise<GlobalSalesSummary> => {
  const params: any = {};
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  const response = await axiosAuth.get(
    `${API_VENTAS}/order-header/summary/company/${companyId}`,
    { params },
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
  companyId: string,
  year?: number,
): Promise<BillingStats[]> => {
  const params: any = {};
  if (year) params.year = year;

  const response = await axiosAuth.get(`${API_VENTAS}/stats/billing`, {
    params: {
      storeId: companyId,
      ...params,
    },
  });
  return response.data;
};

export const getGlobalBilling = async (
  year?: number,
): Promise<BillingStats[]> => {
  const params: any = {};
  if (year) params.year = year;

  const response = await axiosAuth.get(`${API_VENTAS}/stats/billing/global`, {
    params,
  });
  return response.data;
};

export const getCompanyDailyIncome = async (
  companyId: string,
  fromDate?: string,
  toDate?: string,
): Promise<DailyIncome[]> => {
  const params: any = { storeId: companyId };
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  const response = await axiosAuth.get(
    `${API_VENTAS}/stats/daily-income`,
    { params },
  );
  return response.data;
};
