import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  WHATSAPP_TEMPLATE_LANGUAGES,
  WHATSAPP_TEMPLATE_STATUSES,
  WHATSAPP_TEMPLATE_USAGES,
  type WhatsAppTemplateCategory,
  type WhatsAppTemplateLanguage,
  type WhatsAppTemplateStatus,
  type WhatsAppTemplateUsage,
} from "../enums/whatsapp.enums";

export const WHATSAPP_TEMPLATE_LIMITS = {
  technicalName: 512,
  headerText: 60,
  body: 1024,
  footer: 60,
  buttonText: 25,
  headerVariables: 1,
  minSendsPerVariant: { min: 1, max: 100000, default: 200 },
} as const;

export const WHATSAPP_TEMPLATE_DEFAULT_FOOTER = "Responde STOP para no recibir avisos";

export const WHATSAPP_TEMPLATE_DEFAULT_BUTTON_TEXT = "Rastrear mi pedido";

export const WHATSAPP_TEMPLATE_TRACKING_URL_LABEL = "powip.lat/r/{{codigo}}";

export const WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT = "Tengo una consulta";

export const WHATSAPP_TEMPLATE_SAMPLE_DOCUMENT_NAME = "B001-000482.pdf";

export interface WhatsAppTemplateVariableDefinition {
  key: string;
  label: string;
  sample: string;
}

export const WHATSAPP_TEMPLATE_VARIABLES: WhatsAppTemplateVariableDefinition[] = [
  { key: "cliente", label: "Nombre del cliente", sample: "Carlos" },
  { key: "orden", label: "N° de pedido", sample: "ORD-149912" },
  { key: "courier", label: "Courier", sample: "Shalom" },
  { key: "link_rastreo", label: "Link de rastreo POWIP", sample: "powip.lat/r/K7X2Q" },
  { key: "fecha_entrega", label: "Fecha estimada", sample: "jueves 8 de octubre" },
  { key: "agencia", label: "Agencia de recojo", sample: "Shalom Arequipa – Av. Ejército 710" },
  { key: "saldo", label: "Saldo por cobrar", sample: "298.00" },
  { key: "tienda", label: "Nombre de tu tienda", sample: "LIVII" },
  { key: "tipo_comprobante", label: "Boleta o Factura", sample: "boleta" },
  { key: "serie_numero", label: "Serie y número SUNAT", sample: "B001-000482" },
];

const BASE_VARIABLE_KEYS = [
  "cliente",
  "orden",
  "courier",
  "link_rastreo",
  "fecha_entrega",
  "agencia",
  "saldo",
  "tienda",
];

const INVOICE_VARIABLE_KEYS = [...BASE_VARIABLE_KEYS, "tipo_comprobante", "serie_numero"];

export interface WhatsAppTemplateUsageDefinition {
  value: WhatsAppTemplateUsage;
  label: string;
  allowsDocumentHeader: boolean;
  variableKeys: string[];
  suggestion: {
    headerText: string | null;
    body: string;
    buttonText: string;
  } | null;
}

export const WHATSAPP_TEMPLATE_USAGE_DEFINITIONS: WhatsAppTemplateUsageDefinition[] = [
  {
    value: WHATSAPP_TEMPLATE_USAGES.GUIDE_CREATED,
    label: "Guía creada",
    allowsDocumentHeader: false,
    variableKeys: BASE_VARIABLE_KEYS,
    suggestion: {
      headerText: null,
      body: "Hola {{cliente}}, tu pedido *{{orden}}* ya tiene guía de envío con {{courier}}. Te avisaremos apenas salga a reparto.",
      buttonText: "Rastrear mi pedido",
    },
  },
  {
    value: WHATSAPP_TEMPLATE_USAGES.IN_TRANSIT,
    label: "Pedido en camino",
    allowsDocumentHeader: false,
    variableKeys: BASE_VARIABLE_KEYS,
    suggestion: {
      headerText: "📦 Tu pedido va en camino",
      body: "Hola {{cliente}}, tu pedido *{{orden}}* ya está en camino con {{courier}}. Llegada estimada: *{{fecha_entrega}}*.",
      buttonText: "Rastrear mi pedido",
    },
  },
  {
    value: WHATSAPP_TEMPLATE_USAGES.AT_AGENCY,
    label: "Disponible en agencia",
    allowsDocumentHeader: false,
    variableKeys: BASE_VARIABLE_KEYS,
    suggestion: {
      headerText: null,
      body: "Hola {{cliente}}, tu pedido *{{orden}}* ya llegó a la agencia y está listo para recoger: {{agencia}}. Lleva tu DNI y el código de tu guía.",
      buttonText: "Ver guía y dirección",
    },
  },
  {
    value: WHATSAPP_TEMPLATE_USAGES.OUT_FOR_DELIVERY,
    label: "En reparto hoy",
    allowsDocumentHeader: false,
    variableKeys: BASE_VARIABLE_KEYS,
    suggestion: {
      headerText: null,
      body: "¡Hoy llega tu pedido {{orden}}, {{cliente}}! El motorizado de {{courier}} pasará durante el día. Ten tu celular a la mano.",
      buttonText: "Rastrear mi pedido",
    },
  },
  {
    value: WHATSAPP_TEMPLATE_USAGES.DELIVERED,
    label: "Pedido entregado",
    allowsDocumentHeader: false,
    variableKeys: BASE_VARIABLE_KEYS,
    suggestion: {
      headerText: null,
      body: "Hola {{cliente}}, confirmamos la entrega de tu pedido *{{orden}}*. ¡Gracias por comprar en {{tienda}}!",
      buttonText: "Ver detalle del pedido",
    },
  },
  {
    value: WHATSAPP_TEMPLATE_USAGES.INCIDENT,
    label: "Incidencia en el envío",
    allowsDocumentHeader: false,
    variableKeys: BASE_VARIABLE_KEYS,
    suggestion: {
      headerText: null,
      body: "Hola {{cliente}}, el courier no pudo completar la entrega de tu pedido {{orden}}. Toca el botón para ver qué pasó y elegir cómo seguimos.",
      buttonText: "Ver mi pedido",
    },
  },
  {
    value: WHATSAPP_TEMPLATE_USAGES.INVOICE_ISSUED,
    label: "Comprobante emitido",
    allowsDocumentHeader: true,
    variableKeys: INVOICE_VARIABLE_KEYS,
    suggestion: {
      headerText: null,
      body: "Hola {{cliente}}, te enviamos tu {{tipo_comprobante}} {{serie_numero}} por tu compra en {{tienda}}. ¡Gracias!",
      buttonText: "Ver mi pedido",
    },
  },
  {
    value: WHATSAPP_TEMPLATE_USAGES.DELIVERY_SURVEY,
    label: "Encuesta post-entrega",
    allowsDocumentHeader: false,
    variableKeys: BASE_VARIABLE_KEYS,
    suggestion: {
      headerText: null,
      body: "Hola {{cliente}}, ¿cómo te llegó tu pedido {{orden}}? Cuéntanos en 10 segundos, nos ayuda mucho.",
      buttonText: "Calificar mi compra",
    },
  },
  {
    value: WHATSAPP_TEMPLATE_USAGES.COD_BALANCE,
    label: "Saldo pendiente",
    allowsDocumentHeader: false,
    variableKeys: BASE_VARIABLE_KEYS,
    suggestion: {
      headerText: null,
      body: "Hola {{cliente}}, tu pedido {{orden}} llega el {{fecha_entrega}}. Recuerda tener listo el saldo de *S/ {{saldo}}* para pagar contra entrega.",
      buttonText: "Rastrear mi pedido",
    },
  },
  {
    value: WHATSAPP_TEMPLATE_USAGES.SCHEDULED_ONLY,
    label: "Solo envíos programados",
    allowsDocumentHeader: false,
    variableKeys: BASE_VARIABLE_KEYS,
    suggestion: null,
  },
];

export const WHATSAPP_TEMPLATE_LANGUAGE_OPTIONS: {
  value: WhatsAppTemplateLanguage;
  label: string;
}[] = [
  { value: WHATSAPP_TEMPLATE_LANGUAGES.SPANISH_PERU, label: "Español (Perú)" },
  { value: WHATSAPP_TEMPLATE_LANGUAGES.SPANISH, label: "Español" },
];

export const WHATSAPP_TEMPLATE_CATEGORY_OPTIONS: {
  value: WhatsAppTemplateCategory;
  label: string;
  hint: string;
}[] = [
  {
    value: WHATSAPP_TEMPLATE_CATEGORIES.UTILITY,
    label: "Utilidad",
    hint: "Avisos sobre un pedido que el cliente ya hizo. Más barata y se aprueba rápido.",
  },
  {
    value: WHATSAPP_TEMPLATE_CATEGORIES.MARKETING,
    label: "Marketing",
    hint: "Promociones, descuentos o recompra. Tarifa más alta y el cliente puede silenciarla.",
  },
];

export const WHATSAPP_TEMPLATE_STATUS_LABELS: Record<WhatsAppTemplateStatus, string> = {
  [WHATSAPP_TEMPLATE_STATUSES.DRAFT]: "Borrador",
  [WHATSAPP_TEMPLATE_STATUSES.PENDING]: "En revisión",
  [WHATSAPP_TEMPLATE_STATUSES.APPROVED]: "Aprobada",
  [WHATSAPP_TEMPLATE_STATUSES.REJECTED]: "Rechazada",
  [WHATSAPP_TEMPLATE_STATUSES.PAUSED]: "Pausada",
};

export const WHATSAPP_TEMPLATE_STATUS_FILTERS: {
  value: WhatsAppTemplateStatus | "all";
  label: string;
}[] = [
  { value: "all", label: "Todas" },
  { value: WHATSAPP_TEMPLATE_STATUSES.APPROVED, label: "Aprobadas" },
  { value: WHATSAPP_TEMPLATE_STATUSES.PENDING, label: "En revisión" },
  { value: WHATSAPP_TEMPLATE_STATUSES.REJECTED, label: "Rechazadas" },
  { value: WHATSAPP_TEMPLATE_STATUSES.PAUSED, label: "Pausadas" },
  { value: WHATSAPP_TEMPLATE_STATUSES.DRAFT, label: "Borradores" },
];

export function getTemplateUsageDefinition(
  usage: WhatsAppTemplateUsage | null | undefined,
): WhatsAppTemplateUsageDefinition | null {
  return WHATSAPP_TEMPLATE_USAGE_DEFINITIONS.find((item) => item.value === usage) ?? null;
}

export function getTemplateSampleValues(): Record<string, string> {
  return Object.fromEntries(
    WHATSAPP_TEMPLATE_VARIABLES.map((variable) => [variable.key, variable.sample]),
  );
}
