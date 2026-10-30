import {
  WHATSAPP_ALERT_RECIPIENTS,
  WHATSAPP_ALERT_TYPES,
  WHATSAPP_AUDIT_ENTITIES,
  WHATSAPP_FOREIGN_INBOUND_POLICIES,
  WHATSAPP_HISTORY_PERIODS,
  WHATSAPP_HISTORY_STATUS_FILTERS,
  WHATSAPP_OPT_OUT_ORIGINS,
  WHATSAPP_PERMISSION_CODES,
  WHATSAPP_PERMISSION_ROLES,
  type WhatsAppAlertRecipients,
  type WhatsAppAlertType,
  type WhatsAppAuditEntity,
  type WhatsAppForeignInboundPolicy,
  type WhatsAppHistoryPeriod,
  type WhatsAppHistoryStatusFilter,
  type WhatsAppOptOutOrigin,
  type WhatsAppPermissionCode,
  type WhatsAppPermissionRole,
} from "../enums/whatsapp.enums";

export const HISTORY_PAGE_SIZE = 50;
export const OPT_OUT_PAGE_SIZE = 50;
export const AUDIT_PAGE_SIZE = 20;
export const RECENT_ALERTS_DAYS = 7;

export const HISTORY_PERIOD_OPTIONS: { value: WhatsAppHistoryPeriod; label: string }[] = [
  { value: WHATSAPP_HISTORY_PERIODS.TODAY, label: "Hoy" },
  { value: WHATSAPP_HISTORY_PERIODS.LAST_7_DAYS, label: "Últimos 7 días" },
  { value: WHATSAPP_HISTORY_PERIODS.THIS_MONTH, label: "Este mes" },
];

export const DEFAULT_HISTORY_PERIOD: WhatsAppHistoryPeriod = WHATSAPP_HISTORY_PERIODS.LAST_7_DAYS;

export const HISTORY_STATUS_FILTER_OPTIONS: {
  value: WhatsAppHistoryStatusFilter;
  label: string;
}[] = [
  { value: WHATSAPP_HISTORY_STATUS_FILTERS.ALL, label: "Todos" },
  { value: WHATSAPP_HISTORY_STATUS_FILTERS.SENT, label: "Enviado" },
  { value: WHATSAPP_HISTORY_STATUS_FILTERS.DELIVERED, label: "Entregado" },
  { value: WHATSAPP_HISTORY_STATUS_FILTERS.READ, label: "Leído" },
  { value: WHATSAPP_HISTORY_STATUS_FILTERS.NOT_SENT, label: "No enviado" },
  { value: WHATSAPP_HISTORY_STATUS_FILTERS.ASSISTED, label: "Asistido" },
];

export const OPT_OUT_ORIGIN_LABELS: Record<WhatsAppOptOutOrigin, string> = {
  [WHATSAPP_OPT_OUT_ORIGINS.KEYWORD]: "Escribió STOP, BAJA o NO MÁS",
  [WHATSAPP_OPT_OUT_ORIGINS.AGENT]: "Lo pidió a la asesora",
  [WHATSAPP_OPT_OUT_ORIGINS.META_BLOCK]: "Meta informó que bloqueó el número",
  [WHATSAPP_OPT_OUT_ORIGINS.MANUAL]: "Agregado a mano",
};

export const OPT_OUT_UNKNOWN_ORIGIN_LABEL = "Origen sin informar";

export interface AlertDefinition {
  type: WhatsAppAlertType;
  label: string;
  unit: "percent" | "minutes" | null;
  min: number | null;
  max: number | null;
  suggestedThreshold: number | null;
  relatedTabLabel: string;
}

export const ALERT_DEFINITIONS: AlertDefinition[] = [
  {
    type: WHATSAPP_ALERT_TYPES.QUALITY,
    label: "La calidad del número baja a media o roja",
    unit: null,
    min: null,
    max: null,
    suggestedThreshold: null,
    relatedTabLabel: "Conexión",
  },
  {
    type: WHATSAPP_ALERT_TYPES.TEMPLATE,
    label: "Meta pausa o rechaza una plantilla en uso",
    unit: null,
    min: null,
    max: null,
    suggestedThreshold: null,
    relatedTabLabel: "Plantillas",
  },
  {
    type: WHATSAPP_ALERT_TYPES.FAILED_PCT,
    label: "Avisos no enviados en 1 hora",
    unit: "percent",
    min: 1,
    max: 100,
    suggestedThreshold: 5,
    relatedTabLabel: "Historial de envíos",
  },
  {
    type: WHATSAPP_ALERT_TYPES.DAILY_LIMIT_PCT,
    label: "Uso del límite diario de Meta",
    unit: "percent",
    min: 1,
    max: 100,
    suggestedThreshold: 80,
    relatedTabLabel: "Conexión",
  },
  {
    type: WHATSAPP_ALERT_TYPES.UNATTENDED_MINUTES,
    label: "Respuestas de clientes sin atender",
    unit: "minutes",
    min: 1,
    max: 1440,
    suggestedThreshold: 30,
    relatedTabLabel: "Conversaciones",
  },
];

export function getAlertDefinition(type: WhatsAppAlertType): AlertDefinition {
  const definition = ALERT_DEFINITIONS.find((item) => item.type === type);
  if (!definition) throw new Error(`Alerta desconocida: ${type}`);
  return definition;
}

export const ALERT_RECIPIENT_OPTIONS: { value: WhatsAppAlertRecipients; label: string }[] = [
  {
    value: WHATSAPP_ALERT_RECIPIENTS.BELL_AND_WHATSAPP,
    label: "Administradores · campanita de POWIP y WhatsApp",
  },
  { value: WHATSAPP_ALERT_RECIPIENTS.BELL_ONLY, label: "Administradores · solo campanita" },
];

export const ALERT_SETTINGS_SUGGESTED = {
  recipients: WHATSAPP_ALERT_RECIPIENTS.BELL_AND_WHATSAPP,
  pauseCampaignsOnRed: true,
} as const;

export const FOREIGN_INBOUND_OPTIONS: {
  value: WhatsAppForeignInboundPolicy;
  label: string;
  description: string | null;
}[] = [
  { value: WHATSAPP_FOREIGN_INBOUND_POLICIES.NORMAL, label: "Responder normal", description: null },
  {
    value: WHATSAPP_FOREIGN_INBOUND_POLICIES.REPLY_ONCE,
    label: "Responder una vez y cerrar",
    description: "Envía la respuesta automática y archiva la conversación.",
  },
  {
    value: WHATSAPP_FOREIGN_INBOUND_POLICIES.IGNORE,
    label: "Ignorar",
    description: "No se responde ni aparece en el tablero.",
  },
];

export const PROTECTION_SETTINGS_SUGGESTED = {
  optOutByKeyword: true,
  foreignInbound: WHATSAPP_FOREIGN_INBOUND_POLICIES.NORMAL,
  allowForeignOutbound: false,
} as const;

export const AUDIT_ENTITY_LABELS: Record<WhatsAppAuditEntity, string> = {
  [WHATSAPP_AUDIT_ENTITIES.TEMPLATE]: "Plantillas",
  [WHATSAPP_AUDIT_ENTITIES.RULE]: "Reglas",
  [WHATSAPP_AUDIT_ENTITIES.SCHEDULE]: "Horario",
  [WHATSAPP_AUDIT_ENTITIES.OPT_OUT]: "Bajas",
  [WHATSAPP_AUDIT_ENTITIES.CONNECTION]: "Conexión",
  [WHATSAPP_AUDIT_ENTITIES.PERMISSION]: "Permisos",
  [WHATSAPP_AUDIT_ENTITIES.ALERT]: "Alertas",
  [WHATSAPP_AUDIT_ENTITIES.SETTINGS]: "Ajustes",
};

export const PERMISSION_ROLE_LABELS: Record<WhatsAppPermissionRole, string> = {
  [WHATSAPP_PERMISSION_ROLES.ADMIN]: "Administrador",
  [WHATSAPP_PERMISSION_ROLES.CC_SUPERVISOR]: "Supervisor CC",
  [WHATSAPP_PERMISSION_ROLES.CC_AGENT]: "Asesora",
};

export const PERMISSION_ROLE_ORDER: WhatsAppPermissionRole[] = [
  WHATSAPP_PERMISSION_ROLES.ADMIN,
  WHATSAPP_PERMISSION_ROLES.CC_SUPERVISOR,
  WHATSAPP_PERMISSION_ROLES.CC_AGENT,
];

export interface PermissionDefinition {
  code: WhatsAppPermissionCode;
  label: string;
  documented: Record<WhatsAppPermissionRole, boolean>;
}

const grant = (admin: boolean, supervisor: boolean, agent: boolean) => ({
  [WHATSAPP_PERMISSION_ROLES.ADMIN]: admin,
  [WHATSAPP_PERMISSION_ROLES.CC_SUPERVISOR]: supervisor,
  [WHATSAPP_PERMISSION_ROLES.CC_AGENT]: agent,
});

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    code: WHATSAPP_PERMISSION_CODES.VIEW,
    label: "Ver conversaciones",
    documented: grant(true, true, true),
  },
  {
    code: WHATSAPP_PERMISSION_CODES.REPLY,
    label: "Responder a clientes",
    documented: grant(true, true, true),
  },
  {
    code: WHATSAPP_PERMISSION_CODES.REASSIGN,
    label: "Reasignar conversaciones",
    documented: grant(true, true, false),
  },
  {
    code: WHATSAPP_PERMISSION_CODES.TEMPLATES,
    label: "Crear y editar plantillas",
    documented: grant(true, true, false),
  },
  {
    code: WHATSAPP_PERMISSION_CODES.RULES,
    label: "Activar o cambiar avisos automáticos",
    documented: grant(true, false, false),
  },
  {
    code: WHATSAPP_PERMISSION_CODES.CAMPAIGNS,
    label: "Programar envíos masivos",
    documented: grant(true, true, false),
  },
  {
    code: WHATSAPP_PERMISSION_CODES.OPT_OUTS,
    label: "Dar de baja o reactivar clientes",
    documented: grant(true, true, false),
  },
  {
    code: WHATSAPP_PERMISSION_CODES.CONNECTION,
    label: "Conectar o desconectar el número",
    documented: grant(true, false, false),
  },
];
