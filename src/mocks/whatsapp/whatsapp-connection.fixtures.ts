import {
  WHATSAPP_ASSISTED_STATUSES,
  WHATSAPP_CONNECTION_STATES,
  WHATSAPP_CONNECTION_TYPES,
  WHATSAPP_MESSAGE_STATUSES,
  WHATSAPP_NAME_STATUSES,
  WHATSAPP_QUALITY_RATINGS,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppAccount,
  WhatsAppAssistedQueue,
  WhatsAppConnectionStatus,
  WhatsAppContingencySettings,
  WhatsAppPricing,
  WhatsAppTestRun,
  WhatsAppUsageSummary,
} from "@/features/whatsapp/models/connection.model";

export const CONNECTION_FIXTURE_NOW = new Date("2026-10-08T16:00:00.000Z");

const minutesAgo = (minutes: number) =>
  new Date(CONNECTION_FIXTURE_NOW.getTime() - minutes * 60 * 1000);

export const connectionStoresFixture = [
  { id: "store-livii", name: "LIVII" },
  { id: "store-kunca", name: "KUNCA" },
  { id: "store-nova", name: "NOVA Home" },
];

export const connectedStatusFixture: WhatsAppConnectionStatus = {
  storeId: "store-livii",
  connectionType: WHATSAPP_CONNECTION_TYPES.API,
  state: WHATSAPP_CONNECTION_STATES.CONNECTED,
  contingencyActive: false,
};

export const notConnectedStatusFixture: WhatsAppConnectionStatus = {
  storeId: "store-kunca",
  connectionType: null,
  state: WHATSAPP_CONNECTION_STATES.NOT_CONNECTED,
  contingencyActive: null,
};

export const unknownStatusFixture: WhatsAppConnectionStatus = {
  storeId: "store-livii",
  connectionType: null,
  state: null,
  contingencyActive: null,
};

export const liviiAccountFixture: WhatsAppAccount = {
  id: "acc-livii",
  storeId: "store-livii",
  role: "principal",
  connectionType: WHATSAPP_CONNECTION_TYPES.API,
  phone: "+51 987 654 321",
  verifiedName: "LIVII Store",
  nameStatus: WHATSAPP_NAME_STATUSES.APPROVED,
  qualityRating: WHATSAPP_QUALITY_RATINGS.GREEN,
  messagingLimitLabel: "1,000 clientes / 24 h",
  wabaId: "104822973310554",
  phoneNumberId: "310559812447021",
  webhook: { state: "active", lastEventAt: minutesAgo(2) },
  connectedAt: new Date("2026-09-14T15:00:00.000Z"),
  connectedBy: { id: "u-demo", name: "Demo Test" },
  usageToday: { uniqueContacts: 312, limit: 1000, resetsAt: new Date("2026-10-09T05:00:00.000Z") },
  messagesThisMonth: 1284,
  lastSyncedAt: minutesAgo(90),
  version: 3,
};

export const partialAccountFixture: WhatsAppAccount = {
  ...liviiAccountFixture,
  id: "acc-partial",
  qualityRating: null,
  messagingLimitLabel: null,
  nameStatus: WHATSAPP_NAME_STATUSES.IN_REVIEW,
  webhook: null,
  usageToday: { uniqueContacts: null, limit: null, resetsAt: null },
  messagesThisMonth: null,
  lastSyncedAt: null,
  connectedBy: null,
};

export const redQualityAccountFixture: WhatsAppAccount = {
  ...liviiAccountFixture,
  id: "acc-red",
  qualityRating: WHATSAPP_QUALITY_RATINGS.RED,
  usageToday: { uniqueContacts: 1000, limit: 1000, resetsAt: minutesAgo(10) },
};

export const accountsFixture: WhatsAppAccount[] = [
  liviiAccountFixture,
  {
    ...liviiAccountFixture,
    id: "acc-nova",
    storeId: "store-nova",
    phone: "+51 955 210 884",
    verifiedName: "NOVA Home Oficial",
    nameStatus: WHATSAPP_NAME_STATUSES.IN_REVIEW,
    messagesThisMonth: 0,
  },
];

export const testRunFixtures: Record<string, WhatsAppTestRun> = {
  queued: {
    messageId: "test-1",
    phone: "+51 912 345 678",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.QUEUED,
    startedAt: minutesAgo(0),
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    errorMessage: null,
  },
  deliveredRecently: {
    messageId: "test-2",
    phone: "+51 912 345 678",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.DELIVERED,
    startedAt: minutesAgo(1),
    sentAt: minutesAgo(1),
    deliveredAt: minutesAgo(0.5),
    readAt: null,
    failedAt: null,
    errorMessage: null,
  },
  deliveredWithoutRead: {
    messageId: "test-3",
    phone: "+51 912 345 678",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.DELIVERED,
    startedAt: minutesAgo(5),
    sentAt: minutesAgo(5),
    deliveredAt: minutesAgo(4),
    readAt: null,
    failedAt: null,
    errorMessage: null,
  },
  read: {
    messageId: "test-4",
    phone: "+51 912 345 678",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.READ,
    startedAt: minutesAgo(3),
    sentAt: minutesAgo(3),
    deliveredAt: minutesAgo(2.5),
    readAt: minutesAgo(1),
    failedAt: null,
    errorMessage: null,
  },
  failed: {
    messageId: "test-5",
    phone: "+51 912 345 678",
    templateName: "pedido_en_camino",
    status: WHATSAPP_MESSAGE_STATUSES.FAILED,
    startedAt: minutesAgo(1),
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: minutesAgo(0.5),
    errorMessage: "El número no tiene WhatsApp.",
  },
};

export const contingencyFixture: WhatsAppContingencySettings = {
  enabled: true,
  backupAccount: { id: "acc-backup", phone: "+51 944 120 330", verifiedName: "LIVII Respaldo" },
  triggers: {
    onRestrictedOrRed: true,
    onDailyLimit: false,
    onConsecutiveFailures: { enabled: true, count: 5, minutes: 15 },
    manualOnly: false,
  },
  sender: { type: "user", userId: "u-kf" },
  active: true,
  activatedAt: minutesAgo(45),
  reason: "Se alcanzó el límite diario de Meta",
  version: 2,
};

export const assistedQueueFixture: WhatsAppAssistedQueue = {
  items: [
    {
      id: "as-1",
      orderId: "order-1",
      orderNumber: "ORD-149912",
      customerName: "Carlos Hoyos",
      phone: "+51 987 111 222",
      templateName: "pedido_en_camino",
      courierName: "Shalom",
      waMeUrl: "https://wa.me/51987111222?text=Hola%20Carlos",
      status: WHATSAPP_ASSISTED_STATUSES.PENDING,
      createdAt: minutesAgo(30),
      openedBy: null,
    },
    {
      id: "as-2",
      orderId: "order-2",
      orderNumber: "ORD-149913",
      customerName: "Paola Buendía",
      phone: "+51 955 300 410",
      templateName: "en_reparto_hoy",
      courierName: "Olva",
      waMeUrl: "https://wa.me/51955300410?text=Hola%20Paola",
      status: WHATSAPP_ASSISTED_STATUSES.OPENED,
      createdAt: minutesAgo(25),
      openedBy: { id: "u-kf", name: "Katherine F." },
    },
    {
      id: "as-3",
      orderId: null,
      orderNumber: null,
      customerName: null,
      phone: "01 444 5566",
      templateName: "guia_creada",
      courierName: null,
      waMeUrl: null,
      status: WHATSAPP_ASSISTED_STATUSES.PENDING,
      createdAt: minutesAgo(20),
      openedBy: null,
    },
  ],
  pendingTotal: 7,
  hasMore: true,
};

export const pricingFixture: WhatsAppPricing = {
  market: "Ejemplo de mercado",
  currency: "USD",
  effectiveFrom: "2026-10-01",
  source: "Fuente de ejemplo para Storybook",
  sourceUrl: null,
  verifiedAt: minutesAgo(60 * 24 * 3),
  exchangeRate: { value: "0.00", date: "2026-10-07", source: "Fuente de ejemplo" },
  items: [
    {
      type: "utility",
      label: "Utilidad (ejemplo)",
      chargedWhen: "Monto ilustrativo, no es una tarifa real",
      usd: "0.0000",
      pen: "0.00",
    },
    {
      type: "marketing",
      label: "Marketing (ejemplo)",
      chargedWhen: "Monto ilustrativo, no es una tarifa real",
      usd: "0.0000",
      pen: null,
    },
  ],
};

export const stalePricingFixture: WhatsAppPricing = { ...pricingFixture, verifiedAt: null };

export const usageFixture: WhatsAppUsageSummary = {
  month: "2026-10",
  templatesDelivered: 1284,
  serviceRepliesUsed: 210,
  serviceRepliesFree: 1000,
  estimatedCost: { usd: "0.00", pen: "0.00", exchangeRate: "0.00", rateDate: "2026-10-07" },
};

export const unknownUsageFixture: WhatsAppUsageSummary = {
  month: "2026-10",
  templatesDelivered: null,
  serviceRepliesUsed: null,
  serviceRepliesFree: null,
  estimatedCost: null,
};
