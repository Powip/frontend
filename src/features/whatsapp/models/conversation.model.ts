import type {
  WhatsAppConversationView,
  WhatsAppMessageStatus,
  WhatsAppThreadColumn,
} from "../enums/whatsapp.enums";
import type { WhatsAppMessage, WhatsAppMessageAuthor } from "./message.model";

export interface WhatsAppConversationLastOutbound {
  messageId: string | null;
  status: WhatsAppMessageStatus;
  templateName: string | null;
  sentAt: Date | null;
  failureReason: string | null;
}

export interface WhatsAppConversationAttention {
  pendingReply: boolean;
  lastInboundText: string | null;
  lastInboundAt: Date | null;
  waitingSince: Date | null;
  overdue: boolean | null;
  attended: boolean;
  attendedAt: Date | null;
  attendedBy: WhatsAppMessageAuthor | null;
}

export interface WhatsAppConversationSummary {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  storeId: string;
  storeName: string;
  courierName: string | null;
  customerName: string | null;
  phone: string;
  lastMessageAt: Date | null;
  lastOutbound: WhatsAppConversationLastOutbound | null;
  attention: WhatsAppConversationAttention;
  trackingOpened: boolean;
  flaggedForReview: boolean;
  optedOut: boolean;
  assignee: WhatsAppMessageAuthor | null;
}

export interface WhatsAppConversationColumnPage {
  items: WhatsAppConversationSummary[];
  total: number | null;
  hasMore: boolean;
}

export type WhatsAppConversationBoard = Record<
  WhatsAppThreadColumn,
  WhatsAppConversationColumnPage
>;

export interface WhatsAppConversationListPage {
  items: WhatsAppConversationSummary[];
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
}

export interface WhatsAppReplyWindowInfo {
  open: boolean | null;
  expiresAt: Date | null;
}

export interface WhatsAppConversationDetail extends WhatsAppConversationSummary {
  replyWindow: WhatsAppReplyWindowInfo | null;
  trackingUrl: string | null;
  messages: WhatsAppMessage[];
  version: number;
}

export interface WhatsAppConversationFilters {
  search: string;
  storeId: string | null;
  assignedToMe: boolean;
}

export interface WhatsAppConversationQuery {
  q: string | null;
  storeId: string | null;
  assignedTo: string | null;
}

export interface WhatsAppConversationCapabilities {
  view: boolean;
  reply: boolean;
  reassign: boolean;
  manageOptOuts: boolean;
}

export interface WhatsAppAutoReplySettings {
  enabled: boolean;
  inHoursText: string;
  outOfHoursText: string;
  version: number;
}

export interface WhatsAppQuickReply {
  id: string;
  label: string;
  text: string;
  requires: "trackingUrl" | null;
}

export interface WhatsAppAgentOption {
  id: string;
  name: string;
}

export interface WhatsAppConversationPreferences {
  view: WhatsAppConversationView;
}
