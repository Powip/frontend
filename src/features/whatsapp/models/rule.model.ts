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
