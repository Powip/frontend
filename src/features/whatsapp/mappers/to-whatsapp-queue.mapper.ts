import type { WhatsAppMessagesPageDto, WhatsAppUpcomingQueueDto } from "../api/queue.api";
import type { WhatsAppQueueSource } from "../enums/whatsapp.enums";
import type { WhatsAppSkippedNotice, WhatsAppUpcomingQueue } from "../models/queue.model";

/** C-20 → modelo de "Próximas 24 horas". */
export function toWhatsAppUpcomingQueue(dto: WhatsAppUpcomingQueueDto): WhatsAppUpcomingQueue {
  return {
    total: dto.total,
    groups: dto.groups.map((group) => ({
      id: `${group.ruleKey}-${group.sendAt}`,
      sendAt: new Date(group.sendAt),
      name: group.templateName ?? group.sourceLabel,
      source: group.source as WhatsAppQueueSource,
      sourceLabel: group.sourceLabel,
      orders: group.orders,
      deferred: group.deferred,
      deferredTo: group.deferredTo ? new Date(group.deferredTo) : null,
      reason: group.reason,
    })),
  };
}

/** C-19 (GET /wa/messages?status=skipped) → modelo de "Hoy no se enviaron". */
export function toWhatsAppSkippedNotices(page: WhatsAppMessagesPageDto): WhatsAppSkippedNotice[] {
  return page.items.map((item) => ({
    id: item.id,
    orderId: item.orderId,
    orderNumber: item.orderNumber,
    customerName: item.customerName ?? "Sin nombre",
    templateName: item.templateName ?? "Sin plantilla",
    reason: item.reason ?? item.reasonCode ?? "Sin motivo",
    createdAt: new Date(item.createdAt),
  }));
}