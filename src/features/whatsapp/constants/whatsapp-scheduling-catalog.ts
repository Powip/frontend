import {
  WHATSAPP_CAMPAIGN_DESTINATIONS,
  WHATSAPP_CAMPAIGN_RECURRENCES,
  WHATSAPP_CAMPAIGN_STATUSES,
  WHATSAPP_NOTIFICATION_EVENTS,
  WHATSAPP_OUT_OF_HOURS_POLICIES,
  WHATSAPP_QUEUE_SOURCES,
  WHATSAPP_RULE_KEYS,
  WHATSAPP_RULE_WHEN_MODES,
  WHATSAPP_TEMPLATE_USAGES,
  WHATSAPP_WEEKDAYS,
  type WhatsAppCampaignDestination,
  type WhatsAppCampaignRecurrence,
  type WhatsAppCampaignStatus,
  type WhatsAppNotificationEvent,
  type WhatsAppOutOfHoursPolicy,
  type WhatsAppQueueSource,
  type WhatsAppRuleKey,
  type WhatsAppRuleWhenMode,
  type WhatsAppTemplateUsage,
  type WhatsAppWeekday,
} from "../enums/whatsapp.enums";

export interface WhatsAppRuleDefinition {
  key: WhatsAppRuleKey;
  label: string;
  templateUsage: WhatsAppTemplateUsage;
  supportsReminder: boolean;
}

export const WHATSAPP_RULE_DEFINITIONS: WhatsAppRuleDefinition[] = [
  {
    key: WHATSAPP_RULE_KEYS.GUIDE_CREATED,
    label: "Guía creada",
    templateUsage: WHATSAPP_TEMPLATE_USAGES.GUIDE_CREATED,
    supportsReminder: false,
  },
  {
    key: WHATSAPP_RULE_KEYS.IN_TRANSIT,
    label: "Pedido en camino",
    templateUsage: WHATSAPP_TEMPLATE_USAGES.IN_TRANSIT,
    supportsReminder: false,
  },
  {
    key: WHATSAPP_RULE_KEYS.AT_AGENCY,
    label: "Disponible en agencia",
    templateUsage: WHATSAPP_TEMPLATE_USAGES.AT_AGENCY,
    supportsReminder: true,
  },
  {
    key: WHATSAPP_RULE_KEYS.OUT_FOR_DELIVERY,
    label: "En reparto hoy",
    templateUsage: WHATSAPP_TEMPLATE_USAGES.OUT_FOR_DELIVERY,
    supportsReminder: false,
  },
  {
    key: WHATSAPP_RULE_KEYS.DELIVERED,
    label: "Pedido entregado",
    templateUsage: WHATSAPP_TEMPLATE_USAGES.DELIVERED,
    supportsReminder: false,
  },
  {
    key: WHATSAPP_RULE_KEYS.INCIDENT,
    label: "Incidencia en el envío",
    templateUsage: WHATSAPP_TEMPLATE_USAGES.INCIDENT,
    supportsReminder: false,
  },
  {
    key: WHATSAPP_RULE_KEYS.INVOICE_ISSUED,
    label: "Comprobante emitido",
    templateUsage: WHATSAPP_TEMPLATE_USAGES.INVOICE_ISSUED,
    supportsReminder: false,
  },
  {
    key: WHATSAPP_RULE_KEYS.DELIVERY_SURVEY,
    label: "Encuesta post-entrega",
    templateUsage: WHATSAPP_TEMPLATE_USAGES.DELIVERY_SURVEY,
    supportsReminder: false,
  },
  {
    key: WHATSAPP_RULE_KEYS.COD_BALANCE,
    label: "Saldo pendiente",
    templateUsage: WHATSAPP_TEMPLATE_USAGES.COD_BALANCE,
    supportsReminder: false,
  },
];

export const WHATSAPP_RULE_WHEN_MODE_LABELS: Record<WhatsAppRuleWhenMode, string> = {
  [WHATSAPP_RULE_WHEN_MODES.IMMEDIATELY]: "Apenas cambie el estado",
  [WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES]: "Minutos después",
  [WHATSAPP_RULE_WHEN_MODES.FIXED_TIME]: "A una hora fija",
  [WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY]: "Horas antes de la entrega estimada",
};

export const WHATSAPP_WEEKDAY_OPTIONS: { value: WhatsAppWeekday; short: string; label: string }[] =
  [
    { value: WHATSAPP_WEEKDAYS.MONDAY, short: "Lun", label: "Lunes" },
    { value: WHATSAPP_WEEKDAYS.TUESDAY, short: "Mar", label: "Martes" },
    { value: WHATSAPP_WEEKDAYS.WEDNESDAY, short: "Mié", label: "Miércoles" },
    { value: WHATSAPP_WEEKDAYS.THURSDAY, short: "Jue", label: "Jueves" },
    { value: WHATSAPP_WEEKDAYS.FRIDAY, short: "Vie", label: "Viernes" },
    { value: WHATSAPP_WEEKDAYS.SATURDAY, short: "Sáb", label: "Sábado" },
    { value: WHATSAPP_WEEKDAYS.SUNDAY, short: "Dom", label: "Domingo" },
  ];

export const WHATSAPP_OUT_OF_HOURS_OPTIONS: { value: WhatsAppOutOfHoursPolicy; label: string }[] = [
  {
    value: WHATSAPP_OUT_OF_HOURS_POLICIES.DEFER,
    label: "Enviarlo al inicio del siguiente horario",
  },
  { value: WHATSAPP_OUT_OF_HOURS_POLICIES.DROP, label: "No enviarlo" },
];

export const WHATSAPP_QUEUE_SOURCE_LABELS: Record<WhatsAppQueueSource, string> = {
  [WHATSAPP_QUEUE_SOURCES.RULE]: "Aviso automático",
  [WHATSAPP_QUEUE_SOURCES.REMINDER]: "Recordatorio",
  [WHATSAPP_QUEUE_SOURCES.CAMPAIGN]: "Envío programado",
};

export const WHATSAPP_CAMPAIGN_STAGE_OPTIONS: {
  value: WhatsAppNotificationEvent;
  label: string;
}[] = [
  { value: WHATSAPP_NOTIFICATION_EVENTS.IN_TRANSIT, label: "En camino" },
  { value: WHATSAPP_NOTIFICATION_EVENTS.AT_AGENCY, label: "Disponible en agencia" },
  { value: WHATSAPP_NOTIFICATION_EVENTS.OUT_FOR_DELIVERY, label: "En reparto" },
];

export const WHATSAPP_CAMPAIGN_DESTINATION_OPTIONS: {
  value: WhatsAppCampaignDestination;
  label: string;
}[] = [
  { value: WHATSAPP_CAMPAIGN_DESTINATIONS.ALL, label: "Todo el Perú" },
  { value: WHATSAPP_CAMPAIGN_DESTINATIONS.LIMA, label: "Solo Lima" },
  { value: WHATSAPP_CAMPAIGN_DESTINATIONS.PROVINCES, label: "Solo provincia" },
];

export const WHATSAPP_CAMPAIGN_RECURRENCE_OPTIONS: {
  value: WhatsAppCampaignRecurrence;
  label: string;
}[] = [
  { value: WHATSAPP_CAMPAIGN_RECURRENCES.DAILY, label: "Todos los días" },
  { value: WHATSAPP_CAMPAIGN_RECURRENCES.MONDAY_TO_SATURDAY, label: "Lunes a sábado" },
  { value: WHATSAPP_CAMPAIGN_RECURRENCES.WEEKLY_MONDAY, label: "Cada lunes" },
];

export const WHATSAPP_CAMPAIGN_STATUS_LABELS: Record<WhatsAppCampaignStatus, string> = {
  [WHATSAPP_CAMPAIGN_STATUSES.SCHEDULED]: "Programado",
  [WHATSAPP_CAMPAIGN_STATUSES.ACTIVE]: "Activo",
  [WHATSAPP_CAMPAIGN_STATUSES.PAUSED]: "Pausado",
  [WHATSAPP_CAMPAIGN_STATUSES.COMPLETED]: "Completado",
};

export const WHATSAPP_SCHEDULING_LIMITS = {
  delayMinutes: { min: 1, max: 10080 },
  hoursBeforeDelivery: { min: 1, max: 168 },
  reminderHours: { min: 1, max: 168 },
  maxOrderAgeDays: { min: 1, max: 365 },
  maxPerOrderPerDay: { min: 1, max: 10 },
  campaignName: 80,
} as const;

export const WHATSAPP_SENDING_SETTINGS_SUGGESTED = {
  days: [
    WHATSAPP_WEEKDAYS.MONDAY,
    WHATSAPP_WEEKDAYS.TUESDAY,
    WHATSAPP_WEEKDAYS.WEDNESDAY,
    WHATSAPP_WEEKDAYS.THURSDAY,
    WHATSAPP_WEEKDAYS.FRIDAY,
    WHATSAPP_WEEKDAYS.SATURDAY,
  ] as WhatsAppWeekday[],
  from: "08:00",
  to: "21:00",
  outOfHours: WHATSAPP_OUT_OF_HOURS_POLICIES.DEFER as WhatsAppOutOfHoursPolicy,
  dedupe: true,
  maxPerOrderPerDay: 3,
  notifyAgent: true,
  sendWhenFixed: true,
};

export function getRuleDefinition(key: string | null | undefined): WhatsAppRuleDefinition | null {
  return WHATSAPP_RULE_DEFINITIONS.find((definition) => definition.key === key) ?? null;
}

export function getRuleDefinitionForTemplateUsage(
  usage: WhatsAppTemplateUsage | null | undefined,
): WhatsAppRuleDefinition | null {
  return WHATSAPP_RULE_DEFINITIONS.find((definition) => definition.templateUsage === usage) ?? null;
}
