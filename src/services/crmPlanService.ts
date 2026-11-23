import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";

const PLAN = `${API.crm}/crm/plan`;
const CHANNELS = `${API.crm}/crm/channels`;

export type CrmAccountType = "core" | "solo";

/** Plan del CRM con precios del .env de ms-crm. Solo muestra precios; no cobra. */
export interface CrmPlanQuote {
  pauOn: boolean;
  accountType: CrmAccountType;
  domain: string;
  currency: string;
  prices: { crm: number; pau: number; bundle: number; extraSeat: number };
  bundleSavings: number;
  seats: { used: number; included: number; extra: number };
  basePrice: number;
  monthlyTotal: number;
}

export interface UpdateCrmPlanInput {
  pauOn?: boolean;
  accountType?: CrmAccountType;
}

export interface ChannelAccount {
  id: string;
  channel: string;
  accountId: string;
  name: string | null;
  storeId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface UpdateChannelAccountInput {
  name?: string;
  storeId?: string | null;
}

export async function getCrmPlan(): Promise<CrmPlanQuote> {
  return (await axiosAuth.get<CrmPlanQuote>(PLAN)).data;
}

export async function updateCrmPlan(input: UpdateCrmPlanInput): Promise<CrmPlanQuote> {
  return (await axiosAuth.patch<CrmPlanQuote>(PLAN, input)).data;
}

export async function listChannelAccounts(): Promise<ChannelAccount[]> {
  return (await axiosAuth.get<ChannelAccount[]>(CHANNELS)).data;
}

export async function updateChannelAccount(
  id: string,
  input: UpdateChannelAccountInput,
): Promise<ChannelAccount & { movedConversations?: number }> {
  return (await axiosAuth.patch(`${CHANNELS}/${id}`, input)).data;
}

export async function disconnectChannelAccount(id: string): Promise<ChannelAccount> {
  return (await axiosAuth.post<ChannelAccount>(`${CHANNELS}/${id}/disconnect`)).data;
}

export async function reconnectChannelAccount(id: string): Promise<ChannelAccount> {
  return (await axiosAuth.post<ChannelAccount>(`${CHANNELS}/${id}/reconnect`)).data;
}
