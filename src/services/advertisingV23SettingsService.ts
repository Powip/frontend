import { adsGet, adsWrite, type AdsIdentity, type AdsPermissions } from "./advertisingV22Service";
export type AssignmentChannel = "wa" | "ig" | "messenger" | "web" | "shopify_cod";
export interface AdsetAssignment {
  accountId: string;
  adsetId: string;
  storeId: string;
  channel: AssignmentChannel;
  sellerId: string | null;
  sellerMode: "none" | "fixed" | "by_leads";
  origin: "manual" | "suggested";
  effectiveFrom: string;
  apply: "from_date" | "all_history";
  version: number;
}
export interface CodStoreSetting {
  storeId: string;
  storeName: string;
  version: number;
  enabled: boolean;
  app: "releasit" | "easysell" | "other";
  appName: string;
  source: string;
  connection: "connected" | "flow_disabled" | "leads_schema_missing" | "disconnected";
  leadsToday: number | null;
  lastLeadAt: string | null;
}
export interface V23Settings {
  assignments: AdsetAssignment[];
  adsets: Array<{
    accountId: string;
    accountName: string;
    adsetId: string;
    name: string;
    campaignId: string;
    campaignName: string;
    destinationType: string | null;
    destinations: Array<{ type: string; identifier: string | null; label?: string }>;
    effectiveStatus: string | null;
    currentStoreId: string | null;
  }>;
  stores: Array<{ id: string; name: string }>;
  channels: Array<{ id: string; storeId: string; type: string; label: string }>;
  sellers: Array<{ id: string; name: string }>;
  shopifyCod: CodStoreSetting[];
  capabilities: AdsPermissions;
  today: string;
}
export const getV23Settings = (identity: AdsIdentity, signal?: AbortSignal) =>
  adsGet<V23Settings>(identity, "/v23/settings", undefined, signal);
export const saveAdsetAssignment = (
  identity: AdsIdentity,
  value: Omit<AdsetAssignment, "version"> & { expectedVersion: number },
) => adsWrite<V23Settings>(identity, "put", "/v23/assignments", value);
export const saveCodSetting = (
  identity: AdsIdentity,
  value: Pick<CodStoreSetting, "storeId" | "enabled" | "app" | "appName"> & {
    expectedVersion: number;
  },
) => adsWrite<V23Settings>(identity, "put", "/v23/shopify-cod", value);
export function suggestAdsetChannel(
  row: Pick<V23Settings["adsets"][number], "destinations" | "destinationType">,
): AssignmentChannel | null {
  const mapping: Record<string, AssignmentChannel> = {
    WHATSAPP: "wa",
    INSTAGRAM: "ig",
    FACEBOOK: "messenger",
    MESSENGER: "messenger",
    WEB: "web",
    SHOPIFY: "web",
    WEBSITE: "web",
  };
  const types = [...new Set(row.destinations.map((d) => mapping[d.type]).filter(Boolean))];
  return types.length === 1
    ? types[0]
    : types.length === 0 && row.destinationType
      ? (mapping[row.destinationType] ?? null)
      : null;
}
