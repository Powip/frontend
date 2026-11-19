import type { Conversation, Message } from "@/types/crm";

export const BANDEJA_PATH = "/comercial/ventas-chat/bandeja";

/** URL de la Bandeja con una conversación abierta (sirve de `returnTo`). */
export function bandejaUrl(conversationId: string) {
  return `${BANDEJA_PATH}?c=${encodeURIComponent(conversationId)}`;
}

/** Ruta de registrar-venta para vender desde una conversación. */
export function crearPedidoUrl(conversation: Pick<Conversation, "id" | "contactPhone">) {
  const q = new URLSearchParams({
    crmConversationId: conversation.id,
    crmPhone: conversation.contactPhone,
    returnTo: bandejaUrl(conversation.id),
  });
  return `/registrar-venta?${q.toString()}`;
}

export function abrirPedidoUrl(orderId: string) {
  return `/registrar-venta?orderId=${encodeURIComponent(orderId)}`;
}

/** Saldo pendiente = total del pedido menos pagos aprobados (PAID). */
export function orderBalance(order: {
  grandTotal: string | number;
  payments?: Array<{ status: string; amount: string | number }>;
}) {
  const paid = (order.payments ?? [])
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  return Math.max(Math.round((Number(order.grandTotal) - paid) * 100) / 100, 0);
}

export function formatMoney(amount: number | string, currency?: string | null) {
  const prefix = !currency || currency === "PEN" ? "S/" : currency;
  return `${prefix} ${Number(amount).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const TZ = "America/Lima";

export const WINDOW_CLOSED_NOTICE =
  "Pasaron 24 h desde el último mensaje del cliente. WhatsApp solo permite responder con una plantilla aprobada.";

export function contactLabel(c: Pick<Conversation, "contactName" | "contactPhone">) {
  return c.contactName?.trim() || c.contactPhone;
}

export function isWindowOpen(c: Pick<Conversation, "windowExpiresAt">, now = Date.now()) {
  if (!c.windowExpiresAt) return false;
  const t = new Date(c.windowExpiresAt).getTime();
  return Number.isFinite(t) && t > now;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function formatDayLabel(iso: string, now = new Date()) {
  const key = dayKey(iso);
  if (key === dayKey(now.toISOString())) return "Hoy";
  if (key === dayKey(new Date(now.getTime() - 86_400_000).toISOString())) return "Ayer";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });
}

/** Hora relativa corta para la lista: «ahora», «5 min», «3 h», «2 d», o fecha. */
export function relativeTime(iso: string | null, now = Date.now()) {
  if (!iso) return "";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TZ,
  });
}

export function messageText(m: Pick<Message, "body" | "type">) {
  return m.body?.trim() ? m.body : `[${m.type}]`;
}

export interface MessageGroup {
  day: string;
  label: string;
  messages: Message[];
}

export function groupByDay(messages: Message[], now = new Date()): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const m of messages) {
    const day = dayKey(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.messages.push(m);
    else groups.push({ day, label: formatDayLabel(m.createdAt, now), messages: [m] });
  }
  return groups;
}

export const STATUS_LABEL: Record<Message["status"], string> = {
  received: "Recibido",
  sending: "Enviando…",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Falló",
};

/** Estilo del `<select>` nativo (accesible y usable con teclado) en tono Powip. */
export const NATIVE_SELECT_CLASS =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
