import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  WHATSAPP_TEMPLATE_LANGUAGES,
  WHATSAPP_TEMPLATE_STATUSES,
  WHATSAPP_TEMPLATE_USAGES,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";

function buildTemplate(
  overrides: Partial<WhatsAppTemplate> & Pick<WhatsAppTemplate, "id" | "name">,
): WhatsAppTemplate {
  return {
    storeId: "store-livii",
    usage: WHATSAPP_TEMPLATE_USAGES.GUIDE_CREATED,
    category: WHATSAPP_TEMPLATE_CATEGORIES.UTILITY,
    language: WHATSAPP_TEMPLATE_LANGUAGES.SPANISH_PERU,
    status: WHATSAPP_TEMPLATE_STATUSES.APPROVED,
    metaReason: null,
    header: { type: WHATSAPP_TEMPLATE_HEADER_TYPES.NONE, text: null },
    body: "",
    footer: "Responde STOP para no recibir avisos",
    buttonText: "Rastrear mi pedido",
    quickReply: false,
    abTest: null,
    approvedVersion: null,
    stats30d: null,
    updatedAt: new Date("2026-10-06T15:00:00.000Z"),
    ...overrides,
  };
}

export const approvedTemplateFixture = buildTemplate({
  id: "tpl-guia",
  name: "guia_creada",
  body: "Hola {{cliente}}, tu pedido *{{orden}}* ya tiene guía de envío con {{courier}}. Te avisaremos apenas salga a reparto.",
  stats30d: { sent: 312, readPct: 81, clickPct: 44 },
});

export const abWithWinnerTemplateFixture = buildTemplate({
  id: "tpl-camino",
  name: "pedido_en_camino",
  usage: WHATSAPP_TEMPLATE_USAGES.IN_TRANSIT,
  header: { type: WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT, text: "📦 Tu pedido va en camino" },
  body: "Hola {{cliente}}, tu pedido *{{orden}}* ya está en camino con {{courier}}. Llegada estimada: *{{fecha_entrega}}*.",
  abTest: {
    enabled: true,
    bodyB:
      "{{cliente}}, ¡tu pedido {{orden}} ya salió! Va con {{courier}} y llega el *{{fecha_entrega}}*.",
    minSendsPerVariant: 200,
    results: {
      a: { sends: 210, readPct: 84, clickPct: 61 },
      b: { sends: 205, readPct: 89, clickPct: 66 },
      winner: "B",
    },
  },
  stats30d: { sent: 298, readPct: 84, clickPct: 63 },
});

export const abRunningTemplateFixture = buildTemplate({
  id: "tpl-reparto",
  name: "en_reparto_hoy",
  usage: WHATSAPP_TEMPLATE_USAGES.OUT_FOR_DELIVERY,
  body: "¡Hoy llega tu pedido {{orden}}, {{cliente}}! El motorizado de {{courier}} pasará durante el día. Ten tu celular a la mano.",
  abTest: {
    enabled: true,
    bodyB: "{{cliente}}, tu pedido {{orden}} llega hoy con {{courier}}.",
    minSendsPerVariant: 200,
    results: null,
  },
  stats30d: { sent: 187, readPct: 79, clickPct: 52 },
});

export const pendingWithApprovedVersionTemplateFixture = buildTemplate({
  id: "tpl-agencia",
  name: "disponible_agencia",
  usage: WHATSAPP_TEMPLATE_USAGES.AT_AGENCY,
  status: WHATSAPP_TEMPLATE_STATUSES.PENDING,
  body: "Hola {{cliente}}, tu pedido *{{orden}}* ya está en {{agencia}}. Lleva tu DNI y el código de tu guía.",
  buttonText: "Ver guía y dirección",
  approvedVersion: {
    header: { type: WHATSAPP_TEMPLATE_HEADER_TYPES.NONE, text: null },
    body: "Hola {{cliente}}, tu pedido *{{orden}}* ya llegó a la agencia y está listo para recoger: {{agencia}}.",
    footer: "Responde STOP para no recibir avisos",
    buttonText: "Ver guía y dirección",
    quickReply: false,
    approvedAt: new Date("2026-09-20T17:30:00.000Z"),
  },
  stats30d: { sent: 205, readPct: 88, clickPct: 71 },
});

export const pendingNewTemplateFixture = buildTemplate({
  id: "tpl-saldo",
  name: "saldo_pendiente",
  usage: WHATSAPP_TEMPLATE_USAGES.COD_BALANCE,
  status: WHATSAPP_TEMPLATE_STATUSES.PENDING,
  body: "Hola {{cliente}}, tu pedido {{orden}} llega el {{fecha_entrega}}. Recuerda tener listo el saldo de *S/ {{saldo}}* para pagar contra entrega.",
});

export const rejectedTemplateFixture = buildTemplate({
  id: "tpl-recompra",
  name: "recompra_descuento",
  usage: WHATSAPP_TEMPLATE_USAGES.SCHEDULED_ONLY,
  status: WHATSAPP_TEMPLATE_STATUSES.REJECTED,
  metaReason: "Contenido promocional en una plantilla de Utilidad. Cámbiala a Marketing.",
  body: "{{cliente}}, gracias por tu compra. Usa el código VUELVE10 y llévate 10% en tu próximo pedido.",
  buttonText: "Comprar ahora",
});

export const pausedTemplateFixture = buildTemplate({
  id: "tpl-encuesta",
  name: "encuesta_entrega",
  usage: WHATSAPP_TEMPLATE_USAGES.DELIVERY_SURVEY,
  status: WHATSAPP_TEMPLATE_STATUSES.PAUSED,
  metaReason: "Calidad baja: muchos clientes bloquearon o reportaron este mensaje.",
  body: "Hola {{cliente}}, ¿cómo te llegó tu pedido {{orden}}? Cuéntanos en 10 segundos.",
  buttonText: "Calificar mi compra",
  stats30d: { sent: 96, readPct: 70, clickPct: 31 },
});

export const draftTemplateFixture = buildTemplate({
  id: "tpl-incidencia",
  name: "incidencia_envio",
  usage: WHATSAPP_TEMPLATE_USAGES.INCIDENT,
  status: WHATSAPP_TEMPLATE_STATUSES.DRAFT,
  body: "Hola {{cliente}}, el courier no pudo completar la entrega de tu pedido {{orden}}.",
  buttonText: "Ver mi pedido",
});

export const invoiceTemplateWithDocumentFixture = buildTemplate({
  id: "tpl-comprobante",
  name: "comprobante_emitido",
  usage: WHATSAPP_TEMPLATE_USAGES.INVOICE_ISSUED,
  header: { type: WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT, text: null },
  body: "Hola {{cliente}}, te enviamos tu {{tipo_comprobante}} {{serie_numero}} por tu compra en {{tienda}}. ¡Gracias!",
  buttonText: "Ver mi pedido",
  stats30d: { sent: 238, readPct: 69, clickPct: 12 },
});

export const templatesListFixture: WhatsAppTemplate[] = [
  approvedTemplateFixture,
  abWithWinnerTemplateFixture,
  abRunningTemplateFixture,
  pendingWithApprovedVersionTemplateFixture,
  pendingNewTemplateFixture,
  rejectedTemplateFixture,
  pausedTemplateFixture,
  draftTemplateFixture,
  invoiceTemplateWithDocumentFixture,
];
