import {
  WHATSAPP_ALERT_RECIPIENTS,
  WHATSAPP_ALERT_TYPES,
  WHATSAPP_AUDIT_ENTITIES,
  WHATSAPP_FOREIGN_INBOUND_POLICIES,
  WHATSAPP_OPT_OUT_ORIGINS,
  WHATSAPP_PERMISSION_CODES,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppAlertSettings,
  WhatsAppAuditPage,
  WhatsAppOptOutPage,
  WhatsAppPermissionSettings,
  WhatsAppProtectionSettings,
  WhatsAppRecentAlert,
} from "@/features/whatsapp/models/settings-tab.model";
import {
  getDocumentedPermissionMatrix,
  resolveEffectivePermissions,
} from "@/features/whatsapp/utils/whatsapp-permissions.util";

export const SETTINGS_FIXTURE_NOW = new Date("2026-10-08T16:00:00.000Z");

export const settingsStoresFixture = [
  { id: "store-livii", name: "LIVII" },
  { id: "store-kunca", name: "KUNCA" },
];

export const protectionSettingsFixture: WhatsAppProtectionSettings = {
  optOutByKeyword: true,
  foreignInbound: WHATSAPP_FOREIGN_INBOUND_POLICIES.REPLY_ONCE,
  allowForeignOutbound: false,
  version: 4,
};

export const alertSettingsFixture: WhatsAppAlertSettings = {
  rules: [
    { type: WHATSAPP_ALERT_TYPES.QUALITY, enabled: true, threshold: null },
    { type: WHATSAPP_ALERT_TYPES.TEMPLATE, enabled: true, threshold: null },
    { type: WHATSAPP_ALERT_TYPES.FAILED_PCT, enabled: true, threshold: 10 },
    { type: WHATSAPP_ALERT_TYPES.DAILY_LIMIT_PCT, enabled: true, threshold: 80 },
    { type: WHATSAPP_ALERT_TYPES.UNATTENDED_MINUTES, enabled: false, threshold: 45 },
  ],
  recipients: WHATSAPP_ALERT_RECIPIENTS.BELL_ONLY,
  pauseCampaignsOnRed: true,
  version: 2,
};

export const recentAlertsFixture: WhatsAppRecentAlert[] = [
  {
    id: "al-1",
    type: WHATSAPP_ALERT_TYPES.UNATTENDED_MINUTES,
    message: "3 respuestas sin atender por 30 min en LIVII",
    createdAt: new Date("2026-10-08T14:40:00.000Z"),
    relatedTab: "conversaciones",
  },
  {
    id: "al-2",
    type: WHATSAPP_ALERT_TYPES.TEMPLATE,
    message: "Meta rechazó recompra_descuento: contenido promocional",
    createdAt: new Date("2026-10-07T23:12:00.000Z"),
    relatedTab: "plantillas",
  },
  {
    id: "al-3",
    type: WHATSAPP_ALERT_TYPES.DAILY_LIMIT_PCT,
    message: "Se usó el 80% del límite diario (800 de 1,000)",
    createdAt: new Date("2026-10-03T20:00:00.000Z"),
    relatedTab: null,
  },
];

export const optOutsPageFixture: WhatsAppOptOutPage = {
  items: [
    {
      id: "oo-1",
      customerName: "Pedro Ramírez",
      phone: "+51 955 444 333",
      storeId: "store-livii",
      storeName: "LIVII",
      origin: WHATSAPP_OPT_OUT_ORIGINS.KEYWORD,
      createdAt: new Date("2026-10-08T15:35:00.000Z"),
      createdBy: null,
    },
    {
      id: "oo-2",
      customerName: "Lucía Ramos",
      phone: "+51 987 111 222",
      storeId: "store-livii",
      storeName: "LIVII",
      origin: WHATSAPP_OPT_OUT_ORIGINS.AGENT,
      createdAt: new Date("2026-10-06T17:00:00.000Z"),
      createdBy: { id: "u-kf", name: "Katherine F." },
    },
    {
      id: "oo-3",
      customerName: null,
      phone: "+51 944 120 330",
      storeId: "store-kunca",
      storeName: "KUNCA",
      origin: WHATSAPP_OPT_OUT_ORIGINS.META_BLOCK,
      createdAt: new Date("2026-10-05T12:00:00.000Z"),
      createdBy: null,
    },
    {
      id: "oo-4",
      customerName: "María Fernanda de los Ángeles Quispe Huamán de la Cruz",
      phone: "+51 999 888 777",
      storeId: null,
      storeName: null,
      origin: null,
      createdAt: new Date("2026-10-01T09:00:00.000Z"),
      createdBy: null,
    },
  ],
  page: 1,
  pageSize: 50,
  total: 57,
  hasMore: true,
};

export const emptyOptOutsPageFixture: WhatsAppOptOutPage = {
  items: [],
  page: 1,
  pageSize: 50,
  total: 0,
  hasMore: false,
};

export const auditPageFixture: WhatsAppAuditPage = {
  items: [
    {
      id: "au-1",
      createdAt: new Date("2026-10-08T15:12:00.000Z"),
      user: { id: "u-jc", name: "Joel Coila" },
      entity: WHATSAPP_AUDIT_ENTITIES.RULE,
      entityId: "rule-comprobante",
      action: "activó Comprobante emitido",
      summary: "solo pedidos nuevos",
      before: { active: false },
      after: { active: true, includeExisting: false },
    },
    {
      id: "au-2",
      createdAt: new Date("2026-10-07T23:05:00.000Z"),
      user: { id: "u-jc", name: "Joel Coila" },
      entity: WHATSAPP_AUDIT_ENTITIES.SCHEDULE,
      entityId: null,
      action: "cambió el horario",
      summary: null,
      before: { from: "08:00", to: "20:00", days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] },
      after: { from: "08:00", to: "21:00", days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] },
    },
    {
      id: "au-3",
      createdAt: new Date("2026-10-06T14:00:00.000Z"),
      user: null,
      entity: WHATSAPP_AUDIT_ENTITIES.CONNECTION,
      entityId: "acc-1",
      action: "reconectó el número",
      summary: "+51 955 210 884",
      before: { accessToken: "EAAG-secreto-antiguo", phoneNumberId: "1093" },
      after: {
        accessToken: "EAAG-secreto-nuevo",
        phoneNumberId: "1093",
        webhook: { url: "https://api.powip.lat/wa/webhook", verifyToken: "otro-secreto" },
      },
    },
    {
      id: "au-4",
      createdAt: new Date("2026-10-04T16:20:00.000Z"),
      user: { id: "u-mr", name: "Milagros R." },
      entity: WHATSAPP_AUDIT_ENTITIES.OPT_OUT,
      entityId: "oo-9",
      action: "reactivó 962 557 018",
      summary: "lo pidió el cliente",
      before: { optedOut: true, note: null },
      after: {
        optedOut: false,
        note: "El comprador escribió al chat el 4 de octubre pidiendo volver a recibir los avisos de sus pedidos porque compra seguido y quiere saber cuándo llegan, incluidos los envíos a provincia.",
      },
    },
    {
      id: "au-5",
      createdAt: new Date("2026-10-03T10:00:00.000Z"),
      user: { id: "u-kf", name: "Katherine F." },
      entity: WHATSAPP_AUDIT_ENTITIES.TEMPLATE,
      entityId: "tpl-camino",
      action: "editó pedido_en_camino",
      summary: "reenviada a revisión",
      before: null,
      after: null,
    },
  ],
  page: 1,
  pageSize: 20,
  total: 41,
  hasMore: true,
  users: [
    { id: "u-jc", name: "Joel Coila" },
    { id: "u-kf", name: "Katherine F." },
    { id: "u-mr", name: "Milagros R." },
  ],
};

export const auditWithoutUsersFixture: WhatsAppAuditPage = { ...auditPageFixture, users: null };

export const emptyAuditPageFixture: WhatsAppAuditPage = {
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
  hasMore: false,
  users: [],
};

const documented = getDocumentedPermissionMatrix();

export const permissionSettingsFixture: WhatsAppPermissionSettings = {
  matrix: {
    ...documented,
    [WHATSAPP_PERMISSION_CODES.TEMPLATES]: {
      ...documented[WHATSAPP_PERMISSION_CODES.TEMPLATES],
      cc_supervisor: false,
    },
  },
  version: 1,
};

export const mixedEffectivePermissionsFixture = {
  ...resolveEffectivePermissions([
    WHATSAPP_PERMISSION_CODES.VIEW,
    WHATSAPP_PERMISSION_CODES.REPLY,
    WHATSAPP_PERMISSION_CODES.OPT_OUTS,
  ]),
  [WHATSAPP_PERMISSION_CODES.CONNECTION]: null,
};
