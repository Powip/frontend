import type { Conversation, ConversationChannel, Message } from "@/types/crm";

export const BANDEJA_PATH = "/comercial/ventas-chat/bandeja";

/** URL de la Bandeja con una conversación abierta (sirve de `returnTo`). */
export function bandejaUrl(conversationId: string) {
  return `${BANDEJA_PATH}?c=${encodeURIComponent(conversationId)}`;
}

export const CHANNEL_LABEL: Record<ConversationChannel, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram",
  tiktok: "TikTok",
};

type PhoneSource = Pick<Conversation, "contactPhone"> &
  Partial<Pick<Conversation, "channel" | "customerPhone">>;

/** Conversación de Messenger o Instagram (su `contactPhone` no es un teléfono). */
export function isMetaChannel(c: Partial<Pick<Conversation, "channel">>) {
  return !!c.channel && c.channel !== "whatsapp";
}

/**
 * Teléfono real del cliente para buscarlo, crearlo o vender: en WhatsApp es el
 * del contacto; en Messenger e Instagram, el que el equipo guardó (o null).
 */
export function phoneForCustomer(c: PhoneSource): string | null {
  if (!isMetaChannel(c)) return c.contactPhone || null;
  return c.customerPhone?.trim() || null;
}

/** Ruta de registrar-venta para vender desde una conversación. */
export function crearPedidoUrl(conversation: PhoneSource & Pick<Conversation, "id">) {
  const phone = phoneForCustomer(conversation);
  const q = new URLSearchParams({
    crmConversationId: conversation.id,
    ...(phone ? { crmPhone: phone } : {}),
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

export const META_WINDOW_CLOSED_NOTICE =
  "Pasaron 7 días desde el último mensaje del cliente. En Messenger e Instagram ya no se puede responder hasta que el cliente vuelva a escribir (no hay plantillas en estos canales).";

export const TIKTOK_WINDOW_CLOSED_NOTICE =
  "Pasaron 48 h desde el último mensaje del cliente. En TikTok ya no se puede responder hasta que el cliente vuelva a escribir (no hay plantillas en este canal).";

export function windowClosedNotice(c: Partial<Pick<Conversation, "channel">>) {
  if (c.channel === "tiktok") return TIKTOK_WINDOW_CLOSED_NOTICE;
  return isMetaChannel(c) ? META_WINDOW_CLOSED_NOTICE : WINDOW_CLOSED_NOTICE;
}

/** Nombre del contacto; sin nombre, el teléfono (WhatsApp) o «Contacto de <canal>». */
export function contactLabel(
  c: Pick<Conversation, "contactName" | "contactPhone"> & Partial<Pick<Conversation, "channel">>,
) {
  const name = c.contactName?.trim();
  if (name) return name;
  return c.channel && isMetaChannel(c) ? `Contacto de ${CHANNEL_LABEL[c.channel]}` : c.contactPhone;
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

/** «20 de noviembre a las 09:00» (hora Lima), para «Lo está pensando». */
export function formatResumeAt(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("es-PE", { day: "numeric", month: "long", timeZone: TZ });
  return `${date} a las ${formatTime(iso)}`;
}

/** Nota interna del equipo (no se envía al cliente). */
export function isInternalNote(m: Pick<Message, "type">) {
  return m.type === "note";
}

/** Texto del último mensaje real del cliente; las notas internas no cuentan. */
export function lastCustomerText(messages: Message[] | undefined): string {
  if (!messages) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.direction === "in" && m.senderKind === "customer" && !isInternalNote(m) && m.body?.trim()) {
      return m.body.trim();
    }
  }
  return "";
}

/** Cuerpo de una plantilla con sus `{{1}}`, `{{2}}`… reemplazados (los vacíos quedan como están). */
export function fillTemplateBody(body: string, variables: string[]) {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (all, n: string) => {
    const v = variables[Number(n) - 1]?.trim();
    return v ? v : all;
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
