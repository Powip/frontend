import axios from "axios";
import { AdvertisingApiError, advertisingApiBase } from "./advertisingService";

export type MetaCatalogLevel = "campaign" | "adset" | "ad";
export interface MetaCoverage {
  status: "complete" | "partial" | "pending";
  coveredDays: number;
  totalDays: number;
  provisionalDays: number;
  lastSuccessfulAt: string | null;
  lastErrorCode: string | null;
}
export interface MetaAction {
  actionType: string;
  value: string;
}
export interface MetaInsights {
  spend: string | null;
  impressions: string | null;
  clicks: string | null;
  actions: MetaAction[] | null;
  coverage: MetaCoverage;
}
export interface MetaCatalogRow {
  id: string;
  accountId: string;
  campaignId: string | null;
  adsetId: string | null;
  level: MetaCatalogLevel;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  objective: string | null;
  currency: string;
  timeZone: string;
  insights: MetaInsights;
}
export interface MetaModuleCapabilities {
  canRead: boolean;
  canSync: boolean;
  canManageAds: boolean;
  reason: string | null;
}
export interface MetaCatalogAccount {
  id: string;
  externalId: string;
  name: string;
  currency: string;
  timeZone: string;
  enabled: boolean;
  catalogUpdatedAt: string | null;
  manageUrl: string;
  coverage: MetaCoverage;
  historyImport: MetaModuleJob | null;
}
export interface MetaModuleJob {
  accountId: string;
  status: "pending" | "running" | "retrying" | "succeeded" | "failed" | "paused";
  availableFrom: string | null;
  availableTo: string | null;
  nextTo: string | null;
  completedWindows: number;
  totalWindows: number | null;
  retryCount: number;
  errorCode: string | null;
  updatedAt: string;
}
export interface MetaAttribution {
  windows: string[];
  reportTime: "impression";
  source: "meta";
}
export interface MetaCatalogResponse {
  source: "meta";
  from: string;
  to: string;
  capabilities: MetaModuleCapabilities;
  attribution: MetaAttribution;
  accounts: MetaCatalogAccount[];
  rows: MetaCatalogRow[];
  pagination: { page: number; pageSize: number; total: number; hasMore: boolean };
}
export interface MetaCatalogFilters {
  from: string;
  to: string;
  level: MetaCatalogLevel;
  accountId?: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  currency?: string;
  sortBy?: "spend" | "clicks" | "impressions";
  sortOrder?: "asc" | "desc";
  page: number;
  pageSize: number;
}
export interface MetaAdDetailResponse {
  source: "meta";
  from: string;
  to: string;
  capabilities: MetaModuleCapabilities;
  attribution: MetaAttribution;
  account: MetaCatalogAccount;
  row: MetaCatalogRow;
  daily: Array<{
    date: string;
    spend: string | null;
    impressions: string | null;
    clicks: string | null;
    actions: MetaAction[] | null;
    provisional: boolean;
    coverage: "complete" | "pending";
  }>;
}
export interface MetaModuleSyncResponse {
  jobs: MetaModuleJob[];
  runs: Array<{
    accountId: string;
    from: string;
    to: string;
    status: "succeeded" | "failed" | "busy" | "paused";
    errorCode?: string;
  }>;
}

function metaUrl(companyId: string) {
  return `${advertisingApiBase()}/advertising/companies/${encodeURIComponent(companyId)}/meta`;
}
function options(token: string, signal?: AbortSignal, timeout = 30_000) {
  if (!token || token.length > 16_384 || /\s/.test(token))
    throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
  return { headers: { Authorization: `Bearer ${token}` }, withCredentials: false, signal, timeout };
}

export async function getMetaCatalog(
  token: string,
  companyId: string,
  filters: MetaCatalogFilters,
  signal?: AbortSignal,
): Promise<MetaCatalogResponse> {
  const result = await axios.get<MetaCatalogResponse>(`${metaUrl(companyId)}/catalog`, {
    ...options(token, signal),
    params: filters,
  });
  return result.data;
}

export async function getMetaAdDetail(
  token: string,
  companyId: string,
  adId: string,
  filters: { from: string; to: string; accountId: string },
  signal?: AbortSignal,
): Promise<MetaAdDetailResponse> {
  const result = await axios.get<MetaAdDetailResponse>(
    `${metaUrl(companyId)}/ads/${encodeURIComponent(adId)}`,
    { ...options(token, signal), params: filters },
  );
  return result.data;
}

export async function syncMetaModule(
  token: string,
  companyId: string,
  filters: { from: string; to: string; accountId?: string },
): Promise<MetaModuleSyncResponse> {
  const result = await axios.post<MetaModuleSyncResponse>(
    `${metaUrl(companyId)}/module-sync`,
    filters,
    options(token, undefined, 180_000),
  );
  return result.data;
}
