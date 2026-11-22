import type {
  WhatsAppAssistedStatus,
  WhatsAppConnectionState,
  WhatsAppConnectionType,
  WhatsAppMessageStatus,
  WhatsAppNameStatus,
  WhatsAppQualityRating,
} from "../enums/whatsapp.enums";
import type { WhatsAppMessageAuthor } from "./message.model";

export interface WhatsAppConnectionStatus {
  storeId: string;
  connectionType: WhatsAppConnectionType | null;
  state: WhatsAppConnectionState | null;
  contingencyActive: boolean | null;
}

export interface WhatsAppAccountWebhook {
  state: "active" | "inactive" | null;
  lastEventAt: Date | null;
}

export interface WhatsAppAccountUsage {
  uniqueContacts: number | null;
  limit: number | null;
  resetsAt: Date | null;
}

export interface WhatsAppAccount {
  id: string;
  storeId: string;
  role: "principal" | "contingencia";
  connectionType: WhatsAppConnectionType | null;
  phone: string | null;
  verifiedName: string | null;
  nameStatus: WhatsAppNameStatus | null;
  qualityRating: WhatsAppQualityRating | null;
  messagingLimitLabel: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  webhook: WhatsAppAccountWebhook | null;
  connectedAt: Date | null;
  connectedBy: WhatsAppMessageAuthor | null;
  usageToday: WhatsAppAccountUsage | null;
  messagesThisMonth: number | null;
  lastSyncedAt: Date | null;
  version: number;
}

export interface WhatsAppTestRun {
  messageId: string;
  phone: string;
  templateName: string;
  status: WhatsAppMessageStatus;
  startedAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
}

export interface WhatsAppContingencyTriggers {
  onRestrictedOrRed: boolean;
  onDailyLimit: boolean;
  onConsecutiveFailures: { enabled: boolean; count: number; minutes: number };
  manualOnly: boolean;
}

export interface WhatsAppContingencySettings {
  enabled: boolean;
  backupAccount: Pick<WhatsAppAccount, "id" | "phone" | "verifiedName"> | null;
  triggers: WhatsAppContingencyTriggers;
  sender: { type: "all_agents" | "user"; userId: string | null };
  active: boolean | null;
  activatedAt: Date | null;
  reason: string | null;
  version: number;
}

export interface WhatsAppAssistedItem {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  phone: string;
  templateName: string | null;
  courierName: string | null;
  waMeUrl: string | null;
  status: WhatsAppAssistedStatus;
  createdAt: Date;
  openedBy: WhatsAppMessageAuthor | null;
}

export interface WhatsAppAssistedQueue {
  items: WhatsAppAssistedItem[];
  pendingTotal: number | null;
  hasMore: boolean;
}

export interface WhatsAppPricingItem {
  type: "utility" | "marketing" | "service" | "authentication";
  label: string;
  chargedWhen: string;
  usd: string;
  pen: string | null;
}

export interface WhatsAppPricing {
  market: string;
  currency: "USD";
  effectiveFrom: string;
  source: string;
  sourceUrl: string | null;
  verifiedAt: Date | null;
  exchangeRate: { value: string; date: string; source: string } | null;
  items: WhatsAppPricingItem[];
}

export interface WhatsAppUsageSummary {
  month: string;
  templatesDelivered: number | null;
  serviceRepliesUsed: number | null;
  serviceRepliesFree: number | null;
  estimatedCost: {
    usd: string;
    pen: string | null;
    exchangeRate: string | null;
    rateDate: string | null;
  } | null;
}
