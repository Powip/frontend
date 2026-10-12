import {
  WHATSAPP_ASSISTED_STATUSES,
  WHATSAPP_CONNECTION_STATES,
  WHATSAPP_CONNECTION_TYPES,
  WHATSAPP_NAME_STATUSES,
  WHATSAPP_QUALITY_RATINGS,
  type WhatsAppAssistedStatus,
  type WhatsAppConnectionState,
  type WhatsAppConnectionType,
  type WhatsAppNameStatus,
  type WhatsAppQualityRating,
} from "../enums/whatsapp.enums";

export interface ConnectionTypeDefinition {
  value: WhatsAppConnectionType;
  title: string;
  badge: string;
  summary: string;
  advantages: string[];
  limitations: string[];
  statusLabel: string;
  changeEffect: string;
}

export const CONNECTION_TYPE_DEFINITIONS: ConnectionTypeDefinition[] = [
  {
    value: WHATSAPP_CONNECTION_TYPES.API,
    title: "API oficial de WhatsApp",
    badge: "Recomendado",
    summary: "Número dedicado a POWIP conectado a la Cloud API.",
    advantages: ["Envío automático y programado.", "Estados enviado, entregado y leído."],
    limitations: ["Ese número deja de funcionar en la app del celular."],
    statusLabel: "Conectado · API oficial",
    changeEffect:
      "Hay que conectar un número dedicado con Meta. El número deja de funcionar en la app del celular.",
  },
  {
    value: WHATSAPP_CONNECTION_TYPES.COEXISTENCE,
    title: "API + app WhatsApp Business",
    badge: "Mismo número",
    summary: "El número que el negocio ya usa en la app del celular, conectado también a la API.",
    advantages: [
      "No cambia de número ni pierde chats.",
      "Lo que se responde desde la app del celular no cuesta.",
    ],
    limitations: [
      "Sin listas de difusión nuevas, sin mensajes temporales ni ubicación en vivo.",
      "Máximo 20 mensajes por segundo.",
      "Requiere app v2.24.17 o superior.",
    ],
    statusLabel: "Conectado · API + app Business",
    changeEffect:
      "Hay que volver a conectar el número con Meta eligiendo la opción de la app WhatsApp Business.",
  },
  {
    value: WHATSAPP_CONNECTION_TYPES.APP_MANUAL,
    title: "Solo app WhatsApp Business",
    badge: "Contingencia",
    summary: "Número sin API. POWIP arma el mensaje; la asesora lo envía con un toque.",
    advantages: ["Sin costo de Meta.", "Se mide quién abre el rastreo."],
    limitations: ["Una persona debe tocar «Enviar».", "Sin estados entregado ni leído."],
    statusLabel: "Solo envío asistido",
    changeEffect:
      "Los avisos dejarán de salir solos: tu equipo tendrá que enviarlos desde la bandeja de envío asistido.",
  },
];

export function getConnectionTypeDefinition(
  type: WhatsAppConnectionType,
): ConnectionTypeDefinition {
  const definition = CONNECTION_TYPE_DEFINITIONS.find((item) => item.value === type);
  if (!definition) throw new Error(`Tipo de conexión desconocido: ${type}`);
  return definition;
}

export const CONNECTION_STATE_LABELS: Record<WhatsAppConnectionState, string> = {
  [WHATSAPP_CONNECTION_STATES.CONNECTED]: "Conectado",
  [WHATSAPP_CONNECTION_STATES.NAME_IN_REVIEW]: "Nombre en revisión",
  [WHATSAPP_CONNECTION_STATES.RESTRICTED]: "Restringido por Meta",
  [WHATSAPP_CONNECTION_STATES.DISCONNECTED]: "Desconectado",
  [WHATSAPP_CONNECTION_STATES.NOT_CONNECTED]: "Sin conectar",
};

export const QUALITY_LABELS: Record<WhatsAppQualityRating, { label: string; detail: string }> = {
  [WHATSAPP_QUALITY_RATINGS.GREEN]: {
    label: "Alta",
    detail: "Meta no ve problemas con tus envíos.",
  },
  [WHATSAPP_QUALITY_RATINGS.YELLOW]: {
    label: "Media",
    detail: "Algunos compradores bloquean o reportan tus mensajes.",
  },
  [WHATSAPP_QUALITY_RATINGS.RED]: {
    label: "Baja",
    detail: "Meta puede limitar o restringir el número.",
  },
  [WHATSAPP_QUALITY_RATINGS.UNKNOWN]: {
    label: "Sin dato de Meta",
    detail: "Meta no informó la calidad.",
  },
};

export const NAME_STATUS_LABELS: Record<WhatsAppNameStatus, string> = {
  [WHATSAPP_NAME_STATUSES.APPROVED]: "Nombre aprobado por Meta",
  [WHATSAPP_NAME_STATUSES.IN_REVIEW]: "Nombre en revisión · puedes enviar mientras Meta lo revisa",
  [WHATSAPP_NAME_STATUSES.REJECTED]: "Meta rechazó el nombre",
};

export const ASSISTED_STATUS_LABELS: Record<WhatsAppAssistedStatus, string> = {
  [WHATSAPP_ASSISTED_STATUSES.PENDING]: "Por enviar",
  [WHATSAPP_ASSISTED_STATUSES.OPENED]: "Abierta · falta confirmar el envío",
  [WHATSAPP_ASSISTED_STATUSES.MARKED_SENT]: "Marcado como enviado",
  [WHATSAPP_ASSISTED_STATUSES.DISCARDED]: "Descartado",
};

export const SIGNUP_REQUIREMENTS = [
  "Un número que no esté usando la app de WhatsApp normal.",
  "Acceso a ese número para recibir un código por SMS o llamada.",
  "Un método de pago en Meta para el costo de los mensajes.",
];

export const CONTINGENCY_SUGGESTED = {
  enabled: false,
  onRestrictedOrRed: true,
  onDailyLimit: true,
  failuresEnabled: true,
  failuresCount: "5",
  failuresMinutes: "15",
  manualOnly: false,
  senderType: "all_agents",
  senderUserId: "",
} as const;

export const CONTINGENCY_LIMITS = {
  failuresCount: { min: 1, max: 50 },
  failuresMinutes: { min: 1, max: 1440 },
} as const;

export const TEST_MESSAGE_READ_WAIT_MS = 2 * 60 * 1000;
export const PRICING_STALE_AFTER_DAYS = 30;
export const ASSISTED_PAGE_SIZE = 20;
