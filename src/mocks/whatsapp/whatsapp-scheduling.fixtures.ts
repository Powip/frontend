import {
  WHATSAPP_CAMPAIGN_DESTINATIONS,
  WHATSAPP_CAMPAIGN_RECURRENCES,
  WHATSAPP_CAMPAIGN_SCHEDULE_TYPES,
  WHATSAPP_CAMPAIGN_STATUSES,
  WHATSAPP_NOTIFICATION_EVENTS,
  WHATSAPP_OUT_OF_HOURS_POLICIES,
  WHATSAPP_QUEUE_SOURCES,
  WHATSAPP_RULE_DATE_MODES,
  WHATSAPP_RULE_KEYS,
  WHATSAPP_RULE_WHEN_MODES,
  WHATSAPP_WEEKDAYS,
  type WhatsAppRuleKey,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppCampaign } from "@/features/whatsapp/models/campaign.model";
import type {
  WhatsAppSkippedNotice,
  WhatsAppUpcomingQueue,
} from "@/features/whatsapp/models/queue.model";
import type { WhatsAppResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppRule,
  WhatsAppRulePreview,
  WhatsAppRulesData,
} from "@/features/whatsapp/models/rule.model";
import type { WhatsAppScopeCatalogs } from "@/features/whatsapp/models/scope-catalog.model";
import type { WhatsAppSendingSettings } from "@/features/whatsapp/models/sending-settings.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import {
  abWithWinnerTemplateFixture,
  approvedTemplateFixture,
  draftTemplateFixture,
  invoiceTemplateWithDocumentFixture,
  pausedTemplateFixture,
  pendingNewTemplateFixture,
  pendingWithApprovedVersionTemplateFixture,
  templatesListFixture,
} from "./whatsapp-templates.fixtures";

export const SCHEDULING_FIXTURE_NOW = new Date("2026-10-08T15:00:00.000Z");

const deliveredTemplateFixture: WhatsAppTemplate = {
  ...approvedTemplateFixture,
  id: "tpl-entregado",
  name: "pedido_entregado",
  usage: "pedido_entregado",
  body: "Hola {{cliente}}, confirmamos la entrega de tu pedido *{{orden}}*. ¡Gracias por comprar en {{tienda}}!",
  buttonText: "Ver detalle del pedido",
};

export const schedulingTemplatesFixture: WhatsAppTemplate[] = [
  ...templatesListFixture,
  deliveredTemplateFixture,
];

export const scopeCatalogsFixture: WhatsAppScopeCatalogs = {
  stores: {
    kind: "ready",
    data: [
      { value: "store-livii", label: "LIVII" },
      { value: "store-kunca", label: "KUNCA" },
    ],
  },
  salesChannels: {
    kind: "ready",
    data: [
      { value: "WHATSAPP", label: "WHATSAPP" },
      { value: "WEB", label: "WEB" },
      { value: "INSTAGRAM", label: "INSTAGRAM" },
    ],
  },
  shippingTypes: {
    kind: "ready",
    data: [
      { value: "RETIRO_TIENDA", label: "Retiro en tienda" },
      { value: "DOMICILIO", label: "Domicilio" },
      { value: "PUNTO_EXTERNO", label: "Punto externo" },
    ],
  },
  couriers: {
    kind: "ready",
    data: [
      { value: "courier-moto", label: "Motorizado Propio" },
      { value: "courier-olva", label: "Olva Courier" },
      { value: "courier-shalom", label: "Shalom" },
    ],
  },
};

export const loadingCatalogsFixture: WhatsAppScopeCatalogs = {
  ...scopeCatalogsFixture,
  couriers: { kind: "loading" },
};

export const failingCatalogsFixture: WhatsAppScopeCatalogs = {
  ...scopeCatalogsFixture,
  couriers: { kind: "error", message: "No se pudo cargar la lista de couriers." },
  salesChannels: { kind: "ready", data: [] },
};

const baseScope = {
  dateMode: WHATSAPP_RULE_DATE_MODES.SINCE_ACTIVATION,
  from: null,
  to: null,
  maxOrderAgeDays: 15,
  storeIds: [],
  salesChannels: [],
  shippingTypes: [],
  courierIds: [],
};

const immediate = {
  mode: WHATSAPP_RULE_WHEN_MODES.IMMEDIATELY,
  minutes: null,
  time: null,
  hours: null,
};
const standardModes = [
  WHATSAPP_RULE_WHEN_MODES.IMMEDIATELY,
  WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES,
  WHATSAPP_RULE_WHEN_MODES.FIXED_TIME,
];

function buildRule(
  key: WhatsAppRuleKey,
  overrides: Partial<WhatsAppRule> & Pick<WhatsAppRule, "label" | "templateId">,
): WhatsAppRule {
  return {
    id: `rule-${key}`,
    key,
    triggerLabel: null,
    active: false,
    blockedReason: null,
    when: immediate,
    allowedWhenModes: standardModes,
    reminder: null,
    scope: baseScope,
    stats: null,
    activatedAt: null,
    version: 1,
    ...overrides,
  };
}

export const rulesFixture: WhatsAppRule[] = [
  buildRule(WHATSAPP_RULE_KEYS.GUIDE_CREATED, {
    label: "Guía creada",
    triggerLabel: "Evento GUIA_CREADA informado por el servicio de avisos",
    templateId: approvedTemplateFixture.id,
    active: true,
    stats: {
      sentToday: 38,
      estimatedMonthly: { usd: "14.82", pen: "52", exchangeRate: "3.50", rateDate: null },
    },
  }),
  buildRule(WHATSAPP_RULE_KEYS.IN_TRANSIT, {
    label: "Pedido en camino",
    triggerLabel: "Evento EN_ENVIO informado por el servicio de avisos",
    templateId: abWithWinnerTemplateFixture.id,
    allowedWhenModes: [...standardModes, WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY],
  }),
  buildRule(WHATSAPP_RULE_KEYS.AT_AGENCY, {
    label: "Disponible en agencia",
    templateId: pendingWithApprovedVersionTemplateFixture.id,
    active: true,
    reminder: { enabled: true, hours: 48 },
    scope: {
      ...baseScope,
      shippingTypes: ["PUNTO_EXTERNO"],
      courierIds: ["courier-shalom", "courier-olva"],
    },
    stats: { sentToday: 22, estimatedMonthly: null },
  }),
  buildRule(WHATSAPP_RULE_KEYS.OUT_FOR_DELIVERY, {
    label: "En reparto hoy",
    templateId: abWithWinnerTemplateFixture.id,
    active: true,
    when: { mode: WHATSAPP_RULE_WHEN_MODES.FIXED_TIME, minutes: null, time: "08:30", hours: null },
    scope: { ...baseScope, shippingTypes: ["DOMICILIO"] },
  }),
  buildRule(WHATSAPP_RULE_KEYS.DELIVERED, {
    label: "Pedido entregado",
    templateId: deliveredTemplateFixture.id,
    active: true,
    when: { mode: WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES, minutes: 30, time: null, hours: null },
  }),
  buildRule(WHATSAPP_RULE_KEYS.INCIDENT, {
    label: "Incidencia en el envío",
    templateId: draftTemplateFixture.id,
  }),
  buildRule(WHATSAPP_RULE_KEYS.INVOICE_ISSUED, {
    label: "Comprobante emitido",
    templateId: invoiceTemplateWithDocumentFixture.id,
    scope: {
      ...baseScope,
      dateMode: WHATSAPP_RULE_DATE_MODES.RANGE,
      from: "2026-10-01",
      to: "2026-12-31",
      storeIds: ["store-livii", "store-eliminada"],
    },
  }),
  buildRule(WHATSAPP_RULE_KEYS.DELIVERY_SURVEY, {
    label: "Encuesta post-entrega",
    templateId: pausedTemplateFixture.id,
    when: { mode: WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES, minutes: 1440, time: null, hours: null },
  }),
  buildRule(WHATSAPP_RULE_KEYS.COD_BALANCE, {
    label: "Saldo pendiente",
    templateId: pendingNewTemplateFixture.id,
    allowedWhenModes: [WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY],
    when: {
      mode: WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY,
      minutes: null,
      time: null,
      hours: 24,
    },
    blockedReason: "Falta la fecha de entrega estimada en los pedidos de esta tienda.",
  }),
];

export const rulesDataFixture: WhatsAppRulesData = {
  rules: rulesFixture,
  summary: {
    activeCount: 4,
    estimatedMonthly: { usd: "62.86", pen: "220", exchangeRate: "3.50", rateDate: null },
  },
};

const rulePreviews: Record<string, WhatsAppResourceState<WhatsAppRulePreview>> = {
  [`rule-${WHATSAPP_RULE_KEYS.IN_TRANSIT}`]: {
    kind: "ready",
    data: {
      matchingOrders: 128,
      orderStateLabel: "En envío",
      estimatedCost: { usd: "1.66", pen: "5.82", exchangeRate: "3.50", rateDate: null },
      computedAt: SCHEDULING_FIXTURE_NOW,
    },
  },
  [`rule-${WHATSAPP_RULE_KEYS.INVOICE_ISSUED}`]: {
    kind: "ready",
    data: {
      matchingOrders: 0,
      orderStateLabel: "Comprobante aceptado",
      estimatedCost: null,
      computedAt: SCHEDULING_FIXTURE_NOW,
    },
  },
  [`rule-${WHATSAPP_RULE_KEYS.INCIDENT}`]: { kind: "loading" },
  [`rule-${WHATSAPP_RULE_KEYS.DELIVERY_SURVEY}`]: {
    kind: "error",
    message: "El servicio no pudo calcular el conteo.",
  },
};

export function getRulePreviewFixture(
  rule: WhatsAppRule,
): WhatsAppResourceState<WhatsAppRulePreview> {
  return rulePreviews[rule.id] ?? { kind: "pending-integration" };
}

export const sendingSettingsFixture: WhatsAppSendingSettings = {
  schedule: {
    days: [
      WHATSAPP_WEEKDAYS.MONDAY,
      WHATSAPP_WEEKDAYS.TUESDAY,
      WHATSAPP_WEEKDAYS.WEDNESDAY,
      WHATSAPP_WEEKDAYS.THURSDAY,
      WHATSAPP_WEEKDAYS.FRIDAY,
    ],
    from: "09:00",
    to: "20:00",
    outOfHours: WHATSAPP_OUT_OF_HOURS_POLICIES.DROP,
    timezone: "America/Lima",
  },
  dedupe: true,
  maxPerOrderPerDay: 2,
  missingData: { notifyAgent: false, sendWhenFixed: true },
  version: 4,
};

export const skippedNoticesFixture: WhatsAppSkippedNotice[] = [
  {
    id: "skip-1",
    orderId: "order-149958",
    orderNumber: "ORD-149958",
    customerName: "Ana Soto",
    templateName: "guia_creada",
    reason: "Falta el link de rastreo (el pedido aún no tiene guía)",
    createdAt: new Date("2026-10-08T14:10:00.000Z"),
  },
  {
    id: "skip-2",
    orderId: null,
    orderNumber: "ORD-149941",
    customerName: "Luis Pérez",
    templateName: "pedido_en_camino",
    reason: "El teléfono 01 445 2210 no es un celular",
    createdAt: new Date("2026-10-08T13:45:00.000Z"),
  },
];

export const upcomingQueueFixture: WhatsAppUpcomingQueue = {
  total: 68,
  groups: [
    {
      id: "q-1",
      sendAt: new Date("2026-10-08T17:30:00.000Z"),
      name: "pedido_entregado",
      source: WHATSAPP_QUEUE_SOURCES.RULE,
      sourceLabel: "30 min tras la entrega",
      orders: 6,
      deferred: false,
      deferredTo: null,
      reason: null,
    },
    {
      id: "q-2",
      sendAt: new Date("2026-10-08T19:00:00.000Z"),
      name: "disponible_agencia",
      source: WHATSAPP_QUEUE_SOURCES.REMINDER,
      sourceLabel: "48 h en agencia",
      orders: 9,
      deferred: false,
      deferredTo: null,
      reason: null,
    },
    {
      id: "q-3",
      sendAt: new Date("2026-10-09T02:00:00.000Z"),
      name: "pedido_en_camino",
      source: WHATSAPP_QUEUE_SOURCES.RULE,
      sourceLabel: "Inmediato",
      orders: 11,
      deferred: true,
      deferredTo: new Date("2026-10-09T13:00:00.000Z"),
      reason: "Fuera del horario permitido",
    },
    {
      id: "q-4",
      sendAt: new Date("2026-10-09T14:00:00.000Z"),
      name: "Aviso de retraso por feriado",
      source: WHATSAPP_QUEUE_SOURCES.CAMPAIGN,
      sourceLabel: "Envío programado",
      orders: 42,
      deferred: false,
      deferredTo: null,
      reason: null,
    },
  ],
};

export const campaignsFixture: WhatsAppCampaign[] = [
  {
    id: "camp-1",
    name: "Aviso de retraso por feriado",
    templateId: abWithWinnerTemplateFixture.id,
    templateName: abWithWinnerTemplateFixture.name,
    segment: {
      stage: WHATSAPP_NOTIFICATION_EVENTS.IN_TRANSIT,
      courierId: "courier-shalom",
      storeId: "store-livii",
      destination: WHATSAPP_CAMPAIGN_DESTINATIONS.ALL,
    },
    segmentLabel: null,
    schedule: {
      type: WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.ONCE,
      date: "2026-10-09",
      recurrence: null,
      time: "09:00",
    },
    status: WHATSAPP_CAMPAIGN_STATUSES.SCHEDULED,
    pausedReason: null,
    matchingToday: 42,
    results: null,
    version: 1,
  },
  {
    id: "camp-2",
    name: "Recordatorio de recojo (+3 días en agencia)",
    templateId: pendingWithApprovedVersionTemplateFixture.id,
    templateName: pendingWithApprovedVersionTemplateFixture.name,
    segment: {
      stage: WHATSAPP_NOTIFICATION_EVENTS.AT_AGENCY,
      courierId: null,
      storeId: "store-livii",
      destination: WHATSAPP_CAMPAIGN_DESTINATIONS.PROVINCES,
    },
    segmentLabel: null,
    schedule: {
      type: WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.RECURRING,
      date: null,
      recurrence: WHATSAPP_CAMPAIGN_RECURRENCES.DAILY,
      time: "10:00",
    },
    status: WHATSAPP_CAMPAIGN_STATUSES.ACTIVE,
    pausedReason: null,
    matchingToday: null,
    results: null,
    version: 3,
  },
  {
    id: "camp-3",
    name: "Avisos de reparto en Lima",
    templateId: abWithWinnerTemplateFixture.id,
    templateName: abWithWinnerTemplateFixture.name,
    segment: {
      stage: WHATSAPP_NOTIFICATION_EVENTS.OUT_FOR_DELIVERY,
      courierId: "courier-moto",
      storeId: "store-kunca",
      destination: WHATSAPP_CAMPAIGN_DESTINATIONS.LIMA,
    },
    segmentLabel: null,
    schedule: {
      type: WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.RECURRING,
      date: null,
      recurrence: WHATSAPP_CAMPAIGN_RECURRENCES.MONDAY_TO_SATURDAY,
      time: "08:00",
    },
    status: WHATSAPP_CAMPAIGN_STATUSES.PAUSED,
    pausedReason: "quality_red",
    matchingToday: 17,
    results: null,
    version: 2,
  },
  {
    id: "camp-4",
    name: "Entregas de Lima – confirmación",
    templateId: deliveredTemplateFixture.id,
    templateName: deliveredTemplateFixture.name,
    segment: {
      stage: WHATSAPP_NOTIFICATION_EVENTS.OUT_FOR_DELIVERY,
      courierId: null,
      storeId: "store-livii",
      destination: WHATSAPP_CAMPAIGN_DESTINATIONS.LIMA,
    },
    segmentLabel: "Entregado ayer · Solo Lima",
    schedule: {
      type: WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.ONCE,
      date: "2026-10-05",
      recurrence: null,
      time: "18:00",
    },
    status: WHATSAPP_CAMPAIGN_STATUSES.COMPLETED,
    pausedReason: null,
    matchingToday: null,
    results: { sent: 118, delivered: 115, read: 96, clicked: 40, notSent: 3 },
    version: 5,
  },
  {
    id: "camp-5",
    name: "Encuesta de septiembre",
    templateId: pausedTemplateFixture.id,
    templateName: pausedTemplateFixture.name,
    segment: {
      stage: WHATSAPP_NOTIFICATION_EVENTS.OUT_FOR_DELIVERY,
      courierId: null,
      storeId: "store-livii",
      destination: WHATSAPP_CAMPAIGN_DESTINATIONS.ALL,
    },
    segmentLabel: null,
    schedule: {
      type: WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.ONCE,
      date: "2026-09-30",
      recurrence: null,
      time: "11:00",
    },
    status: WHATSAPP_CAMPAIGN_STATUSES.COMPLETED,
    pausedReason: null,
    matchingToday: null,
    results: null,
    version: 1,
  },
];
