import type { ConversationChannel } from "@/types/crm";
import { CHANNEL_LABEL } from "./format";

const DAY = 86_400_000;

function daysAgo(iso: string, now: number): string {
  const days = Math.floor((now - Date.parse(iso)) / DAY);
  if (days <= 0) return "hace menos de un día";
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

export function lastPurchaseText(lastPurchaseAt: string | null, now = Date.now()): string {
  if (!lastPurchaseAt) return "Cliente nuevo. Aún no tiene pedidos.";
  return `Última compra ${daysAgo(lastPurchaseAt, now)}.`;
}

export function channelsText(
  channel: ConversationChannel,
  hasPhone: boolean,
  others: ConversationChannel[],
): string {
  if (!hasPhone) {
    return "Cuando comparta su número, POWIP une sus chats de WhatsApp, Instagram y Facebook en una sola ficha.";
  }
  if (others.length > 0) return `También escribió por ${others.map((c) => CHANNEL_LABEL[c]).join(", ")}.`;
  return `Solo escribió por ${CHANNEL_LABEL[channel]}. Si escribe por otro canal con el mismo número, se une aquí.`;
}
