import {
  WHATSAPP_EVIDENCE_TYPES,
  WHATSAPP_MESSAGE_DIRECTIONS,
  WHATSAPP_MESSAGE_KINDS,
  WHATSAPP_MESSAGE_STATUSES,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppMessage } from "@/features/whatsapp/models/message.model";

export const WHATSAPP_FIXTURE_NOW = new Date("2026-10-08T16:00:00.000Z");

const emptyTimeline = {
  sentAt: null,
  deliveredAt: null,
  readAt: null,
  failedAt: null,
  clickedAt: null,
};

export function buildMessage(
  overrides: Partial<WhatsAppMessage> & Pick<WhatsAppMessage, "id">,
): WhatsAppMessage {
  return {
    direction: WHATSAPP_MESSAGE_DIRECTIONS.OUTBOUND,
    kind: WHATSAPP_MESSAGE_KINDS.TEMPLATE,
    status: null,
    body: "",
    templateName: null,
    buttonText: null,
    document: null,
    media: null,
    evidence: null,
    author: null,
    failureReason: null,
    createdAt: WHATSAPP_FIXTURE_NOW,
    timeline: emptyTimeline,
    ...overrides,
  };
}

export const repliedConversationFixture: WhatsAppMessage[] = [
  buildMessage({
    id: "m-1",
    templateName: "guia_creada",
    status: WHATSAPP_MESSAGE_STATUSES.READ,
    body: "Hola Lucía, tu pedido *ORD-149905* ya tiene guía de envío con Shalom. Te avisaremos apenas salga a reparto.",
    buttonText: "Rastrear mi pedido",
    createdAt: new Date("2026-10-07T21:10:00.000Z"),
  }),
  buildMessage({
    id: "m-2",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.READ,
    body: "Hola Lucía, tu pedido *ORD-149905* ya está en camino con Shalom.\nLlegada estimada: *jueves 8 de octubre*.",
    buttonText: "Rastrear mi pedido",
    createdAt: new Date("2026-10-08T14:58:00.000Z"),
  }),
  buildMessage({
    id: "m-3",
    direction: WHATSAPP_MESSAGE_DIRECTIONS.INBOUND,
    kind: WHATSAPP_MESSAGE_KINDS.TEXT,
    body: "Hola, no voy a estar en casa el jueves, ¿pueden entregar el viernes?",
    createdAt: new Date("2026-10-08T15:52:00.000Z"),
  }),
  buildMessage({
    id: "m-4",
    kind: WHATSAPP_MESSAGE_KINDS.AUTO_REPLY,
    status: WHATSAPP_MESSAGE_STATUSES.DELIVERED,
    body: "¡Hola Lucía! Recibimos tu mensaje. Una asesora te responde en unos minutos. Mientras, puedes ver tu pedido aquí: powip.lat/r/L4K8M",
    createdAt: new Date("2026-10-08T15:52:30.000Z"),
  }),
];

export const deliveredWithEvidenceFixture: WhatsAppMessage[] = [
  buildMessage({
    id: "e-1",
    templateName: "en_reparto_hoy",
    status: WHATSAPP_MESSAGE_STATUSES.READ,
    body: "¡Hoy llega tu pedido ORD-149880, Jorge! El motorizado pasará durante el día. Ten tu celular a la mano.",
    buttonText: "Rastrear mi pedido",
    createdAt: new Date("2026-10-08T13:30:00.000Z"),
  }),
  buildMessage({
    id: "e-2",
    kind: WHATSAPP_MESSAGE_KINDS.EVIDENCE,
    evidence: {
      type: WHATSAPP_EVIDENCE_TYPES.DELIVERY,
      imageUrl: null,
      courier: "Moto propia",
      takenAt: new Date("2026-10-08T17:40:00.000Z"),
    },
    createdAt: new Date("2026-10-08T17:40:00.000Z"),
  }),
  buildMessage({
    id: "e-3",
    templateName: "pedido_entregado",
    status: WHATSAPP_MESSAGE_STATUSES.DELIVERED,
    body: "Hola Jorge, confirmamos la entrega de tu pedido *ORD-149880*. ¡Gracias por comprar en LIVII!",
    buttonText: "Ver detalle del pedido",
    createdAt: new Date("2026-10-08T17:41:00.000Z"),
  }),
  buildMessage({
    id: "e-4",
    templateName: "comprobante_emitido",
    status: WHATSAPP_MESSAGE_STATUSES.SENT,
    body: "Hola Jorge, te enviamos tu boleta B001-000482 por tu compra en LIVII. ¡Gracias!",
    document: { fileName: "B001-000482.pdf", sizeBytes: 48 * 1024, url: null },
    buttonText: "Ver mi pedido",
    createdAt: new Date("2026-10-08T17:43:00.000Z"),
  }),
];

export const agentAndNotesFixture: WhatsAppMessage[] = [
  buildMessage({
    id: "a-1",
    direction: WHATSAPP_MESSAGE_DIRECTIONS.INBOUND,
    kind: WHATSAPP_MESSAGE_KINDS.TEXT,
    body: "¿Puede recogerlo mi hermano?",
    createdAt: new Date("2026-10-07T01:01:00.000Z"),
  }),
  buildMessage({
    id: "a-2",
    kind: WHATSAPP_MESSAGE_KINDS.TEXT,
    status: WHATSAPP_MESSAGE_STATUSES.READ,
    author: { id: "u-mr", name: "Milagros R." },
    body: "¡Hola Diego! Sí, con tu DNI (foto) y el código de guía.",
    createdAt: new Date("2026-10-07T01:06:00.000Z"),
  }),
  buildMessage({
    id: "a-3",
    kind: WHATSAPP_MESSAGE_KINDS.NOTE,
    author: { id: "u-kf", name: "Katherine F." },
    body: "Entrega reprogramada al vie 9 oct",
    createdAt: new Date("2026-10-08T15:20:00.000Z"),
  }),
  buildMessage({
    id: "a-4",
    kind: WHATSAPP_MESSAGE_KINDS.ECHO,
    status: WHATSAPP_MESSAGE_STATUSES.DELIVERED,
    body: "Te escribo desde la tienda para confirmar el horario.",
    createdAt: new Date("2026-10-08T15:25:00.000Z"),
  }),
];

export const notSentFixture: WhatsAppMessage[] = [
  buildMessage({
    id: "f-1",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.FAILED,
    body: "Hola Alexandra, tu pedido *ORD-149001* ya está en camino con Shalom.",
    failureReason: "El número no tiene WhatsApp",
    createdAt: new Date("2026-10-08T13:00:00.000Z"),
  }),
  buildMessage({
    id: "f-2",
    templateName: "guia_creada",
    status: WHATSAPP_MESSAGE_STATUSES.SKIPPED,
    body: "Hola Ana, tu pedido *ORD-149958* ya tiene guía de envío con Shalom.",
    failureReason: "Falta el link de rastreo (el pedido aún no tiene guía)",
    createdAt: new Date("2026-10-08T14:10:00.000Z"),
  }),
  buildMessage({
    id: "f-3",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.ASSISTED,
    body: "Hola Sofía, tu pedido *ORD-149930* ya está en camino con Olva.",
    createdAt: new Date("2026-10-08T16:20:00.000Z"),
  }),
  buildMessage({
    id: "f-4",
    templateName: "en_reparto_hoy",
    status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
    body: "¡Hoy llega tu pedido ORD-149872, Mariana!",
    createdAt: new Date("2026-10-08T16:25:00.000Z"),
  }),
];
