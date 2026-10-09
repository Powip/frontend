import type { WhatsAppQuickReply } from "../models/conversation.model";

export const CONVERSATION_LIMITS = {
  replyMaxLength: 4096,
  noteMaxLength: 1000,
  autoReplyMaxLength: 1024,
  optOutReasonMaxLength: 200,
} as const;

export const CONVERSATION_WINDOW_TICK_MS = 30 * 1000;

export const CONVERSATION_LIST_PAGE_SIZE = 50;
export const CONVERSATION_COLUMN_PAGE_SIZE = 20;

export const WHATSAPP_QUICK_REPLIES: WhatsAppQuickReply[] = [
  {
    id: "tracking_link",
    label: "Link de rastreo",
    text: "Hola {{cliente}}, aquí puedes ver tu pedido en tiempo real: {{link_rastreo}}",
    requires: "trackingUrl",
  },
  {
    id: "reschedule_delivery",
    label: "Reprogramar entrega",
    text: "Hola {{cliente}}, ¿qué día y en qué horario te queda mejor recibir tu pedido? Lo revisamos con el courier y te confirmamos por aquí.",
    requires: null,
  },
  {
    id: "change_address",
    label: "Cambiar dirección",
    text: "Hola {{cliente}}, envíanos la dirección completa (calle, número, distrito y una referencia). La revisamos y te confirmamos por aquí si se puede cambiar.",
    requires: null,
  },
  {
    id: "agency_hours",
    label: "Horario de agencia",
    text: "Hola {{cliente}}, el horario de atención de la agencia es ",
    requires: null,
  },
];

export const AUTO_REPLY_VARIABLES = [
  { key: "cliente", label: "Nombre del cliente", sample: "Lucía" },
  { key: "link_rastreo", label: "Link de rastreo POWIP", sample: "powip.lat/r/EJEMPLO" },
] as const;

export const AUTO_REPLY_SUGGESTED = {
  enabled: true,
  inHoursText:
    "¡Hola {{cliente}}! Recibimos tu mensaje. Una asesora te responde en unos minutos. Mientras, puedes ver tu pedido aquí: {{link_rastreo}}",
  outOfHoursText:
    "Recibimos tu mensaje. Te respondemos mañana desde las 8:00 am. Tu pedido sigue aquí: {{link_rastreo}}",
} as const;
