import axios from "axios";
import { AdvertisingApiError } from "./advertisingService";

export type AdvertisingOrderBasis = "created" | "delivered" | "paid";
export type AdvertisingOrderCostKey =
  | "productCost"
  | "shippingCost"
  | "channelFee"
  | "paymentFee"
  | "otherCost";
export interface AdvertisingOrderFilters {
  from: string;
  to: string;
  basis: AdvertisingOrderBasis;
  timeZone?: string;
  page?: number;
  limit?: number;
  groupBy?: "ad" | "campaign" | "product" | "zone" | "store" | "channel";
  storeId?: string;
  channelId?: string;
}
export interface AdvertisingOrderQuality {
  basis: "created";
  from: string;
  to: string;
  ordersCreated: number;
  unknownCurrencyCount: number;
  unattributedCount: number;
  missingDeliveredDateCount: number;
  missingPaidDateCount: number;
  partiallyPaidCount: number;
  incompleteCostCount: number;
}
export interface AdvertisingOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  storeId: string;
  createdAt: string;
  deliveredAt: string | null;
  paidAt: string | null;
  currency: string | null;
  revenue: string;
  paidRevenue: string;
  zone: string | null;
  costs: Record<AdvertisingOrderCostKey, string | null> & {
    version: number;
    complete: boolean;
    missing: AdvertisingOrderCostKey[];
    total: string | null;
    contributionBeforeAds: string | null;
  };
  attribution: {
    version: number;
    adId: string | null;
    accountId: string | null;
    adName: string | null;
    source: "manual" | "reference" | "unattributed";
    originalReferencePresent: boolean;
    currency: string | null;
    timeZone: string | null;
  };
}
export interface AdvertisingOrdersResponse {
  source: "powip-orders";
  from: string;
  to: string;
  basis: AdvertisingOrderBasis;
  timeZone: string;
  page: number;
  limit: number;
  total: number;
  capabilities: { reconcile: boolean };
  quality: AdvertisingOrderQuality;
  rows: AdvertisingOrderRow[];
}
export interface AdvertisingOrderRevision {
  version: number;
  reason: string;
  createdAt: string;
  adId?: string | null;
  accountId?: string | null;
  currency?: string | null;
  productCost?: string | null;
  shippingCost?: string | null;
  channelFee?: string | null;
  paymentFee?: string | null;
  otherCost?: string | null;
}
export interface AdvertisingOrderDetail {
  source: "powip-orders";
  row: AdvertisingOrderRow;
  capabilities: { reconcile: boolean };
  attributionHistory: AdvertisingOrderRevision[];
  financeHistory: AdvertisingOrderRevision[];
}
export interface AdvertisingOrderAttributionReview {
  expectedVersion: number;
  accountId: string | null;
  adId: string | null;
  reason: string;
}
export type AdvertisingOrderFinanceReview = Record<AdvertisingOrderCostKey, string | null> & {
  expectedVersion: number;
  currency: string | null;
  reason: string;
};
export interface AdvertisingBusinessRow {
  id: string | null;
  name: string | null;
  accountId: string | null;
  adCurrency: string | null;
  adTimeZone: string | null;
  currency: string | null;
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
  revenue: string;
  paidRevenue: string | null;
  units: number | null;
  incompleteCostCount: number;
  costTotal: string | null;
  contributionBeforeAds: string | null;
}
export interface AdvertisingBusinessAnalytics {
  source: "powip-orders";
  from: string;
  to: string;
  basis: AdvertisingOrderBasis;
  timeZone: string;
  groupBy: "ad" | "campaign" | "product" | "zone" | "store" | "channel";
  storeId?: string;
  channelId?: string;
  rows: AdvertisingBusinessRow[];
  currencies: string[];
  totalGroups: number;
  truncated: boolean;
  quality: AdvertisingOrderQuality;
  cohortCoverage?: {
    basis: AdvertisingOrderBasis;
    complete: boolean;
    reasons: string[];
    missingDeliveredDateCount: number;
    missingPaidDateCount: number;
  };
  limitations: string[];
  netProfit: null;
  roas: null;
}

export function advertisingOrdersApiBase() {
  const configured = process.env.NEXT_PUBLIC_API_VENTAS;
  if (!configured)
    throw new AdvertisingApiError("Los pedidos de publicidad aún no están disponibles.", 503);
  try {
    const base = new URL(configured);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      throw new Error("Invalid base");
    base.pathname = `${base.pathname.replace(/\/+$/, "").replace(/\/api\/v1$/, "")}/api/v1`;
    return base.toString().replace(/\/+$/, "");
  } catch {
    throw new AdvertisingApiError("Los pedidos de publicidad aún no están disponibles.", 503);
  }
}
function url(companyId: string) {
  return `${advertisingOrdersApiBase()}/advertising/companies/${encodeURIComponent(companyId)}`;
}
function options(token: string, signal?: AbortSignal) {
  if (!token || token.length > 16_384 || /\s/.test(token))
    throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
  return {
    headers: { Authorization: `Bearer ${token}` },
    withCredentials: false,
    timeout: 30_000,
    signal,
  };
}
export async function getAdvertisingOrders(
  token: string,
  companyId: string,
  filters: AdvertisingOrderFilters,
  signal?: AbortSignal,
) {
  return (
    await axios.get<AdvertisingOrdersResponse>(`${url(companyId)}/orders`, {
      ...options(token, signal),
      params: filters,
    })
  ).data;
}
export async function getAdvertisingOrderDetail(
  token: string,
  companyId: string,
  orderId: string,
  signal?: AbortSignal,
) {
  return (
    await axios.get<AdvertisingOrderDetail>(
      `${url(companyId)}/orders/${encodeURIComponent(orderId)}`,
      options(token, signal),
    )
  ).data;
}
export async function getAdvertisingBusinessAnalytics(
  token: string,
  companyId: string,
  filters: AdvertisingOrderFilters,
  signal?: AbortSignal,
) {
  return (
    await axios.get<AdvertisingBusinessAnalytics>(`${url(companyId)}/analytics`, {
      ...options(token, signal),
      params: filters,
    })
  ).data;
}
export async function reviewAdvertisingOrderAttribution(
  token: string,
  companyId: string,
  orderId: string,
  body: AdvertisingOrderAttributionReview,
) {
  return (
    await axios.put<AdvertisingOrderDetail>(
      `${url(companyId)}/orders/${encodeURIComponent(orderId)}/attribution`,
      body,
      options(token),
    )
  ).data;
}
export async function reviewAdvertisingOrderFinance(
  token: string,
  companyId: string,
  orderId: string,
  body: AdvertisingOrderFinanceReview,
) {
  return (
    await axios.put<AdvertisingOrderDetail>(
      `${url(companyId)}/orders/${encodeURIComponent(orderId)}/finance-review`,
      body,
      options(token),
    )
  ).data;
}
