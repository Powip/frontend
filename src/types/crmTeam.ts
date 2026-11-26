import type { Conversation } from "@/types/crm";

// --- Equipo ---

export type TeamDays = 7 | 30;

export interface TeamKpis {
  openConversations: number;
  unanswered: number;
  waitingOverSla: number;
  avgFirstResponseMinutes: number | null;
  wonConversations: number;
  lostConversations: number;
  ordersLinked: number;
  messagesSent: number;
}

export interface TeamMember {
  /** Para Pau es `"pau"`. */
  userId: string;
  userName: string;
  kind: "agent" | "pau";
  openAssigned: number;
  unanswered: number;
  messagesSent: number;
  avgFirstResponseMinutes: number | null;
  won: number;
  lost: number;
  ordersLinked: number;
  pendingTasks: number;
  overdueTasks: number;
}

export interface TeamWaiting {
  conversation: Conversation;
  waitingMinutes: number;
}

/** Meta del día: cobrado hoy (hora de Lima) con pagos aprobados en el chat. */
export interface TeamToday {
  /** 0 = sin meta. */
  goal: number;
  total: number;
  /** Cobrado en chats sin vendedora asignada. */
  unassigned: number;
  members: { userId: string; userName: string; collected: number }[];
}

export interface TeamChannelResult {
  channel: string;
  chats: number;
  won: number;
  /** Porcentaje; null si no hubo chats. */
  conversion: number | null;
  collected: number;
}

export interface TeamStats {
  days: number;
  slaMinutes: number;
  kpis: TeamKpis;
  members: TeamMember[];
  waiting: TeamWaiting[];
  lostReasons: { reason: string; count: number }[];
  today: TeamToday;
  byChannel: TeamChannelResult[];
}

export interface TeamPerson {
  userId: string;
  userName: string;
}

// --- Auditoría ---

export type AuditSeverity = "bad" | "warn" | "info";

export interface AuditSheet {
  id: string;
  name: string;
  status: "ok" | "warn" | "bad";
  missing: string[];
}

export interface AuditProblem {
  severity: AuditSeverity;
  code: string;
  title: string;
  detail: string;
  /** Ruta interna de la app. */
  href: string | null;
}

export interface AuditScriptItem {
  userId: string;
  userName: string;
  readVersion: number | null;
  readAt: string | null;
  upToDate: boolean;
}

export interface Audit {
  /** 0-100 */
  score: number;
  sheets: AuditSheet[];
  problems: AuditProblem[];
  script: { version: number; items: AuditScriptItem[] };
}

// --- Ajustes ---

export interface BusinessHours {
  /** 0 = domingo … 6 = sábado */
  days: number[];
  start: string;
  end: string;
}

export type AssignMode = "manual" | "round_robin";

export interface CrmSettings {
  /** 1-720 */
  slaMinutes: number;
  hours: BusinessHours;
  awayEnabled: boolean;
  awayMessage: string;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  assignMode: AssignMode;
  assignUsers: TeamPerson[];
  /** Meta de cobro del día en soles; 0 = sin meta. */
  dailyGoal: number;
  /** Tope de mensajes automáticos por cliente en 7 días (1-20). */
  followupWeeklyMax: number;
  /** Horario de envío de seguimientos, «HH:mm» en hora de Lima. */
  followupSendStart: string;
  followupSendEnd: string;
  /** Las vendedoras ven el teléfono del cliente como «951 *** 245». */
  maskPhone: boolean;
  /** Grabar llamadas de WhatsApp. */
  callRecording?: boolean;
  /** Comentarios públicos: responder en público y seguir por privado. */
  commentAutoReply?: boolean;
  commentReplyText?: string;
  /** Un comentario nuevo solo abre chat si contiene una de estas palabras. Vacío = todos. */
  commentKeywords?: string[];
  /** Ocultar al público comentarios con teléfonos o insultos (no se borran). */
  commentHideFlagged?: boolean;
  /** Horario para llamar, «HH:mm» en hora de Lima. Fuera de él se desactiva Llamar. */
  callHoursStart?: string;
  callHoursEnd?: string;
  /** La IA escucha y sugiere en vivo durante la llamada. */
  callLiveAi?: boolean;
  /** Si la vendedora no trabaja el día de su seguimiento: esperar o pasar a quien esté conectada. */
  absentTaskMode?: AbsentTaskMode;
}

export type AbsentTaskMode = "wait" | "reassign";

export type CrmSettingsInput = Partial<CrmSettings>;

// --- Descarga de base ---

export type ExportDataset = "clients" | "orders";

export interface CreateExportInput {
  datasets: ExportDataset[];
  storeId?: string;
  /** Sin valor = todo. */
  days?: 30 | 90;
}

export interface ExportSheet {
  dataset: ExportDataset;
  rows: Record<string, string | number | boolean | null>[];
  truncated: boolean;
}

export interface ExportLogItem {
  id: string;
  userId: string;
  userEmail: string | null;
  dataset: ExportDataset;
  filters: { storeId?: string | null; days?: number | null };
  rowCount: number;
  createdAt: string;
}

// --- Conexión de WhatsApp (ms-integrations) ---

export interface ConnectWabaInput {
  /** Tienda dueña del número (ms-integrations lo pide en la ruta). */
  storeId: string;
  wabaId: string;
  phoneNumberId: string;
  /** Opcional: ms-integrations lee el número de Meta; el escrito solo se compara. */
  businessPhoneNumber?: string;
  accessToken: string;
  /** Guarda el número como el de toda la empresa (respaldo de las tiendas sin número propio). */
  asCompanyDefault?: boolean;
  /** La persona aceptó que un número sin coexistencia deja la app del celular. */
  confirmNoCoexistence?: boolean;
  /** La persona aceptó guardar el número de Meta cuando el escrito no coincide (409). */
  confirmPhoneFromMeta?: boolean;
}

/** Lo que el navegador necesita para abrir el Embedded Signup de Meta (sin secretos). */
export interface EmbeddedSignupConfig {
  enabled: boolean;
  appId: string | null;
  configId: string | null;
  apiVersion: string;
  /** true cuando ms-integrations apunta a un simulador local en vez de Meta. */
  simulated: boolean;
  /** Variables del servidor que faltan para habilitar el botón (solo nombres). */
  missing?: string[];
}

/** «Conectar con Facebook» de Instagram y Messenger: misma forma que la de WhatsApp. */
export type MetaLoginConfig = EmbeddedSignupConfig;

export interface MetaLoginPageResult {
  pageId: string;
  pageName: string | null;
  subscribed: boolean;
  error?: string;
}

export interface CompleteMetaLoginResult {
  accounts: MetaAccount[];
  pages: MetaLoginPageResult[];
}

export interface CompleteEmbeddedSignupInput {
  storeId: string;
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
  asCompanyDefault?: boolean;
  /** Número que sigue en la app WhatsApp Business del celular (coexistencia). */
  coexistence?: boolean;
  /** La persona aceptó que un número sin coexistencia deja la app del celular. */
  confirmNoCoexistence?: boolean;
}

export interface ConnectWabaResult {
  status: "success";
  message: string;
  data: {
    id: string;
    companyId: string;
    mode: string;
    wabaId: string;
    phoneNumberId: string;
    businessPhoneNumber: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

// --- Cuentas de Messenger e Instagram (ms-integrations) ---

export type MetaChannel = "messenger" | "instagram";

export interface MetaAccount {
  id: string;
  channel: MetaChannel;
  accountId: string;
  pageId: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ConnectMetaAccountInput {
  channel: MetaChannel;
  accountId: string;
  pageId: string;
  name?: string;
  accessToken: string;
}

// --- Cuentas de TikTok (ms-integrations) ---

export interface TikTokAccount {
  id: string;
  channel: "tiktok";
  accountId: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  /** true si Powip renueva el token solo (cuenta conectada con el botón de TikTok). */
  autoRenew: boolean;
}

/** Resultado de registrar el webhook al conectar. */
export type TikTokWebhookResult = "registered" | "skipped" | "failed";

export interface TikTokOAuthResult {
  account: TikTokAccount;
  webhook: TikTokWebhookResult;
}

// --- Mi día (ventas de hoy por vendedora; Pau cuenta como vendedora) ---

export type TeamDayState = "paid" | "deposit" | "on_delivery" | "to_validate";

export interface TeamDayOrder {
  orderId: string;
  orderNumber: string | null;
  storeId: string | null;
  conversationId: string | null;
  customerName: string | null;
  sellerId: string;
  sellerName: string;
  units: number;
  total: number;
  paid: number;
  pending: number;
  state: TeamDayState;
  createdAt: string;
}

export interface TeamDay {
  /** userId de la vendedora, `pau` o `all`. */
  who: string;
  goal: number;
  count: number;
  units: number;
  billed: number;
  collectedFull: number;
  deposits: number;
  depositOrders: number;
  pending: number;
  pendingToValidate: number;
  pendingOnDelivery: number;
  /** Solo para supervisor: cada persona trae sus ventas y su meta de hoy. */
  sellers: Array<TeamPerson & { count?: number; billed?: number; goal?: number }>;
  orders: TeamDayOrder[];
}
