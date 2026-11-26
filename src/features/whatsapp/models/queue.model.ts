import type { WhatsAppQueueSource } from "../enums/whatsapp.enums";

export interface WhatsAppQueueGroup {
  id: string;
  sendAt: Date;
  name: string;
  source: WhatsAppQueueSource;
  sourceLabel: string;
  orders: number;
  deferred: boolean;
  deferredTo: Date | null;
  reason: string | null;
}

export interface WhatsAppUpcomingQueue {
  total: number;
  groups: WhatsAppQueueGroup[];
}

export interface WhatsAppSkippedNotice {
  id: string;
  orderId: string | null;
  orderNumber: string;
  customerName: string;
  templateName: string;
  reason: string;
  createdAt: Date;
}
