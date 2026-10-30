import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import type { WhatsAppRuleKey, WhatsAppRuleWhenMode } from "../enums/whatsapp.enums";
import type { WhatsAppMoneyEstimate } from "../models/money.model";
import type {
  WhatsAppRuleReminder,
  WhatsAppRuleScope,
  WhatsAppRuleStats,
  WhatsAppRuleUpdate,
  WhatsAppRuleWhen,
} from "../models/rule.model";

export type WhatsAppRuleBlockedReasonCode = "NOT_CONNECTED" | "TEMPLATE_NOT_APPROVED";

/** Ítem de C-16 tal como lo devuelve el backend. */
export interface WhatsAppRuleDto {
  id: string;
  key: WhatsAppRuleKey;
  label: string;
  triggerLabel: string | null;
  templateId: string | null;
  active: boolean;
  blockedReason: WhatsAppRuleBlockedReasonCode | null;
  when: WhatsAppRuleWhen;
  allowedWhenModes: WhatsAppRuleWhenMode[];
  reminder: WhatsAppRuleReminder | null;
  scope: WhatsAppRuleScope;
  stats: WhatsAppRuleStats | null;
  activatedAt: string | null;
  version: number;
}

export interface WhatsAppRulesDto {
  items: WhatsAppRuleDto[];
  summary: { activeCount: number; estimatedMonthly: WhatsAppMoneyEstimate | null };
}

const RULES_URL = `${API.integrations}/wa/rules`;
const ruleUrl = (ruleId: string) => `${RULES_URL}/${encodeURIComponent(ruleId)}`;

// C-16 · GET /wa/rules?storeId=
export async function getWhatsAppRules(storeId: string): Promise<WhatsAppRulesDto> {
  assertWhatsAppContractAvailable("rules");
  const { data } = await axiosAuth.get<WhatsAppRulesDto>(RULES_URL, { params: { storeId } });
  return data;
}

// C-16 · PUT /wa/rules/:id con If-Match
export async function updateWhatsAppRule(
  ruleId: string,
  version: number,
  body: WhatsAppRuleUpdate,
): Promise<WhatsAppRuleDto> {
  assertWhatsAppContractAvailable("rules");
  const { data } = await axiosAuth.put<WhatsAppRuleDto>(ruleUrl(ruleId), body, {
    headers: { "If-Match": String(version) },
  });
  return data;
}

// C-16 · POST /wa/rules/:id/activate con If-Match e Idempotency-Key (C-00.7)
export async function activateWhatsAppRule(
  ruleId: string,
  version: number,
  includeExisting: boolean,
): Promise<{ active: boolean; enqueued: number; rule: WhatsAppRuleDto }> {
  assertWhatsAppContractAvailable("rules");
  const { data } = await axiosAuth.post(
    `${ruleUrl(ruleId)}/activate`,
    { includeExisting },
    { headers: { "If-Match": String(version), "Idempotency-Key": crypto.randomUUID() } },
  );
  return data;
}

// C-16 · POST /wa/rules/:id/deactivate
export async function deactivateWhatsAppRule(
  ruleId: string,
  version: number,
): Promise<{ active: boolean; rule: WhatsAppRuleDto }> {
  assertWhatsAppContractAvailable("rules");
  const { data } = await axiosAuth.post(`${ruleUrl(ruleId)}/deactivate`, undefined, {
    headers: { "If-Match": String(version), "Idempotency-Key": crypto.randomUUID() },
  });
  return data;
}