import axios from "axios";
import { advertisingOrdersApiBase } from "./advertisingOrdersService";
import {
  adsGet,
  adsOptions,
  type AdsIdentity,
  type AdsSummary,
  type AdsDay,
  type SalesMetric,
  type AdsSales,
} from "./advertisingV22Service";

export type ExactAdChannel = "wa" | "ig" | "messenger" | "web" | "shopify_cod";
export interface AdsDayV23 extends AdsDay {
  channelExact?: ExactAdChannel | null;
  sellerId?: string | null;
  sellerMode?: "none" | "fixed" | "by_leads";
  assignmentOrigin?: string | null;
  assignmentVersion?: number | null;
}
export interface AdsSummaryV23 extends AdsSummary {
  days: AdsDayV23[];
  sellers: Array<{ id: string; name: string }>;
  shopifyCod: Array<{ storeId: string; storeName: string; enabled: boolean; connection: string }>;
}
export interface SalesMetricV23 extends Omit<SalesMetric, "billedRevenue"> {
  billedRevenue: string | null;
  normalOrders: number;
  normalConfirmed: number;
  convertedCodOrders: number;
  unattributedOrders: number;
  missingSellerOrders: number;
  adjustmentOrders: number;
  adjustmentRevenue: string | null;
  unknownAdjustmentAmounts: number;
  ordersNet: number;
  orderRevenueNet: string | null;
  completeCostOrders: number;
}
export interface SalesRowV23 extends SalesMetricV23 {
  date?: string;
  storeId?: string | null;
  storeName?: string;
  channel?: string;
  channelFamily?: string;
  sellerId?: string | null;
  sellerName?: string | null;
  accountId?: string | null;
  adId?: string | null;
  productId?: string;
  productVariantId?: string;
  productName?: string;
  attribution?: string;
  estimated?: boolean;
  sellerEstimated?: boolean;
}
export interface SalesSectionV23 {
  totals: SalesMetricV23;
  byStore: SalesRowV23[];
  byChannel: SalesRowV23[];
  bySeller: SalesRowV23[];
  byAd: SalesRowV23[];
  daily: SalesRowV23[];
}
export interface AdjustmentV23 {
  id: string;
  orderId: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  channel: string;
  channelFamily: string;
  sellerId: string | null;
  sellerName: string | null;
  accountId: string | null;
  adId: string | null;
  date: string;
  type: string;
  reason: string;
  amount: string | null;
  orderDelta: number;
  source: string;
}
export interface CodLeadRowV23 {
  storeId: string;
  date?: string;
  sellerId?: string | null;
  confirmedBy?: string | null;
  channel?: string;
  channelFamily?: string;
  accountId?: string | null;
  adId?: string | null;
  leads: number;
  converted: number;
  conversionRate: number | null;
}
export interface AdsSalesV23
  extends Omit<AdsSales, keyof SalesSectionV23 | "byProduct" | "shopifyCod">,
    SalesSectionV23 {
  asOf: string;
  byProduct: SalesRowV23[];
  deliveredActivity: SalesSectionV23 & {
    basis: "delivery-event-date";
    availability?: "partial" | "complete";
    missingDatesByStore?: Array<{ storeId: string; orders: number }>;
  };
  shopifyCod:
    | (SalesSectionV23 & {
        enabled: boolean;
        storeIds: string[];
        leads: number;
        converted: number;
        conversionRate: number | null;
        leadsDaily: CodLeadRowV23[];
        leadsByChannel: CodLeadRowV23[];
        leadsBySeller: CodLeadRowV23[];
        byAssignedSeller: CodLeadRowV23[];
      })
    | null;
  adjustments: AdjustmentV23[];
  warnings: string[];
  definitions: Record<string, string>;
}

/** Sales remain unallocated: the UI retains measured IDs and allocates only the residual pool. */
export async function getAdsSalesV23(
  identity: AdsIdentity,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AdsSalesV23> {
  return (
    await axios.get<AdsSalesV23>(
      `${advertisingOrdersApiBase()}/advertising/companies/${encodeURIComponent(identity.companyId)}/v23`,
      {
        ...adsOptions(identity.token, signal),
        params: { from, to, storeId: "all", timeZone: "America/Lima" },
      },
    )
  ).data;
}
export async function getNumbersV23(
  identity: AdsIdentity,
  from: string,
  to: string,
  signal?: AbortSignal,
) {
  const [summary, sales] = await Promise.all([
    adsGet<AdsSummaryV23>(identity, "/v23/summary", { from, to, storeId: "all" }, signal),
    getAdsSalesV23(identity, from, to, signal),
  ]);
  if (summary.from !== from || summary.to !== to || sales.from !== from || sales.to !== to)
    throw new Error("Los datos recibidos corresponden a otro período.");
  return { summary, sales };
}
