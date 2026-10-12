import axios from "axios";
import { AdvertisingApiError, advertisingApiBase } from "./advertisingService";

export interface AdvertisingShare {
  storeId: string;
  channel: string | null;
  basisPoints: number;
}
export interface AdvertisingAssignment {
  accountId: string;
  version: number;
  effectiveFrom: string;
  shares: AdvertisingShare[];
}
export interface AdvertisingRule {
  id: string;
  version: number;
  name: string;
  accountId: string | null;
  currency: string;
  threshold: string;
  enabled: boolean;
}
export interface AdvertisingWorkspace {
  from: string;
  to: string;
  today: string;
  capabilities: { canConfigure: boolean };
  accounts: Array<{
    id: string;
    currency: string;
    name: string;
    externalId: string;
    timeZone: string;
    enabled: boolean;
  }>;
  stores: Array<{ id: string; name: string }>;
  channels: string[];
  assignments: AdvertisingAssignment[];
  allocated: {
    coverage: Array<{
      currency: string;
      coverage: "complete" | "partial" | "pending";
      missingAccountDays: number;
      provisional: boolean;
    }>;
    rows: Array<{
      accountId: string;
      storeId: string;
      channel: string | null;
      date: string;
      currency: string;
      amount: string;
    }>;
    totals: Array<{ storeId: string; channel: string | null; currency: string; amount: string }>;
    unassigned: Array<{ accountId: string; currency: string; amount: string }>;
  };
  rules: AdvertisingRule[];
  alerts: Array<{
    id: string;
    kind: "coverage" | "auth" | "threshold" | "unassigned-store";
    code?: "UNASSIGNED_SPEND_OVER_24H" | string;
    adsetId?: string | null;
    amountSource?: "meta-imported";
    accountId: string | null;
    title: string;
    message: string;
    currency: string | null;
    amount: string | null;
  }>;
  plans: Array<{
    id: string;
    name: string;
    from: string;
    to: string;
    currency: string;
    budget: string;
    simulation: true;
    targets: Array<{ accountId: string; basisPoints: number }>;
    dailyBudget: string;
    allocations: Array<{ accountId: string; amount: string }>;
  }>;
}
export interface AdvertisingAssignmentPayload {
  expectedVersion: number;
  effectiveFrom: string;
  shares: AdvertisingShare[];
  reason: string;
}
export interface AdvertisingRulePayload {
  name: string;
  accountId: string | null;
  currency: string;
  threshold: string;
  enabled: boolean;
  expectedVersion: number;
}
export interface AdvertisingPlanPayload {
  name: string;
  from: string;
  to: string;
  currency: string;
  budget: string;
  targets: Array<{ accountId: string; basisPoints: number }>;
}

function url(companyId: string) {
  return `${advertisingApiBase()}/advertising/companies/${encodeURIComponent(companyId)}/workspace`;
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
export async function getAdvertisingWorkspace(
  token: string,
  companyId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AdvertisingWorkspace> {
  const result = await axios.get<AdvertisingWorkspace>(url(companyId), {
    ...options(token, signal),
    params: { from, to },
  });
  return result.data;
}
export async function saveAdvertisingAssignment(
  token: string,
  companyId: string,
  accountId: string,
  payload: AdvertisingAssignmentPayload,
) {
  const result = await axios.put(
    `${url(companyId)}/accounts/${encodeURIComponent(accountId)}/assignment`,
    payload,
    options(token),
  );
  return result.data;
}
export async function saveAdvertisingRule(
  token: string,
  companyId: string,
  ruleId: string | null,
  payload: AdvertisingRulePayload,
) {
  const result = ruleId
    ? await axios.put(
        `${url(companyId)}/rules/${encodeURIComponent(ruleId)}`,
        payload,
        options(token),
      )
    : await axios.post(`${url(companyId)}/rules`, payload, options(token));
  return result.data;
}
export async function evaluateAdvertisingAlerts(
  token: string,
  companyId: string,
  from: string,
  to: string,
) {
  const result = await axios.post(`${url(companyId)}/evaluate`, { from, to }, options(token));
  return result.data;
}
export async function saveAdvertisingPlan(
  token: string,
  companyId: string,
  payload: AdvertisingPlanPayload,
) {
  const result = await axios.post(`${url(companyId)}/plans`, payload, options(token));
  return result.data;
}
