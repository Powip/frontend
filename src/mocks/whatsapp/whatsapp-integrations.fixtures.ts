import type { WhatsAppNotificationsFeed } from "@/components/whatsapp/WhatsAppNotificationsPanel";
import { WHATSAPP_EVIDENCE_TYPES } from "@/features/whatsapp/enums/whatsapp.enums";
import type { PublicOrderTracking } from "@/features/whatsapp/models/public-tracking.model";
import { conversationDetailsFixture } from "./whatsapp-conversation.fixtures";

export const INTEGRATIONS_FIXTURE_NOW = new Date("2026-10-08T16:00:00.000Z");

export const orderThreadsFixture = [
  conversationDetailsFixture["cv-jorge"],
  conversationDetailsFixture["cv-lucia"],
];

export const lastNoticeDtoFixtures = {
  read: {
    status: "read",
    templateName: "pedido_en_camino",
    at: "2026-10-08T15:15:00.000Z",
    reason: null,
  },
  delivered: {
    status: "delivered",
    templateName: "guia_creada",
    at: "2026-10-08T14:02:00.000Z",
    reason: null,
  },
  failed: {
    status: "failed",
    templateName: "pedido_en_camino",
    at: "2026-10-08T13:00:00.000Z",
    reason: "El número no tiene WhatsApp",
  },
  assisted: {
    status: "assisted",
    templateName: "en_reparto_hoy",
    at: "2026-10-08T11:20:00.000Z",
    reason: null,
  },
  invalidStatus: { status: "opened", templateName: "x", at: "2026-10-08T11:20:00.000Z" },
  invalidDate: { status: "read", templateName: "x", at: "ayer" },
} as const;

export const notificationsFeedFixture: WhatsAppNotificationsFeed = {
  unreadTotal: 2,
  items: [
    {
      id: "n-1",
      type: "unattended_minutes",
      message: "3 respuestas sin atender por 30 min en LIVII",
      createdAt: new Date("2026-10-08T14:40:00.000Z"),
      relatedTab: "conversaciones",
      readAt: null,
    },
    {
      id: "n-2",
      type: "template",
      message: "Meta rechazó recompra_descuento: contenido promocional",
      createdAt: new Date("2026-10-07T23:12:00.000Z"),
      relatedTab: "plantillas",
      readAt: null,
    },
    {
      id: "n-3",
      type: "daily_limit_pct",
      message: "Se usó el 80% del límite diario",
      createdAt: new Date("2026-10-03T20:00:00.000Z"),
      relatedTab: "pantalla-que-no-existe",
      readAt: new Date("2026-10-04T10:00:00.000Z"),
    },
  ],
};

const tinyImage =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='%23cbd5e1'/></svg>";

export const publicTrackingFixture: PublicOrderTracking = {
  store: { name: "LIVII Store", logoUrl: null },
  order: {
    number: "ORD-149880",
    createdAt: new Date("2026-10-05T15:00:00.000Z"),
    customerFirstName: "Jorge",
    items: [
      { name: "Polo básico negro talla M", quantity: 2 },
      {
        name: "Casaca impermeable con capucha y bolsillos interiores edición limitada",
        quantity: 1,
      },
    ],
  },
  status: {
    label: "Entregado",
    description: "Tu pedido llegó a su destino.",
    tone: "delivered",
    incidentReason: null,
  },
  timeline: [
    { label: "Pedido confirmado", at: new Date("2026-10-05T15:00:00.000Z"), done: true },
    { label: "Guía creada", at: new Date("2026-10-06T14:00:00.000Z"), done: true },
    { label: "En camino", at: new Date("2026-10-07T13:30:00.000Z"), done: true },
    { label: "Entregado", at: new Date("2026-10-08T17:40:00.000Z"), done: true },
  ],
  shipping: {
    courierName: "Moto propia",
    trackingCode: null,
    deliveryMode: "home",
    estimatedDate: "2026-10-08",
    district: "Miraflores",
    agency: null,
  },
  evidence: [
    {
      type: WHATSAPP_EVIDENCE_TYPES.DISPATCH,
      imageUrl: tinyImage,
      takenAt: new Date("2026-10-07T13:10:00.000Z"),
    },
    {
      type: WHATSAPP_EVIDENCE_TYPES.DELIVERY,
      imageUrl: `${tinyImage}#entrega`,
      takenAt: new Date("2026-10-08T17:40:00.000Z"),
    },
  ],
  invoice: {
    label: "Boleta",
    seriesNumber: "B001-000482",
    pdfUrl: "https://example.com/boleta.pdf",
  },
  updatedAt: new Date("2026-10-08T17:41:00.000Z"),
};

export const publicTrackingAgencyIncidentFixture: PublicOrderTracking = {
  ...publicTrackingFixture,
  status: {
    label: "En agencia",
    description: "Tu pedido te espera en la agencia.",
    tone: "incident",
    incidentReason: "La agencia cerró temprano por feriado; puedes recogerlo mañana.",
  },
  timeline: [
    { label: "Pedido confirmado", at: new Date("2026-10-05T15:00:00.000Z"), done: true },
    { label: "En camino", at: new Date("2026-10-07T13:30:00.000Z"), done: true },
    { label: "Disponible en agencia", at: null, done: false },
  ],
  shipping: {
    courierName: "Shalom",
    trackingCode: "SH-99812",
    deliveryMode: "agency",
    estimatedDate: null,
    district: null,
    agency: {
      name: "Shalom Arequipa Centro",
      address: "Av. Ejército 101",
      hours: "Lun a sáb 8:00 a 20:00",
    },
  },
  evidence: [],
  invoice: null,
};

export const publicTrackingIncompleteFixture: PublicOrderTracking = {
  store: { name: "Tienda sin logo", logoUrl: null },
  order: { number: "ORD-1", createdAt: null, customerFirstName: null, items: null },
  status: { label: "En preparación", description: null, tone: "progress", incidentReason: null },
  timeline: null,
  shipping: null,
  evidence: [],
  invoice: null,
  updatedAt: null,
};
