import { WHATSAPP_MESSAGE_STATUSES } from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppHistoryMessage,
  WhatsAppHistoryMetrics,
  WhatsAppHistoryPage,
} from "@/features/whatsapp/models/history.model";

export const HISTORY_FIXTURE_NOW = new Date("2026-10-08T16:00:00.000Z");

const at = (iso: string) => new Date(iso);

const emptyTimeline = {
  queuedAt: null,
  sentAt: null,
  deliveredAt: null,
  readAt: null,
  failedAt: null,
  clickedAt: null,
};

function buildHistoryMessage(
  overrides: Partial<WhatsAppHistoryMessage> & Pick<WhatsAppHistoryMessage, "id">,
): WhatsAppHistoryMessage {
  return {
    createdAt: at("2026-10-08T15:12:00.000Z"),
    orderId: `order-${overrides.id}`,
    orderNumber: "ORD-149912",
    storeId: "store-livii",
    storeName: "LIVII",
    customerName: "Carlos Hoyos",
    phone: "+51 987 111 222",
    templateName: "pedido_en_camino",
    courierName: "Shalom",
    status: WHATSAPP_MESSAGE_STATUSES.SENT,
    reason: null,
    timeline: emptyTimeline,
    assistedBy: null,
    canResend: false,
    resendBlockedReason: null,
    ...overrides,
  };
}

export const historyMetricsFixture: WhatsAppHistoryMetrics = {
  sent: 1284,
  delivered: 1251,
  read: 1018,
  trackingOpened: 642,
  notSent: 33,
  notSentBreakdown: [
    { reason: "NO_WHATSAPP", label: "sin WhatsApp", count: 21 },
    { reason: "OTHER", label: "otros", count: 12 },
  ],
  assisted: 4,
  computedAt: HISTORY_FIXTURE_NOW,
};

export const historyMetricsZeroFixture: WhatsAppHistoryMetrics = {
  sent: 0,
  delivered: 0,
  read: 0,
  trackingOpened: 0,
  notSent: 0,
  notSentBreakdown: [],
  assisted: 0,
  computedAt: HISTORY_FIXTURE_NOW,
};

export const historyMetricsPartialFixture: WhatsAppHistoryMetrics = {
  sent: 120,
  delivered: null,
  read: null,
  trackingOpened: 30,
  notSent: null,
  notSentBreakdown: null,
  assisted: null,
  computedAt: HISTORY_FIXTURE_NOW,
};

export const readWithClickMessage = buildHistoryMessage({
  id: "h-read",
  status: WHATSAPP_MESSAGE_STATUSES.READ,
  timeline: {
    ...emptyTimeline,
    sentAt: at("2026-10-08T15:12:00.000Z"),
    deliveredAt: at("2026-10-08T15:12:30.000Z"),
    readAt: at("2026-10-08T15:15:00.000Z"),
    clickedAt: at("2026-10-08T15:16:00.000Z"),
  },
});

export const deliveredWithClickMessage = buildHistoryMessage({
  id: "h-delivered-click",
  orderNumber: "ORD-149743",
  customerName: "Paola Buendía",
  courierName: "Olva",
  status: WHATSAPP_MESSAGE_STATUSES.DELIVERED,
  timeline: {
    ...emptyTimeline,
    sentAt: at("2026-10-08T14:02:00.000Z"),
    deliveredAt: at("2026-10-08T14:02:20.000Z"),
    clickedAt: at("2026-10-08T14:30:00.000Z"),
  },
});

export const failedMessage = buildHistoryMessage({
  id: "h-failed",
  orderNumber: "ORD-149001",
  customerName: "Alexandra Castellanos",
  status: WHATSAPP_MESSAGE_STATUSES.FAILED,
  reason: "El número no tiene WhatsApp",
  timeline: {
    ...emptyTimeline,
    queuedAt: at("2026-10-08T13:00:00.000Z"),
    failedAt: at("2026-10-08T13:00:05.000Z"),
  },
  canResend: true,
});

export const skippedMessage = buildHistoryMessage({
  id: "h-skipped",
  orderNumber: "ORD-149958",
  customerName: "Ana Soto",
  templateName: "guia_creada",
  status: WHATSAPP_MESSAGE_STATUSES.SKIPPED,
  reason: "Falta el link de rastreo (el pedido aún no tiene guía)",
  timeline: { ...emptyTimeline, failedAt: at("2026-10-08T14:10:00.000Z") },
  canResend: false,
  resendBlockedReason: "Corrige el dato en el pedido: el aviso sale solo cuando esté completo.",
});

export const assistedMessage = buildHistoryMessage({
  id: "h-assisted",
  orderNumber: "ORD-149931",
  customerName: "Rosa Chávez",
  status: WHATSAPP_MESSAGE_STATUSES.ASSISTED,
  assistedBy: { id: "u-kf", name: "Katherine F." },
  timeline: { ...emptyTimeline, sentAt: at("2026-10-08T11:20:00.000Z") },
});

export const noOrderLongMessage = buildHistoryMessage({
  id: "h-long",
  orderId: null,
  orderNumber: null,
  customerName: "María Fernanda de los Ángeles Quispe Huamán de la Cruz",
  courierName: "Courier Express Nacional Interprovincial",
  templateName: "solo_envios_programados_aviso_feriado_largo",
  status: WHATSAPP_MESSAGE_STATUSES.SENT,
  timeline: { ...emptyTimeline, sentAt: at("2026-10-08T10:00:00.000Z") },
});

export const historyPageFixture: WhatsAppHistoryPage = {
  items: [
    readWithClickMessage,
    deliveredWithClickMessage,
    failedMessage,
    skippedMessage,
    assistedMessage,
    noOrderLongMessage,
  ],
  page: 1,
  pageSize: 50,
  total: 1321,
  hasMore: true,
};

export const historyEmptyPageFixture: WhatsAppHistoryPage = {
  items: [],
  page: 1,
  pageSize: 50,
  total: 0,
  hasMore: false,
};
