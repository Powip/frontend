import { CONVERSATION_LIMITS } from "../constants/whatsapp-conversation-catalog";
import { WHATSAPP_TEMPLATE_STATUSES } from "../enums/whatsapp.enums";
import type { WhatsAppQuickReply } from "../models/conversation.model";
import type { WhatsAppTemplate } from "../models/template.model";

export interface QuickReplyContext {
  customerName: string | null;
  trackingUrl: string | null;
}

export function getCustomerFirstName(customerName: string | null): string | null {
  const first = customerName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

export function isQuickReplyAvailable(reply: WhatsAppQuickReply, context: QuickReplyContext) {
  return reply.requires !== "trackingUrl" || !!context.trackingUrl;
}

export function resolveQuickReplyText(
  reply: WhatsAppQuickReply,
  context: QuickReplyContext,
): string | null {
  if (!isQuickReplyAvailable(reply, context)) return null;
  const firstName = getCustomerFirstName(context.customerName);
  return reply.text
    .replace(/ ?\{\{cliente\}\}/g, firstName ? ` ${firstName}` : "")
    .replace(/\{\{link_rastreo\}\}/g, context.trackingUrl ?? "");
}

export function validateReplyText(text: string): string | null {
  if (text.trim().length === 0) return "Escribe un mensaje.";
  if (text.length > CONVERSATION_LIMITS.replyMaxLength) {
    return `Máximo ${CONVERSATION_LIMITS.replyMaxLength.toLocaleString("es-PE")} caracteres.`;
  }
  return null;
}

export function validateNoteText(text: string): string | null {
  if (text.trim().length === 0) return "Escribe la nota.";
  if (text.length > CONVERSATION_LIMITS.noteMaxLength) {
    return `Máximo ${CONVERSATION_LIMITS.noteMaxLength.toLocaleString("es-PE")} caracteres.`;
  }
  return null;
}

export function isTemplateSendable(template: WhatsAppTemplate): boolean {
  if (template.status === WHATSAPP_TEMPLATE_STATUSES.APPROVED) return true;
  return template.status === WHATSAPP_TEMPLATE_STATUSES.PENDING && !!template.approvedVersion;
}

export function getSendableTemplates(
  templates: WhatsAppTemplate[],
  storeId: string,
): WhatsAppTemplate[] {
  return templates
    .filter((template) => template.storeId === null || template.storeId === storeId)
    .filter(isTemplateSendable)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
