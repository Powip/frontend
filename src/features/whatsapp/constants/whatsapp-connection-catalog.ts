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
}

/** What an app-only number cannot do. Shown wherever the person chooses or sees that type. */
export const APP_ONLY_LIMITATIONS = [
  "No envía solo: una persona abre cada mensaje y toca «Enviar».",
  "No recibe mensajes en Powip.",
  "Sin Bandeja ni Pau.",
  "Sin estados entregado ni leído.",
];

export const CONNECTION_TYPE_DEFINITIONS: ConnectionTypeDefinition[] = [
  {
    value: WHATSAPP_CONNECTION_TYPES.API,
    title: "API oficial de WhatsApp",
    badge: "Recomendado",
    summary: "Número dedicado a POWIP conectado a la Cloud API.",
    advantages: ["Envío automático y programado.", "Estados enviado, entregado y leído."],
    limitations: ["Ese número deja de funcionar en la app del celular."],
    statusLabel: "Conectado · API oficial",
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
  },
  {
    value: WHATSAPP_CONNECTION_TYPES.APP_MANUAL,
    title: "Solo app WhatsApp Business",
    badge: "Envío manual",
    summary:
      "El número vive solo en la app del celular. Powip deja el mensaje escrito y una persona lo envía.",
    advantages: ["Sin Meta ni costo por mensaje.", "El número sigue igual en el celular."],
    limitations: APP_ONLY_LIMITATIONS,
    statusLabel: "Solo app Business · envío manual",
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
