import {
  WHATSAPP_EVIDENCE_TYPES,
  WHATSAPP_MEDIA_TYPES,
  WHATSAPP_MESSAGE_DIRECTIONS,
  WHATSAPP_MESSAGE_KINDS,
  WHATSAPP_MESSAGE_STATUSES,
  type WhatsAppMessageStatus,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppAgentOption,
  WhatsAppAutoReplySettings,
  WhatsAppConversationAttention,
  WhatsAppConversationBoard,
  WhatsAppConversationCapabilities,
  WhatsAppConversationDetail,
  WhatsAppConversationListPage,
  WhatsAppConversationSummary,
} from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import {
  agentAndNotesFixture,
  buildMessage,
  deliveredWithEvidenceFixture,
  notSentFixture,
  repliedConversationFixture,
  WHATSAPP_FIXTURE_NOW,
} from "./whatsapp-message.fixtures";
import { schedulingTemplatesFixture } from "./whatsapp-scheduling.fixtures";

export const CONVERSATION_FIXTURE_NOW = WHATSAPP_FIXTURE_NOW;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const ago = (ms: number) => new Date(CONVERSATION_FIXTURE_NOW.getTime() - ms);
const later = (ms: number) => new Date(CONVERSATION_FIXTURE_NOW.getTime() + ms);

export const conversationStoresFixture = [
  { id: "store-livii", name: "LIVII" },
  { id: "store-kunca", name: "KUNCA" },
];

export const CONVERSATION_FIXTURE_USER_ID = "u-mr";

export const conversationAgentsFixture: WhatsAppAgentOption[] = [
  { id: "u-kf", name: "Katherine F." },
  { id: "u-mr", name: "Milagros R." },
  { id: "u-jc", name: "José C." },
];

export const fullCapabilitiesFixture: WhatsAppConversationCapabilities = {
  view: true,
  reply: true,
  reassign: true,
  manageOptOuts: true,
};

export const agentCapabilitiesFixture: WhatsAppConversationCapabilities = {
  view: true,
  reply: true,
  reassign: false,
  manageOptOuts: false,
};

export const readOnlyCapabilitiesFixture: WhatsAppConversationCapabilities = {
  view: true,
  reply: false,
  reassign: false,
  manageOptOuts: false,
};

const noAttention: WhatsAppConversationAttention = {
  pendingReply: false,
  lastInboundText: null,
  lastInboundAt: null,
  waitingSince: null,
  overdue: null,
  attended: false,
  attendedAt: null,
  attendedBy: null,
};

function pending(text: string, since: Date, overdue: boolean): WhatsAppConversationAttention {
  return {
    ...noAttention,
    pendingReply: true,
    lastInboundText: text,
    lastInboundAt: since,
    waitingSince: since,
    overdue,
  };
}

function outbound(
  status: WhatsAppMessageStatus,
  templateName: string | null,
  sentAt: Date,
  failureReason: string | null = null,
  messageId: string | null = null,
) {
  return { messageId, status, templateName, sentAt, failureReason };
}

function buildSummary(
  overrides: Partial<WhatsAppConversationSummary> & Pick<WhatsAppConversationSummary, "id">,
): WhatsAppConversationSummary {
  return {
    orderId: `order-${overrides.id}`,
    orderNumber: "ORD-149900",
    storeId: "store-livii",
    storeName: "LIVII",
    courierName: "Shalom",
    customerName: "Cliente",
    phone: "+51 987 654 321",
    lastMessageAt: ago(30 * MINUTE),
    lastOutbound: outbound(WHATSAPP_MESSAGE_STATUSES.READ, "pedido_en_camino", ago(HOUR)),
    attention: noAttention,
    trackingOpened: false,
    flaggedForReview: false,
    optedOut: false,
    assignee: { id: "u-kf", name: "Katherine F." },
    ...overrides,
  };
}

export const luciaConversation = buildSummary({
  id: "cv-lucia",
  orderNumber: "ORD-149905",
  customerName: "Lucía Ramos",
  phone: "+51 987 111 222",
  lastMessageAt: ago(8 * MINUTE),
  attention: pending(
    "Hola, no voy a estar en casa el jueves, ¿pueden entregar el viernes?",
    ago(8 * MINUTE),
    false,
  ),
  trackingOpened: true,
});

export const kevinConversation = buildSummary({
  id: "cv-kevin",
  orderNumber: "ORD-149911",
  storeId: "store-kunca",
  storeName: "KUNCA",
  courierName: "Olva",
  customerName: "Kevin Flores",
  phone: "+51 955 300 410",
  lastMessageAt: ago(25 * MINUTE),
  attention: pending("¿Hasta qué hora atiende la agencia?", ago(25 * MINUTE), false),
  assignee: { id: "u-mr", name: "Milagros R." },
});

export const sofiaConversation = buildSummary({
  id: "cv-sofia",
  orderNumber: "ORD-149930",
  courierName: "Olva",
  customerName: "Sofía Medina",
  phone: "+51 944 120 330",
  lastMessageAt: ago(165 * MINUTE),
  lastOutbound: outbound(WHATSAPP_MESSAGE_STATUSES.DELIVERED, "pedido_en_camino", ago(4 * HOUR)),
  attention: pending(
    "Me equivoqué en la dirección, es Jr. Huallaga 320, no 302",
    ago(165 * MINUTE),
    true,
  ),
  flaggedForReview: true,
});

export const diegoAttendedConversation = buildSummary({
  id: "cv-diego",
  orderNumber: "ORD-149870",
  courierName: "Shalom",
  customerName: "Diego Paredes",
  phone: "+51 933 456 789",
  lastMessageAt: ago(40 * MINUTE),
  lastOutbound: outbound(WHATSAPP_MESSAGE_STATUSES.SENT, null, ago(40 * MINUTE)),
  attention: {
    ...noAttention,
    lastInboundText: "¿Puede recogerlo mi hermano?",
    lastInboundAt: ago(2 * HOUR),
    attended: true,
    attendedAt: ago(40 * MINUTE),
    attendedBy: { id: "u-mr", name: "Milagros R." },
  },
  assignee: { id: "u-mr", name: "Milagros R." },
});

export const jorgeReadConversation = buildSummary({
  id: "cv-jorge",
  orderNumber: "ORD-149880",
  courierName: "Moto propia",
  customerName: "Jorge Salas",
  phone: "+51 922 333 444",
  lastMessageAt: ago(10 * MINUTE),
  lastOutbound: outbound(WHATSAPP_MESSAGE_STATUSES.READ, "comprobante_emitido", ago(17 * MINUTE)),
  trackingOpened: true,
});

export const carlaDeliveredConversation = buildSummary({
  id: "cv-carla",
  orderNumber: "ORD-149890",
  customerName: "Carla Núñez",
  phone: "+51 911 222 333",
  lastOutbound: outbound(WHATSAPP_MESSAGE_STATUSES.DELIVERED, "guia_creada", ago(50 * MINUTE)),
  lastMessageAt: ago(50 * MINUTE),
  assignee: null,
});

export const mariaSentConversation = buildSummary({
  id: "cv-maria",
  orderNumber: "ORD-149895",
  storeId: "store-kunca",
  storeName: "KUNCA",
  customerName: "María Torres",
  phone: "+51 900 111 000",
  lastOutbound: outbound(WHATSAPP_MESSAGE_STATUSES.SENT, "en_reparto_hoy", ago(5 * HOUR)),
  lastMessageAt: ago(5 * HOUR),
});

export const rosaAssistedConversation = buildSummary({
  id: "cv-rosa",
  orderNumber: "ORD-149931",
  customerName: "Rosa Chávez",
  phone: "+51 988 777 666",
  lastOutbound: outbound(WHATSAPP_MESSAGE_STATUSES.ASSISTED, "pedido_en_camino", ago(2 * HOUR)),
  lastMessageAt: ago(2 * HOUR),
});

export const alexandraFailedConversation = buildSummary({
  id: "cv-alexandra",
  orderNumber: "ORD-149001",
  customerName: "Alexandra Castellanos",
  phone: "+51 977 000 111",
  lastOutbound: outbound(
    WHATSAPP_MESSAGE_STATUSES.FAILED,
    "pedido_en_camino",
    ago(3 * HOUR),
    "El número no tiene WhatsApp",
    "f-1",
  ),
  lastMessageAt: ago(3 * HOUR),
});

export const anaSkippedConversation = buildSummary({
  id: "cv-ana",
  orderNumber: "ORD-149958",
  customerName: "Ana Soto",
  phone: "+51 966 555 444",
  lastOutbound: outbound(
    WHATSAPP_MESSAGE_STATUSES.SKIPPED,
    "guia_creada",
    ago(2 * HOUR),
    "Falta el link de rastreo (el pedido aún no tiene guía)",
    "f-2",
  ),
  lastMessageAt: ago(2 * HOUR),
});

export const luisSkippedConversation = buildSummary({
  id: "cv-luis",
  orderNumber: null,
  orderId: null,
  customerName: "Luis Pérez",
  phone: "01 444 5566",
  lastOutbound: outbound(
    WHATSAPP_MESSAGE_STATUSES.SKIPPED,
    "guia_creada",
    ago(90 * MINUTE),
    "Es un teléfono fijo",
    null,
  ),
  lastMessageAt: ago(90 * MINUTE),
  assignee: null,
});

export const pedroOptedOutConversation = buildSummary({
  id: "cv-pedro",
  orderNumber: "ORD-149860",
  customerName: "Pedro Ramírez",
  phone: "+51 955 444 333",
  lastMessageAt: ago(20 * MINUTE),
  optedOut: true,
});

export const longTextConversation = buildSummary({
  id: "cv-larga",
  orderNumber: "ORD-149999-LIMA-NORTE-EXPRESS",
  storeName: "LIVII Tienda Oficial Miraflores y San Isidro",
  courierName: "Courier Express Nacional Interprovincial",
  customerName: "María Fernanda de los Ángeles Quispe Huamán",
  phone: "+51 999 888 777",
  lastMessageAt: ago(3 * MINUTE),
  attention: pending(
    "Buenas tardes, quería consultar porque en el seguimiento dice que mi pedido está en camino desde hace tres días y todavía no me llega, además la dirección que aparece es la de mi trabajo y yo había pedido que lo dejen en mi casa en Av. Javier Prado Este 4200 departamento 1502 torre B, ¿me pueden ayudar? https://ejemplo.pe/un-enlace-muy-largo-sin-espacios-para-probar-el-corte-de-palabras",
    ago(3 * MINUTE),
    false,
  ),
  assignee: { id: "u-jc", name: "José Carlos Villanueva Rodríguez" },
});

export const conversationBoardFixture: WhatsAppConversationBoard = {
  sent: {
    items: [mariaSentConversation, diegoAttendedConversation, rosaAssistedConversation],
    total: 12,
    hasMore: true,
  },
  delivered: { items: [carlaDeliveredConversation, sofiaConversation], total: 8, hasMore: false },
  read: { items: [jorgeReadConversation, pedroOptedOutConversation], total: 23, hasMore: true },
  replied: {
    items: [luciaConversation, kevinConversation, longTextConversation],
    total: 4,
    hasMore: false,
  },
  failed: {
    items: [alexandraFailedConversation, anaSkippedConversation, luisSkippedConversation],
    total: 3,
    hasMore: false,
  },
};

export const conversationBoardWithoutTotalsFixture: WhatsAppConversationBoard = {
  sent: { ...conversationBoardFixture.sent, total: null },
  delivered: { ...conversationBoardFixture.delivered, total: null },
  read: { ...conversationBoardFixture.read, total: null },
  replied: { ...conversationBoardFixture.replied, total: null },
  failed: { ...conversationBoardFixture.failed, total: null },
};

export const emptyConversationBoardFixture: WhatsAppConversationBoard = {
  sent: { items: [], total: 0, hasMore: false },
  delivered: { items: [], total: 0, hasMore: false },
  read: { items: [], total: 0, hasMore: false },
  replied: { items: [], total: 0, hasMore: false },
  failed: { items: [], total: 0, hasMore: false },
};

const allSummaries = [
  luciaConversation,
  kevinConversation,
  sofiaConversation,
  longTextConversation,
  diegoAttendedConversation,
  jorgeReadConversation,
  carlaDeliveredConversation,
  mariaSentConversation,
  rosaAssistedConversation,
  pedroOptedOutConversation,
  alexandraFailedConversation,
  anaSkippedConversation,
  luisSkippedConversation,
];

export const conversationListFixture: WhatsAppConversationListPage = {
  items: allSummaries,
  page: 1,
  pageSize: 50,
  total: 63,
  hasMore: true,
};

export const emptyConversationListFixture: WhatsAppConversationListPage = {
  items: [],
  page: 1,
  pageSize: 50,
  total: 0,
  hasMore: false,
};

function buildDetail(
  summary: WhatsAppConversationSummary,
  overrides: Partial<WhatsAppConversationDetail> = {},
): WhatsAppConversationDetail {
  return {
    ...summary,
    replyWindow: { open: false, expiresAt: null },
    trackingUrl: "powip.lat/r/L4K8M",
    messages: [],
    version: 3,
    ...overrides,
  };
}

const optedOutMessages = [
  buildMessage({
    id: "o-1",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.READ,
    body: "Hola Pedro, tu pedido *ORD-149860* ya está en camino con Shalom.",
    buttonText: "Rastrear mi pedido",
    createdAt: ago(HOUR),
  }),
  buildMessage({
    id: "o-2",
    direction: WHATSAPP_MESSAGE_DIRECTIONS.INBOUND,
    kind: WHATSAPP_MESSAGE_KINDS.TEXT,
    body: "STOP",
    createdAt: ago(25 * MINUTE),
  }),
  buildMessage({
    id: "o-3",
    kind: WHATSAPP_MESSAGE_KINDS.NOTE,
    body: "Cliente dado de baja · no recibirá más avisos",
    createdAt: ago(25 * MINUTE),
  }),
];

const mediaMessages = [
  ...repliedConversationFixture,
  buildMessage({
    id: "md-1",
    direction: WHATSAPP_MESSAGE_DIRECTIONS.INBOUND,
    kind: WHATSAPP_MESSAGE_KINDS.TEXT,
    body: "",
    media: {
      type: WHATSAPP_MEDIA_TYPES.IMAGE,
      url: "https://example.com/foto.jpg",
      caption: "Así quedó la puerta",
    },
    createdAt: ago(6 * MINUTE),
  }),
  buildMessage({
    id: "md-2",
    direction: WHATSAPP_MESSAGE_DIRECTIONS.INBOUND,
    kind: WHATSAPP_MESSAGE_KINDS.TEXT,
    body: "",
    media: { type: WHATSAPP_MEDIA_TYPES.AUDIO, url: null, caption: null },
    createdAt: ago(5 * MINUTE),
  }),
];

const evidenceMessages = [
  ...deliveredWithEvidenceFixture.slice(0, 1),
  buildMessage({
    id: "ev-dispatch",
    kind: WHATSAPP_MESSAGE_KINDS.EVIDENCE,
    evidence: {
      type: WHATSAPP_EVIDENCE_TYPES.DISPATCH,
      imageUrl: null,
      courier: null,
      takenAt: new Date("2026-10-08T13:10:00.000Z"),
    },
    createdAt: new Date("2026-10-08T13:10:00.000Z"),
  }),
  ...deliveredWithEvidenceFixture.slice(1),
];

const longTextMessages = [
  buildMessage({
    id: "lt-1",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.READ,
    body: "Hola María Fernanda, tu pedido *ORD-149999-LIMA-NORTE-EXPRESS* ya está en camino con Courier Express Nacional Interprovincial.",
    buttonText: "Rastrear mi pedido",
    createdAt: ago(3 * HOUR),
  }),
  buildMessage({
    id: "lt-2",
    direction: WHATSAPP_MESSAGE_DIRECTIONS.INBOUND,
    kind: WHATSAPP_MESSAGE_KINDS.TEXT,
    body: longTextConversation.attention.lastInboundText ?? "",
    createdAt: ago(3 * MINUTE),
  }),
];

const assistedMessages = [
  buildMessage({
    id: "as-1",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.ASSISTED,
    author: { id: "u-kf", name: "Katherine F." },
    body: "Hola Rosa, tu pedido *ORD-149931* ya está en camino con Shalom.",
    createdAt: ago(2 * HOUR),
  }),
];

export const conversationDetailsFixture: Record<string, WhatsAppConversationDetail> = {
  [luciaConversation.id]: buildDetail(luciaConversation, {
    replyWindow: { open: true, expiresAt: new Date("2026-10-09T15:52:00.000Z") },
    messages: mediaMessages,
  }),
  [kevinConversation.id]: buildDetail(kevinConversation, {
    replyWindow: { open: true, expiresAt: later(2 * MINUTE) },
    trackingUrl: null,
    messages: [
      buildMessage({
        id: "k-1",
        direction: WHATSAPP_MESSAGE_DIRECTIONS.INBOUND,
        kind: WHATSAPP_MESSAGE_KINDS.TEXT,
        body: "¿Hasta qué hora atiende la agencia?",
        createdAt: ago(25 * MINUTE),
      }),
    ],
  }),
  [sofiaConversation.id]: buildDetail(sofiaConversation, {
    replyWindow: null,
    messages: [
      buildMessage({
        id: "s-1",
        direction: WHATSAPP_MESSAGE_DIRECTIONS.INBOUND,
        kind: WHATSAPP_MESSAGE_KINDS.TEXT,
        body: "Me equivoqué en la dirección, es Jr. Huallaga 320, no 302",
        createdAt: ago(165 * MINUTE),
      }),
    ],
  }),
  [diegoAttendedConversation.id]: buildDetail(diegoAttendedConversation, {
    replyWindow: { open: false, expiresAt: ago(HOUR) },
    messages: agentAndNotesFixture,
  }),
  [jorgeReadConversation.id]: buildDetail(jorgeReadConversation, {
    messages: evidenceMessages,
  }),
  [carlaDeliveredConversation.id]: buildDetail(carlaDeliveredConversation),
  [mariaSentConversation.id]: buildDetail(mariaSentConversation),
  [rosaAssistedConversation.id]: buildDetail(rosaAssistedConversation, {
    messages: assistedMessages,
  }),
  [pedroOptedOutConversation.id]: buildDetail(pedroOptedOutConversation, {
    replyWindow: { open: true, expiresAt: later(20 * HOUR) },
    messages: optedOutMessages,
  }),
  [alexandraFailedConversation.id]: buildDetail(alexandraFailedConversation, {
    messages: notSentFixture.slice(0, 1),
  }),
  [anaSkippedConversation.id]: buildDetail(anaSkippedConversation, {
    messages: notSentFixture.slice(1, 2),
  }),
  [luisSkippedConversation.id]: buildDetail(luisSkippedConversation, {
    trackingUrl: null,
  }),
  [longTextConversation.id]: buildDetail(longTextConversation, {
    replyWindow: { open: true, expiresAt: later(23 * HOUR) },
    messages: longTextMessages,
  }),
};

export function getConversationFixture(
  conversationId: string,
): WhatsAppResourceState<WhatsAppConversationDetail> {
  const detail = conversationDetailsFixture[conversationId];
  if (detail) return { kind: "ready", data: detail };
  if (conversationId === "cv-cargando") return { kind: "loading" };
  return { kind: "error", message: "La conversación ya no existe o no tienes acceso." };
}

export const conversationTemplatesFixture: WhatsAppTemplate[] = schedulingTemplatesFixture;

export const autoReplySettingsFixture: WhatsAppAutoReplySettings = {
  enabled: true,
  inHoursText:
    "¡Hola {{cliente}}! Gracias por escribirnos. Una asesora de LIVII te responde pronto. Tu pedido: {{link_rastreo}}",
  outOfHoursText: "Recibimos tu mensaje. Te respondemos mañana desde las 9:00 am. {{link_rastreo}}",
  version: 2,
};
