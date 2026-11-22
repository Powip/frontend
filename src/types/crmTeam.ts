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

export interface TeamStats {
  days: number;
  slaMinutes: number;
  kpis: TeamKpis;
  members: TeamMember[];
  waiting: TeamWaiting[];
  lostReasons: { reason: string; count: number }[];
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
}

export type CrmSettingsInput = Partial<CrmSettings>;

// --- Conexión de WhatsApp (ms-integrations) ---

export interface ConnectWabaInput {
  wabaId: string;
  phoneNumberId: string;
  businessPhoneNumber: string;
  accessToken: string;
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
