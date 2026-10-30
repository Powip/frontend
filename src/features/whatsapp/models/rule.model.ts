import type {
  WhatsAppRuleDateMode,
  WhatsAppRuleKey,
  WhatsAppRuleWhenMode,
} from "../enums/whatsapp.enums";
import type { WhatsAppMoneyEstimate } from "./money.model";

export interface WhatsAppRuleWhen {
  mode: WhatsAppRuleWhenMode;
  minutes: number | null;
  time: string | null;
  hours: number | null;
}

export interface WhatsAppRuleScope {
  dateMode: WhatsAppRuleDateMode;
  from: string | null;
  to: string | null;
  maxOrderAgeDays: number;
  storeIds: string[];
  salesChannels: string[];
  shippingTypes: string[];
  courierIds: string[];
}

export interface WhatsAppRuleReminder {
  enabled: boolean;
  hours: number;
}

export interface WhatsAppRuleStats {
  sentToday: number | null;
  estimatedMonthly: WhatsAppMoneyEstimate | null;
}

export interface WhatsAppRule {
  id: string;
  key: WhatsAppRuleKey;
  label: string;
  triggerLabel: string | null;
  templateId: string | null;
  active: boolean;
  blockedReason: string | null;
  when: WhatsAppRuleWhen;
  allowedWhenModes: WhatsAppRuleWhenMode[];
  reminder: WhatsAppRuleReminder | null;
  scope: WhatsAppRuleScope;
  stats: WhatsAppRuleStats | null;
  activatedAt: Date | null;
  version: number;
}

export interface WhatsAppRulesSummary {
  activeCount: number;
  estimatedMonthly: WhatsAppMoneyEstimate | null;
}

export interface WhatsAppRulesData {
  rules: WhatsAppRule[];
  summary: WhatsAppRulesSummary;
}

export interface WhatsAppRulePreview {
  matchingOrders: number;
  orderStateLabel: string | null;
  estimatedCost: WhatsAppMoneyEstimate | null;
  computedAt: Date;
}

/** Lo que se manda en PUT /wa/rules/:id (C-16). */
export interface WhatsAppRuleUpdate {
  templateId: string | null;
  when: WhatsAppRuleWhen;
  reminder: WhatsAppRuleReminder | null;
  scope: WhatsAppRuleScope;
}

export type WhatsAppRuleMutationResult =
  | { ok: true }
  | { ok: false; fieldErrors: Record<string, string> | null };

export type WhatsAppSaveRule = (
  rule: WhatsAppRule,
  update: WhatsAppRuleUpdate,
) => Promise<WhatsAppRuleMutationResult>;

/** Resuelven true si la acción se completó (para cerrar el diálogo). */
export type WhatsAppActivateRule = (rule: WhatsAppRule, includeExisting: boolean) => Promise<boolean>;
export type WhatsAppDeactivateRule = (rule: WhatsAppRule) => Promise<boolean>;
