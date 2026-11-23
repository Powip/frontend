import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";

const BASE = `${API.crm}/crm/meta-ads`;

export type AudienceSegment = "bought_90d" | "lost_price" | "thinking" | "unpaid_link_7d";

export interface MetaAdsSettings {
  pixelId: string | null;
  effectivePixelId: string | null;
  capiEnabled: boolean;
  defaultAdAccountId: string | null;
  adsTokenConfigured: boolean;
  capiTokenConfigured: boolean;
  simulated: boolean;
}

export interface MetaAdsSettingsInput {
  pixelId?: string | null;
  capiEnabled?: boolean;
  defaultAdAccountId?: string | null;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string | null;
}

export interface AudienceSegmentItem {
  key: AudienceSegment;
  label: string;
  hint: string;
  count: number;
  lastSentAt: string | null;
}

export interface ExportAudienceInput {
  segment: AudienceSegment;
  adAccountId: string;
  name: string;
  storeId?: string;
}

export interface ExportAudienceResult {
  id: string;
  metaAudienceId: string;
  contactCount: number;
  received: number;
  simulated: boolean;
}

export interface AudienceExportItem {
  id: string;
  segment: AudienceSegment;
  storeId: string | null;
  adAccountId: string;
  name: string;
  contactCount: number;
  metaAudienceId: string | null;
  status: "sent" | "failed";
  lastError: string | null;
  userEmail: string | null;
  createdAt: string;
}

export interface CapiEventItem {
  id: string;
  conversationId: string | null;
  orderNumber: string | null;
  value: number;
  currency: string;
  status: "pending" | "sent" | "failed" | "skipped";
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface ConversationAdSignal {
  fromAd: boolean;
  ad: { headline: string | null; sourceId: string | null; sourceType: string | null; at: string } | null;
  purchases: Array<{
    orderNumber: string | null;
    value: number;
    currency: string;
    status: CapiEventItem["status"];
    sentAt: string | null;
    lastError: string | null;
  }>;
}

/** Solo administrador (403 si no). */
export async function getMetaAdsSettings(): Promise<MetaAdsSettings> {
  return (await axiosAuth.get<MetaAdsSettings>(`${BASE}/settings`)).data;
}

export async function updateMetaAdsSettings(input: MetaAdsSettingsInput): Promise<MetaAdsSettings> {
  return (await axiosAuth.put<MetaAdsSettings>(`${BASE}/settings`, input)).data;
}

/** Cuentas publicitarias que ve el token de .env (META_ADS_ACCESS_TOKEN). */
export async function listMetaAdAccounts(): Promise<{ items: MetaAdAccount[]; simulated: boolean }> {
  return (await axiosAuth.get<{ items: MetaAdAccount[]; simulated: boolean }>(`${BASE}/ad-accounts`)).data;
}

export async function listAudienceSegments(storeId?: string): Promise<AudienceSegmentItem[]> {
  const params = storeId ? { storeId } : undefined;
  return (await axiosAuth.get<{ items: AudienceSegmentItem[] }>(`${BASE}/segments`, { params })).data.items;
}

export async function exportAudience(input: ExportAudienceInput): Promise<ExportAudienceResult> {
  return (await axiosAuth.post<ExportAudienceResult>(`${BASE}/audiences`, input)).data;
}

export async function listAudienceExports(): Promise<AudienceExportItem[]> {
  return (await axiosAuth.get<{ items: AudienceExportItem[] }>(`${BASE}/audiences`)).data.items;
}

export async function listCapiEvents(): Promise<CapiEventItem[]> {
  return (await axiosAuth.get<{ items: CapiEventItem[] }>(`${BASE}/capi-events`)).data.items;
}

/** Cualquier nivel del CRM: «Señal a Meta» de un chat. */
export async function getConversationAdSignal(conversationId: string): Promise<ConversationAdSignal> {
  return (await axiosAuth.get<ConversationAdSignal>(`${BASE}/conversations/${conversationId}/signal`)).data;
}

export interface AdResultItem {
  adId: string | null;
  adName: string;
  campaignName: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  chats: number;
  orders: number;
  revenue: number;
  costPerChat: number | null;
  costPerOrder: number | null;
  roas: number | null;
}

export interface AdResults {
  from: string;
  to: string;
  adAccountId: string | null;
  currency: string | null;
  attributionDays: number;
  simulated: boolean;
  spendError: string | null;
  totals: {
    spend: number | null;
    chats: number;
    orders: number;
    revenue: number;
    costPerChat: number | null;
    costPerOrder: number | null;
    roas: number | null;
  };
  items: AdResultItem[];
}

/** Solo administrador: gasto de Meta por anuncio + chats, pedidos y ventas del CRM. */
export async function getAdResults(params: { from: string; to: string; adAccountId?: string }): Promise<AdResults> {
  return (await axiosAuth.get<AdResults>(`${BASE}/results`, { params })).data;
}
