import axiosAuth from "@/lib/axiosAuth";

const BASE = process.env.NEXT_PUBLIC_API_VENTAS;

export interface DashboardStatsFilters {
  storeId: string;
  fromDate: string;
  toDate: string;
  sellerId?: string;
}

export interface DashboardSummaryResponse {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  averageTicket: number;
  totalDelivered: number;
  deliveredAmount: number;
  byStatus: Record<string, { count: number; amount: number }>;
  dailySales: Array<{ date: string; orders: number; amount: number; products: number }>;
}

function buildParams({ storeId, fromDate, toDate, sellerId }: DashboardStatsFilters) {
  const params = new URLSearchParams({ storeId, fromDate, toDate });
  if (sellerId) params.set("sellerId", sellerId);
  return params;
}

export async function getDashboardSummary(filters: DashboardStatsFilters): Promise<DashboardSummaryResponse> {
  const res = await axiosAuth.get<DashboardSummaryResponse>(
    `${BASE}/stats/summary?${buildParams(filters)}`,
  );
  return res.data;
}

export interface ChannelStat {
  channel: string;
  ordersCount: number;
  totalAmount: number;
  percentage: number;
}

export interface DashboardByChannelResponse {
  salesChannels: ChannelStat[];
  closingChannels: ChannelStat[];
}

export async function getDashboardByChannel(filters: DashboardStatsFilters): Promise<DashboardByChannelResponse> {
  const res = await axiosAuth.get<DashboardByChannelResponse>(
    `${BASE}/stats/by-channel?${buildParams(filters)}`,
  );
  return res.data;
}

export interface LocationStat {
  name: string;
  ordersCount: number;
  totalAmount: number;
  percentage: number;
}

export async function getDashboardByLocation(
  filters: DashboardStatsFilters,
  dimension: "city" | "province" | "district" = "city",
): Promise<LocationStat[]> {
  const params = buildParams(filters);
  params.set("dimension", dimension);
  const res = await axiosAuth.get<LocationStat[]>(`${BASE}/stats/by-location?${params}`);
  return res.data;
}

export interface PaymentStat {
  method: string;
  ordersCount: number;
  totalAmount: number;
  percentage: number;
}

export async function getDashboardByPayment(filters: DashboardStatsFilters): Promise<PaymentStat[]> {
  const res = await axiosAuth.get<PaymentStat[]>(`${BASE}/stats/by-payment?${buildParams(filters)}`);
  return res.data;
}

export interface ReceivablesResponse {
  pendingTotal: number;
  limaCount: number;
  provinciaCount: number;
  avgTicket: number;
  pendingOrders: Array<{ id?: string; orderNumber?: string; customerName?: string; district?: string }>;
}

export async function getDashboardReceivables(filters: DashboardStatsFilters): Promise<ReceivablesResponse> {
  const res = await axiosAuth.get<ReceivablesResponse>(`${BASE}/stats/receivables?${buildParams(filters)}`);
  return res.data;
}
