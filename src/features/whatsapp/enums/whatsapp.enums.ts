export const WHATSAPP_MESSAGE_STATUSES = {
  QUEUED: "queued",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
  SKIPPED: "skipped",
  ASSISTED: "assisted",
} as const;

export type WhatsAppMessageStatus =
  (typeof WHATSAPP_MESSAGE_STATUSES)[keyof typeof WHATSAPP_MESSAGE_STATUSES];

export const WHATSAPP_MESSAGE_DIRECTIONS = {
  OUTBOUND: "out",
  INBOUND: "in",
} as const;

export type WhatsAppMessageDirection =
  (typeof WHATSAPP_MESSAGE_DIRECTIONS)[keyof typeof WHATSAPP_MESSAGE_DIRECTIONS];

export const WHATSAPP_MESSAGE_KINDS = {
  TEMPLATE: "template",
  TEXT: "text",
  AUTO_REPLY: "auto",
  ECHO: "echo",
  NOTE: "note",
  EVIDENCE: "evidence",
} as const;

export type WhatsAppMessageKind =
  (typeof WHATSAPP_MESSAGE_KINDS)[keyof typeof WHATSAPP_MESSAGE_KINDS];

export const WHATSAPP_THREAD_COLUMNS = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  REPLIED: "replied",
  FAILED: "failed",
} as const;

export type WhatsAppThreadColumn =
  (typeof WHATSAPP_THREAD_COLUMNS)[keyof typeof WHATSAPP_THREAD_COLUMNS];

export const WHATSAPP_TEMPLATE_STATUSES = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PAUSED: "PAUSED",
} as const;

export type WhatsAppTemplateStatus =
  (typeof WHATSAPP_TEMPLATE_STATUSES)[keyof typeof WHATSAPP_TEMPLATE_STATUSES];

export const WHATSAPP_TEMPLATE_CATEGORIES = {
  UTILITY: "UTILITY",
  MARKETING: "MARKETING",
} as const;

export type WhatsAppTemplateCategory =
  (typeof WHATSAPP_TEMPLATE_CATEGORIES)[keyof typeof WHATSAPP_TEMPLATE_CATEGORIES];

export const WHATSAPP_TEMPLATE_HEADER_TYPES = {
  NONE: "none",
  TEXT: "text",
  DOCUMENT: "document",
} as const;

export type WhatsAppTemplateHeaderType =
  (typeof WHATSAPP_TEMPLATE_HEADER_TYPES)[keyof typeof WHATSAPP_TEMPLATE_HEADER_TYPES];

export const WHATSAPP_TEMPLATE_USAGES = {
  GUIDE_CREATED: "guia_creada",
  IN_TRANSIT: "pedido_en_camino",
  AT_AGENCY: "disponible_agencia",
  OUT_FOR_DELIVERY: "en_reparto_hoy",
  DELIVERED: "pedido_entregado",
  INCIDENT: "incidencia_envio",
  INVOICE_ISSUED: "comprobante_emitido",
  DELIVERY_SURVEY: "encuesta_entrega",
  COD_BALANCE: "saldo_pendiente",
  SCHEDULED_ONLY: "solo_envios_programados",
} as const;

export type WhatsAppTemplateUsage =
  (typeof WHATSAPP_TEMPLATE_USAGES)[keyof typeof WHATSAPP_TEMPLATE_USAGES];

export const WHATSAPP_TEMPLATE_LANGUAGES = {
  SPANISH_PERU: "es_PE",
  SPANISH: "es",
} as const;

export type WhatsAppTemplateLanguage =
  (typeof WHATSAPP_TEMPLATE_LANGUAGES)[keyof typeof WHATSAPP_TEMPLATE_LANGUAGES];

export const WHATSAPP_AB_VARIANTS = {
  A: "A",
  B: "B",
} as const;

export type WhatsAppAbVariant = (typeof WHATSAPP_AB_VARIANTS)[keyof typeof WHATSAPP_AB_VARIANTS];

export const WHATSAPP_NOTIFICATION_EVENTS = {
  GUIDE_CREATED: "GUIA_CREADA",
  IN_TRANSIT: "EN_ENVIO",
  AT_AGENCY: "EN_AGENCIA",
  OUT_FOR_DELIVERY: "EN_REPARTO",
  DELIVERED: "ENTREGADO",
  INCIDENT: "INCIDENCIA",
  COD_BALANCE: "SALDO_COD",
  INVOICE_ACCEPTED: "COMPROBANTE_ACEPTADO",
} as const;

export type WhatsAppNotificationEvent =
  (typeof WHATSAPP_NOTIFICATION_EVENTS)[keyof typeof WHATSAPP_NOTIFICATION_EVENTS];

export const WHATSAPP_RULE_WHEN_MODES = {
  IMMEDIATELY: "now",
  DELAY_MINUTES: "delay",
  FIXED_TIME: "fixed",
  HOURS_BEFORE_DELIVERY: "before",
} as const;

export type WhatsAppRuleWhenMode =
  (typeof WHATSAPP_RULE_WHEN_MODES)[keyof typeof WHATSAPP_RULE_WHEN_MODES];

export const WHATSAPP_RULE_KEYS = {
  GUIDE_CREATED: "guia_creada",
  IN_TRANSIT: "pedido_en_camino",
  AT_AGENCY: "disponible_agencia",
  OUT_FOR_DELIVERY: "en_reparto_hoy",
  DELIVERED: "pedido_entregado",
  INCIDENT: "incidencia_envio",
  INVOICE_ISSUED: "comprobante_emitido",
  DELIVERY_SURVEY: "encuesta_entrega",
  COD_BALANCE: "saldo_pendiente",
} as const;

export type WhatsAppRuleKey = (typeof WHATSAPP_RULE_KEYS)[keyof typeof WHATSAPP_RULE_KEYS];

export const WHATSAPP_RULE_DATE_MODES = {
  SINCE_ACTIVATION: "since_activation",
  RANGE: "range",
} as const;

export type WhatsAppRuleDateMode =
  (typeof WHATSAPP_RULE_DATE_MODES)[keyof typeof WHATSAPP_RULE_DATE_MODES];

export const WHATSAPP_WEEKDAYS = {
  MONDAY: "MON",
  TUESDAY: "TUE",
  WEDNESDAY: "WED",
  THURSDAY: "THU",
  FRIDAY: "FRI",
  SATURDAY: "SAT",
  SUNDAY: "SUN",
} as const;

export type WhatsAppWeekday = (typeof WHATSAPP_WEEKDAYS)[keyof typeof WHATSAPP_WEEKDAYS];

export const WHATSAPP_OUT_OF_HOURS_POLICIES = {
  DEFER: "defer",
  DROP: "drop",
} as const;

export type WhatsAppOutOfHoursPolicy =
  (typeof WHATSAPP_OUT_OF_HOURS_POLICIES)[keyof typeof WHATSAPP_OUT_OF_HOURS_POLICIES];

export const WHATSAPP_QUEUE_SOURCES = {
  RULE: "rule",
  REMINDER: "reminder",
  CAMPAIGN: "campaign",
} as const;

export type WhatsAppQueueSource =
  (typeof WHATSAPP_QUEUE_SOURCES)[keyof typeof WHATSAPP_QUEUE_SOURCES];

export const WHATSAPP_CAMPAIGN_RECURRENCES = {
  DAILY: "daily",
  MONDAY_TO_SATURDAY: "mon_sat",
  WEEKLY_MONDAY: "weekly_mon",
} as const;

export type WhatsAppCampaignRecurrence =
  (typeof WHATSAPP_CAMPAIGN_RECURRENCES)[keyof typeof WHATSAPP_CAMPAIGN_RECURRENCES];

export const WHATSAPP_CAMPAIGN_DESTINATIONS = {
  ALL: "all",
  LIMA: "lima",
  PROVINCES: "provinces",
} as const;

export type WhatsAppCampaignDestination =
  (typeof WHATSAPP_CAMPAIGN_DESTINATIONS)[keyof typeof WHATSAPP_CAMPAIGN_DESTINATIONS];

export const WHATSAPP_CAMPAIGN_STATUSES = {
  SCHEDULED: "scheduled",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
} as const;

export type WhatsAppCampaignStatus =
  (typeof WHATSAPP_CAMPAIGN_STATUSES)[keyof typeof WHATSAPP_CAMPAIGN_STATUSES];

export const WHATSAPP_CAMPAIGN_SCHEDULE_TYPES = {
  ONCE: "once",
  RECURRING: "recurring",
} as const;

export type WhatsAppCampaignScheduleType =
  (typeof WHATSAPP_CAMPAIGN_SCHEDULE_TYPES)[keyof typeof WHATSAPP_CAMPAIGN_SCHEDULE_TYPES];

export const WHATSAPP_TABS = {
  CONNECTION: "conexion",
  TEMPLATES: "plantillas",
  SCHEDULING: "programacion",
  CONVERSATIONS: "conversaciones",
  HISTORY: "historial",
  SETTINGS: "ajustes",
} as const;

export type WhatsAppTab = (typeof WHATSAPP_TABS)[keyof typeof WHATSAPP_TABS];

export const WHATSAPP_CONTRACT_STATUSES = {
  CONFIRMED: "confirmed",
  PROPOSED_IN_SPEC: "proposed_in_spec",
  PROPOSED: "proposed",
  UNDEFINED: "undefined",
} as const;

export type WhatsAppContractStatus =
  (typeof WHATSAPP_CONTRACT_STATUSES)[keyof typeof WHATSAPP_CONTRACT_STATUSES];

export const WHATSAPP_MEDIA_TYPES = {
  IMAGE: "image",
  AUDIO: "audio",
  VIDEO: "video",
  DOCUMENT: "document",
  STICKER: "sticker",
} as const;

export type WhatsAppMediaType = (typeof WHATSAPP_MEDIA_TYPES)[keyof typeof WHATSAPP_MEDIA_TYPES];

export const WHATSAPP_EVIDENCE_TYPES = {
  PREPARATION: "PREPARATION",
  DISPATCH: "DISPATCH",
  DELIVERY: "DELIVERY",
} as const;

export type WhatsAppEvidenceType =
  (typeof WHATSAPP_EVIDENCE_TYPES)[keyof typeof WHATSAPP_EVIDENCE_TYPES];

export const WHATSAPP_CONVERSATION_VIEWS = {
  BOARD: "board",
  LIST: "list",
} as const;

export type WhatsAppConversationView =
  (typeof WHATSAPP_CONVERSATION_VIEWS)[keyof typeof WHATSAPP_CONVERSATION_VIEWS];

export const WHATSAPP_HISTORY_PERIODS = {
  TODAY: "today",
  LAST_7_DAYS: "7d",
  THIS_MONTH: "month",
} as const;

export type WhatsAppHistoryPeriod =
  (typeof WHATSAPP_HISTORY_PERIODS)[keyof typeof WHATSAPP_HISTORY_PERIODS];

export const WHATSAPP_HISTORY_STATUS_FILTERS = {
  ALL: "all",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  NOT_SENT: "not_sent",
  ASSISTED: "assisted",
} as const;

export type WhatsAppHistoryStatusFilter =
  (typeof WHATSAPP_HISTORY_STATUS_FILTERS)[keyof typeof WHATSAPP_HISTORY_STATUS_FILTERS];

export const WHATSAPP_OPT_OUT_ORIGINS = {
  KEYWORD: "keyword",
  AGENT: "agent",
  META_BLOCK: "meta_block",
  MANUAL: "manual",
} as const;

export type WhatsAppOptOutOrigin =
  (typeof WHATSAPP_OPT_OUT_ORIGINS)[keyof typeof WHATSAPP_OPT_OUT_ORIGINS];

export const WHATSAPP_ALERT_TYPES = {
  QUALITY: "quality",
  TEMPLATE: "template",
  FAILED_PCT: "failed_pct",
  DAILY_LIMIT_PCT: "daily_limit_pct",
  UNATTENDED_MINUTES: "unattended_minutes",
} as const;

export type WhatsAppAlertType = (typeof WHATSAPP_ALERT_TYPES)[keyof typeof WHATSAPP_ALERT_TYPES];

export const WHATSAPP_ALERT_RECIPIENTS = {
  BELL_AND_WHATSAPP: "admins_bell_and_whatsapp",
  BELL_ONLY: "admins_bell_only",
} as const;

export type WhatsAppAlertRecipients =
  (typeof WHATSAPP_ALERT_RECIPIENTS)[keyof typeof WHATSAPP_ALERT_RECIPIENTS];

export const WHATSAPP_FOREIGN_INBOUND_POLICIES = {
  NORMAL: "normal",
  REPLY_ONCE: "reply_once",
  IGNORE: "ignore",
} as const;

export type WhatsAppForeignInboundPolicy =
  (typeof WHATSAPP_FOREIGN_INBOUND_POLICIES)[keyof typeof WHATSAPP_FOREIGN_INBOUND_POLICIES];

export const WHATSAPP_AUDIT_ENTITIES = {
  TEMPLATE: "template",
  RULE: "rule",
  SCHEDULE: "schedule",
  OPT_OUT: "optout",
  CONNECTION: "connection",
  PERMISSION: "permission",
  ALERT: "alert",
  SETTINGS: "settings",
} as const;

export type WhatsAppAuditEntity =
  (typeof WHATSAPP_AUDIT_ENTITIES)[keyof typeof WHATSAPP_AUDIT_ENTITIES];

export const WHATSAPP_PERMISSION_ROLES = {
  ADMIN: "admin",
  CC_SUPERVISOR: "cc_supervisor",
  CC_AGENT: "cc_agent",
} as const;

export type WhatsAppPermissionRole =
  (typeof WHATSAPP_PERMISSION_ROLES)[keyof typeof WHATSAPP_PERMISSION_ROLES];

export const WHATSAPP_PERMISSION_CODES = {
  VIEW: "WA_VIEW",
  REPLY: "WA_REPLY",
  REASSIGN: "WA_REASSIGN",
  TEMPLATES: "WA_TEMPLATES",
  RULES: "WA_RULES",
  CAMPAIGNS: "WA_CAMPAIGNS",
  OPT_OUTS: "WA_OPTOUTS",
  CONNECTION: "WA_CONNECTION",
} as const;

export type WhatsAppPermissionCode =
  (typeof WHATSAPP_PERMISSION_CODES)[keyof typeof WHATSAPP_PERMISSION_CODES];
