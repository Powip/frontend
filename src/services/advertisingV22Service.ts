import axios from "axios";
import { advertisingApiBase, AdvertisingApiError } from "./advertisingService";
import { advertisingOrdersApiBase } from "./advertisingOrdersService";
import type {
  MetaCatalogResponse,
  MetaCatalogRow,
  MetaAdDetailResponse,
  MetaCatalogFilters,
} from "./advertisingMetaService";

export interface AdsPermissions {
  view: boolean;
  spend: boolean;
  profit: boolean;
  edit: boolean;
  configure?: boolean;
}
export interface AdsRules {
  noResultsDays: number;
  minSpend: string;
  nearLimitPct: number;
  highFrequency: number;
  winPct: number;
  testMultiplier: number;
  testMinSales: number;
}
export interface AdsSettings {
  version: number;
  rules: AdsRules;
  budgets: Array<{ storeId: string; month: string; amount: string }>;
  whatsapp: { enabled: boolean; time: string; numbers: string[]; includes: string[] };
  permissions: Array<AdsPermissions & { role: "admin" | "supervisor" | "seller" | "advertiser" }>;
  tags: {
    hooks: Array<{ id: string; name: string }>;
    creators: Array<{ id: string; name: string }>;
  };
  capabilities: AdsPermissions;
}
export interface AdProduct {
  adId: string;
  accountId: string;
  storeId?: string | null;
  productId: string | null;
  origin: string;
  hookId?: string | null;
  creatorId?: string | null;
}
export interface AdsProduct {
  id: string;
  name: string;
  storeId: string;
  sku?: string;
  externalId?: string;
  handle?: string;
  imageUrl?: string | null;
  netPrice: string | null;
  unitCost: string | null;
  availableStock: string;
  variants: Array<{ id: string; netPrice: string | null; unitCost: string | null }>;
}
export interface AdsDay {
  date: string;
  accountId: string;
  adId: string;
  adsetId: string;
  campaignId: string;
  storeId: string | null;
  channel: "messages" | "web" | "other";
  currency: string;
  spend: string | null;
  results: number | null;
  impressions: string | null;
  linkClicks: string | null;
  provisional: boolean;
}
export interface AdsSummary {
  source: string;
  from: string;
  to: string;
  today: string;
  timeZone: string;
  currency: string;
  stores: Array<{ id: string; name: string }>;
  channels: Array<{ id: string; storeId: string; type: string; label: string }>;
  days: AdsDay[];
  unassignedSpend: string | null;
  settings: AdsSettings;
  adProducts: AdProduct[];
  quality: {
    warnings: string[];
    coverage?: "complete" | "partial" | "pending";
    spendAvailable?: boolean;
  };
}
export interface SalesMetric {
  orders: number;
  units: number;
  confirmed: number;
  delivered: number;
  inTransit: number;
  deliveredUnits: number;
  cancelled: number;
  billedRevenue: string;
  productCost: string | null;
  shippingCost: string | null;
  eligibleRevenue: string;
  eligibleProductCost: string | null;
  eligibleShippingCost: string | null;
  inTransitUnits?: number;
  eligibleDelivered?: number;
  billedUnits?: number;
  eligibleBilledUnits?: number;
  eligibleDeliveredUnits?: number;
  inTransitRevenue?: string | null;
  inTransitProductCost?: string | null;
  inTransitShippingCost?: string | null;
  missingCostOrders: number;
  attributedOrders: number;
}
export type SalesGroup = SalesMetric & {
  accountId?: string | null;
  storeId?: string | null;
  channel?: "messages" | "web" | "other";
  productId?: string;
  productVariantId?: string;
  adId?: string | null;
  date?: string;
};
export interface AdsSales {
  source: string;
  from: string;
  to: string;
  currency: string;
  totals: SalesMetric;
  byStore: SalesGroup[];
  byChannel: SalesGroup[];
  byProduct: SalesGroup[];
  byAd: SalesGroup[];
  daily: SalesGroup[];
  hourly?: Array<{ date: string; hour: number; storeId: string; channel: string; orders: number }>;
  deliveryHistory: Array<{ storeId: string; deliveryRate: number | null }>;
  productVelocity: Array<{ storeId: string; productId: string; unitsPerDay: number }>;
  quality: { warnings?: string[]; legacyStoreCount?: number; [key: string]: unknown };
}
export interface AdsSavedView {
  id: string;
  name: string;
  icon: string;
  state: Record<string, string>;
}
export interface AdsTest {
  id: string;
  accountId?: string;
  productId: string;
  storeId: string;
  adIds: string[];
  adsetId?: string | null;
  startAt: string;
  status: "active" | "scaled" | "discarded";
  decidedAt?: string | null;
}

export async function decideAdsTest(
  identity: AdsIdentity,
  test: AdsTest,
  row: AdsRow,
  action: "scale" | "discard",
  method: "budget" | "duplicate",
  targetCampaignId: string,
  requestId: string,
) {
  if (!test.adsetId) throw new Error("La prueba no tiene un conjunto asociado.");
  const current = row.budget?.dailyBudget;
  if (action === "scale" && (numericBudget(current) === null || numericBudget(current)! <= 0))
    throw new Error("Actualiza el presupuesto del conjunto antes de escalar.");
  const result = await adsWrite<{ status: string }>(identity, "post", "/meta/v22/actions", {
    requestId,
    accountId: test.accountId ?? row.accountId,
    objectId: test.adsetId,
    level: "adset",
    action: action === "discard" ? "status" : method,
    ...(action === "discard"
      ? { status: "PAUSED" }
      : {
          budget: (numericBudget(current)! * (method === "duplicate" ? 1 : 1.3)).toFixed(2),
          ...(method === "duplicate"
            ? { targetCampaignId, pauseOriginal: false, copyStatus: "INHERITED_FROM_SOURCE" }
            : {}),
        }),
  });
  if (result.status !== "succeeded")
    throw new Error("Meta no confirmó el cambio. Revisa el historial antes de decidir la prueba.");
  return adsWrite(identity, "patch", `/v22/tests/${test.id}`, {
    requestId,
    action,
    ...(action === "scale" ? { method } : {}),
  });
}
function numericBudget(value: string | null | undefined) {
  return value != null && /^\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value))
    ? Number(value)
    : null;
}
export interface AdsCreative {
  format?: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  videoId?: string | null;
  body?: string | null;
  title?: string | null;
  cta?: string | null;
  callToActionType?: string | null;
  name?: string | null;
  duration?: number | null;
  assetCount?: number;
}
export interface AdsBudget {
  level: "campaign" | "adset";
  objectId: string;
  dailyBudget?: string | null;
  lifetimeBudget?: string | null;
  amount?: string | null;
  updatedAt?: string | null;
  increasedAt?: string | null;
  affectedAds?: number;
  historyComplete?: boolean;
  noRecentIncrease?: boolean;
}
export type AdsLevel = "store" | "account" | "campaign" | "adset" | "ad";
export type AdsRow = Omit<MetaCatalogRow, "level" | "insights"> & {
  level: AdsLevel;
  destinationType?: string | null;
  destinations?: Array<{ type: string; identifier: string | null; externalId?: string | null }>;
  pausedAt?: string | null;
  pausedInPeriod?: boolean;
  creative?: AdsCreative | null;
  budget?: AdsBudget | null;
  createdTime?: string | null;
  createdAt?: string | null;
  parentAdId?: string | null;
  daysActive?: number | null;
  firstDeliveryDate?: string | null;
  fatigueAt?: string | null;
  lifetimeDays?: number | null;
  observationStartedAt?: string | null;
  stockDays?: number | null;
  recentCostStable?: boolean | null;
  ctrDecline?: number | null;
  insights: MetaCatalogRow["insights"] & {
    cpm?: string | null;
    ctrAll?: string | null;
    ctrUnique?: string | null;
    ctrOutbound?: string | null;
    video3s?: string | null;
    thruplay?: string | null;
    videoThruplay?: string | null;
    videoP25?: string | null;
    videoP50?: string | null;
    videoP75?: string | null;
    videoP95?: string | null;
    videoP100?: string | null;
    avgWatch?: string | null;
    conversionRate?: number | null;
  };
};
export type AdsCatalog = Omit<MetaCatalogResponse, "rows"> & { rows: AdsRow[] };
export type AdsDetail = Omit<MetaAdDetailResponse, "row"> & {
  row: AdsRow;
  creative?: AdsCreative;
  budget?: AdsBudget;
  variations?: AdsRow[];
  changes?: AdsChange[];
};
export interface AdsChange {
  id?: string;
  createdAt?: string;
  date?: string;
  actor?: string;
  source?: string;
  action?: string;
  objectId?: string;
  before?: unknown;
  after?: unknown;
  description?: string;
}
export interface AdsIdentity {
  token: string;
  companyId: string;
}
export function adsOptions(token: string, signal?: AbortSignal) {
  if (!token || /\s/.test(token)) throw new AdvertisingApiError("Vuelve a iniciar sesión.", 401);
  return {
    headers: { Authorization: `Bearer ${token}` },
    withCredentials: false,
    timeout: 60_000,
    signal,
  };
}
export function adsUrl(companyId: string) {
  return `${advertisingApiBase()}/advertising/companies/${encodeURIComponent(companyId)}`;
}
export async function adsGet<T>(
  identity: AdsIdentity,
  path: string,
  params?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  return (
    await axios.get<T>(`${adsUrl(identity.companyId)}${path}`, {
      ...adsOptions(identity.token, signal),
      params,
    })
  ).data;
}
export async function adsWrite<T>(
  identity: AdsIdentity,
  method: "post" | "put" | "patch" | "delete",
  path: string,
  body?: unknown,
): Promise<T> {
  return (
    await axios.request<T>({
      method,
      url: `${adsUrl(identity.companyId)}${path}`,
      data: body,
      ...adsOptions(identity.token),
    })
  ).data;
}
export async function getAdsSales(
  identity: AdsIdentity,
  from: string,
  to: string,
  storeId: string,
  signal?: AbortSignal,
): Promise<AdsSales> {
  return (
    await axios.get<AdsSales>(
      `${advertisingOrdersApiBase()}/advertising/companies/${encodeURIComponent(identity.companyId)}/v22`,
      {
        ...adsOptions(identity.token, signal),
        params: { from, to, storeId, timeZone: "America/Lima" },
      },
    )
  ).data;
}
export function getAdsCatalog(
  identity: AdsIdentity,
  filters: MetaCatalogFilters,
  signal?: AbortSignal,
) {
  return adsGet<AdsCatalog>(identity, "/meta/v22/catalog", { ...filters }, signal);
}
export async function getAllAdsCatalog(
  identity: AdsIdentity,
  filters: Omit<MetaCatalogFilters, "page" | "pageSize" | "level"> & { level: AdsLevel },
  signal?: AbortSignal,
): Promise<AdsCatalog> {
  let result = await getAdsCatalog(
    identity,
    { ...filters, page: 1, pageSize: 100 } as MetaCatalogFilters,
    signal,
  );
  const rows = [...result.rows];
  let page = 1;
  while (result.pagination.hasMore) {
    if (++page > 100)
      throw new Error("El catálogo es demasiado grande. Acota el período o la cuenta.");
    result = await getAdsCatalog(
      identity,
      { ...filters, page, pageSize: 100 } as MetaCatalogFilters,
      signal,
    );
    rows.push(...result.rows);
  }
  return {
    ...result,
    rows,
    pagination: { page: 1, pageSize: rows.length, total: rows.length, hasMore: false },
  };
}
export function saveAdsSettings(identity: AdsIdentity, settings: AdsSettings) {
  const { capabilities: _capabilities, version, ...body } = settings;
  return adsWrite<AdsSettings>(identity, "put", "/v22/settings", {
    ...body,
    expectedVersion: version,
  });
}
