import type {
  WhatsAppHistoryPeriod,
  WhatsAppHistoryStatusFilter,
  WhatsAppMessageStatus,
} from "../enums/whatsapp.enums";
import type { WhatsAppMessageAuthor } from "./message.model";

export interface WhatsAppHistoryTimeline {
  queuedAt: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  clickedAt: Date | null;
}

export interface WhatsAppHistoryMessage {
  id: string;
  createdAt: Date;
  orderId: string | null;
  orderNumber: string | null;
  storeId: string;
  storeName: string;
  customerName: string | null;
  phone: string;
  templateName: string | null;
  courierName: string | null;
  status: WhatsAppMessageStatus;
  reason: string | null;
  timeline: WhatsAppHistoryTimeline;
  assistedBy: WhatsAppMessageAuthor | null;
  canResend: boolean;
  resendBlockedReason: string | null;
}

export interface WhatsAppNotSentReason {
  reason: string;
  label: string;
  count: number;
}

export interface WhatsAppHistoryMetrics {
  sent: number | null;
  delivered: number | null;
  read: number | null;
  trackingOpened: number | null;
  notSent: number | null;
  notSentBreakdown: WhatsAppNotSentReason[] | null;
  assisted: number | null;
  computedAt: Date;
}

export interface WhatsAppHistoryPage {
  items: WhatsAppHistoryMessage[];
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
}

export interface WhatsAppHistoryFilters {
  period: WhatsAppHistoryPeriod;
  status: WhatsAppHistoryStatusFilter;
  search: string;
  storeId: string | null;
}

export interface WhatsAppLimaRange {
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
}

export interface WhatsAppHistoryQuery {
  period: WhatsAppHistoryPeriod;
  from: string;
  to: string;
  storeId: string | null;
  q: string | null;
}
