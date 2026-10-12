import axios from "axios";
import { AdvertisingApiError, advertisingApiBase } from "./advertisingService";

export type AdvertisingAssignmentMode = "single" | "multi";
export type AdvertisingAssignmentApply = "all_history" | "from_today";
export type AdvertisingSeriesBy = "store" | "account" | "objective";
export interface AdvertisingDestinationSuggestion {
  storeId: string;
  reason: "destination-match" | "name-match";
}
export interface AdvertisingAdsetAssignment {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  storeId: string | null;
  version: number;
  spend: string | null;
  destinations: string[];
  suggestion: AdvertisingDestinationSuggestion | null;
  unresolvedChannelCount: number;
}
export interface AdvertisingAccountAssignmentV11 {
  id: string;
  externalId: string;
  name: string;
  currency: string;
  timeZone: string;
  mode: AdvertisingAssignmentMode;
  storeId: string | null;
  version: number;
  spend: string | null;
  status: "assigned" | "unassigned" | "partial";
  destinations: string[];
  adsets: AdvertisingAdsetAssignment[];
}
export interface AdvertisingAssignmentsV11 {
  from: string;
  to: string;
  today: string;
  capabilities: { canConfigure: boolean };
  stores: Array<{ id: string; name: string; color: string | null }>;
  channels: Array<{
    id: string;
    storeId: string;
    type: string;
    label: string;
    identifier: string | null;
    externalId: string | null;
  }>;
  accounts: AdvertisingAccountAssignmentV11[];
  pending: {
    adsetCount: number;
    byCurrency: Array<{ currency: string; spend: string }>;
    suggestionCount: number;
  };
}
export interface AdvertisingAccountAssignmentChange {
  mode: AdvertisingAssignmentMode;
  storeId: string | null;
  apply: AdvertisingAssignmentApply;
  expectedVersion: number;
  reason: string;
}
export interface AdvertisingAdsetAssignmentChange {
  accountId: string;
  storeId: string | null;
  apply: AdvertisingAssignmentApply;
  expectedVersion: number;
  reason: string;
}
export interface AdvertisingSuggestedAssignmentsChange {
  apply: AdvertisingAssignmentApply;
  reason: string;
  selections: Array<{
    accountId: string;
    adsetId: string;
    storeId: string;
    expectedVersion: number;
  }>;
}
export interface AdvertisingAssignmentChangeResult {
  accountId: string;
  adsetId?: string;
  version: number;
  mode?: AdvertisingAssignmentMode;
  storeId: string | null;
  effectiveFrom: string;
  apply: AdvertisingAssignmentApply;
}
export interface AdvertisingAssignmentHistoryV11 {
  accountId: string;
  adsetId: string | null;
  history: Array<{
    version: number;
    mode: AdvertisingAssignmentMode | null;
    storeId: string | null;
    effectiveFrom: string;
    apply: AdvertisingAssignmentApply;
    reason: string;
    changedAt: string;
    superseded: boolean;
  }>;
}
export interface AdvertisingSummaryResultMetric {
  type: "messages" | "webPurchases" | "linkClicks" | "leads" | "other";
  resultType?: string | null;
  source?: "reported-action" | "reported-field" | "unknown";
  limitation?: "optimization-event-unconfirmed" | "goal-result-unavailable" | null;
  label: string;
  count: string | null;
  costPerResult: string | null;
  status: "complete" | "partial" | "unknown";
}
export interface AdvertisingSummaryCurrencyV11 {
  currency: string;
  spend: string | null;
  coverage: "complete" | "partial" | "pending";
  costPerResult: AdvertisingSummaryResultMetric[];
  ctr: string | null;
  frequency: string | null;
  frequencyApproximate: boolean;
  frequencyHigh: boolean;
  unassignedSpend: string;
  costPerDelivered: string | null;
  timeZones: string[];
  spendSource: "effective";
  completeDates: string[];
  periodMetricsStatus: "available" | "unknown";
  metricsSource: "meta";
}
export interface AdvertisingSummaryAccountV11 {
  accountId: string;
  externalId: string;
  name: string;
  currency: string;
  timeZone: string;
  provider: "meta" | "tiktok";
  mode: AdvertisingAssignmentMode;
  storeId: string | null;
  spend: string | null;
  ctr: string | null;
  frequency: string | null;
  frequencyApproximate: boolean;
  costPerResult: AdvertisingSummaryResultMetric[];
  costPerDelivered: string | null;
}
export interface AdvertisingSummaryV11 {
  from: string;
  to: string;
  storeId: string;
  seriesBy: AdvertisingSeriesBy;
  currencies: AdvertisingSummaryCurrencyV11[];
  series: Array<{
    date: string;
    segment: { id: string; name: string; type: AdvertisingSeriesBy; color: string | null };
    currency: string;
    spend: string;
    coverage?: "complete" | "partial";
  }>;
  byAccount: AdvertisingSummaryAccountV11[];
  warnings: string[];
  channelDaily?: Array<{
    date: string;
    accountId: string;
    storeId: string | null;
    channelId: string | null;
    currency: string;
    spend: string;
    provisional: boolean;
    coverage: "complete" | "partial" | "pending";
  }>;
}
export interface AdvertisingSummaryV11Filters {
  from: string;
  to: string;
  storeId: string;
  accountId?: string;
  currency?: string;
  seriesBy: AdvertisingSeriesBy;
  provider?: "meta" | "tiktok";
}

function workspaceUrl(companyId: string) {
  return `${advertisingApiBase()}/advertising/companies/${encodeURIComponent(companyId)}/workspace`;
}
function options(token: string, signal?: AbortSignal) {
  if (!token || token.length > 16_384 || /\s/.test(token))
    throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
  return {
    headers: { Authorization: `Bearer ${token}` },
    withCredentials: false,
    signal,
    timeout: 30_000,
  };
}
export async function getAdvertisingAssignmentsV11(
  token: string,
  companyId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AdvertisingAssignmentsV11> {
  const response = await axios.get<AdvertisingAssignmentsV11>(
    `${workspaceUrl(companyId)}/assignments`,
    {
      ...options(token, signal),
      params: { from, to },
    },
  );
  return response.data;
}
export async function getAdvertisingSummaryV11(
  token: string,
  companyId: string,
  filters: AdvertisingSummaryV11Filters,
  signal?: AbortSignal,
): Promise<AdvertisingSummaryV11> {
  const response = await axios.get<AdvertisingSummaryV11>(`${workspaceUrl(companyId)}/summary`, {
    ...options(token, signal),
    params: filters,
  });
  return response.data;
}
export async function changeAdvertisingAccountStore(
  token: string,
  companyId: string,
  accountId: string,
  payload: AdvertisingAccountAssignmentChange,
): Promise<AdvertisingAssignmentChangeResult> {
  const response = await axios.patch<AdvertisingAssignmentChangeResult>(
    `${workspaceUrl(companyId)}/accounts/${encodeURIComponent(accountId)}/tienda`,
    payload,
    options(token),
  );
  return response.data;
}
export async function changeAdvertisingAdsetStore(
  token: string,
  companyId: string,
  adsetId: string,
  payload: AdvertisingAdsetAssignmentChange,
): Promise<AdvertisingAssignmentChangeResult> {
  const response = await axios.patch<AdvertisingAssignmentChangeResult>(
    `${workspaceUrl(companyId)}/adsets/${encodeURIComponent(adsetId)}/tienda`,
    payload,
    options(token),
  );
  return response.data;
}
export async function applyAdvertisingSuggestedAssignments(
  token: string,
  companyId: string,
  payload: AdvertisingSuggestedAssignmentsChange,
): Promise<unknown> {
  const response = await axios.post(
    `${workspaceUrl(companyId)}/assignments/apply-suggestions`,
    payload,
    options(token),
  );
  return response.data;
}
export async function getAdvertisingAssignmentHistoryV11(
  token: string,
  companyId: string,
  accountId: string,
  adsetId?: string,
  signal?: AbortSignal,
): Promise<AdvertisingAssignmentHistoryV11> {
  const response = await axios.get<AdvertisingAssignmentHistoryV11>(
    `${workspaceUrl(companyId)}/assignments/history`,
    {
      ...options(token, signal),
      params: { accountId, adsetId },
    },
  );
  return response.data;
}
