import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import type {
  WhatsAppAlertRecipients,
  WhatsAppAlertType,
  WhatsAppAuditEntity,
  WhatsAppPermissionCode,
} from "../enums/whatsapp.enums";
import type {
  WhatsAppAlertSettings,
  WhatsAppAuditEntry,
  WhatsAppAuditFilters,
  WhatsAppAuditPage,
  WhatsAppAuditValue,
  WhatsAppEffectivePermissions,
  WhatsAppPermissionMatrix,
  WhatsAppPermissionSettings,
  WhatsAppRecentAlert,
} from "../models/settings-tab.model";

const BASE = `${API.integrations}/wa`;

// ───────── C-26 alertas ─────────

export interface WhatsAppAlertRulesBody {
  rules: { type: WhatsAppAlertType; enabled: boolean; threshold: number | null }[];
  recipients: WhatsAppAlertRecipients;
  pauseCampaignsOnRed: boolean;
}

// C-26 · GET /wa/alerts/rules?storeId=
export async function getWhatsAppAlertSettings(storeId: string): Promise<WhatsAppAlertSettings> {
  assertWhatsAppContractAvailable("alerts");
  const { data } = await axiosAuth.get<WhatsAppAlertSettings>(`${BASE}/alerts/rules`, {
    params: { storeId },
  });
  return data;
}

// C-26 · PUT /wa/alerts/rules?storeId= con If-Match
export async function updateWhatsAppAlertSettings(
  storeId: string,
  version: number,
  body: WhatsAppAlertRulesBody,
): Promise<WhatsAppAlertSettings> {
  assertWhatsAppContractAvailable("alerts");
  const { data } = await axiosAuth.put<WhatsAppAlertSettings>(`${BASE}/alerts/rules`, body, {
    params: { storeId },
    headers: { "If-Match": String(version) },
  });
  return data;
}

interface RecentAlertDto {
  id: string;
  type: WhatsAppAlertType;
  message: string;
  createdAt: string;
  relatedTab: string | null;
}

// C-26 · GET /wa/alerts?storeId=
export async function listWhatsAppRecentAlerts(storeId: string): Promise<WhatsAppRecentAlert[]> {
  assertWhatsAppContractAvailable("alerts");
  const { data } = await axiosAuth.get<{ items: RecentAlertDto[] }>(`${BASE}/alerts`, {
    params: { storeId },
  });
  return (data.items ?? []).map((item) => ({ ...item, createdAt: new Date(item.createdAt) }));
}

// ───────── C-27 auditoría ─────────

interface AuditEntryDto {
  id: string;
  createdAt: string;
  user: { id: string; name: string; email?: string | null } | null;
  entity: WhatsAppAuditEntity;
  entityId: string | null;
  action: string;
  summary: string | null;
  before: Record<string, WhatsAppAuditValue> | null;
  after: Record<string, WhatsAppAuditValue> | null;
}

interface AuditPageDto {
  items: AuditEntryDto[];
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
  users?: { id: string; name: string }[] | null;
}

// C-27 · GET /wa/audit?entity=&userId=&page=&pageSize=
export async function listWhatsAppAudit(params: {
  storeId?: string | null;
  filters: WhatsAppAuditFilters;
  page?: number;
  pageSize?: number;
}): Promise<WhatsAppAuditPage> {
  assertWhatsAppContractAvailable("auditLog");
  const { data } = await axiosAuth.get<AuditPageDto>(`${BASE}/audit`, {
    params: {
      storeId: params.storeId ?? undefined,
      entity: params.filters.entity ?? undefined,
      userId: params.filters.userId ?? undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    },
  });
  return {
    items: data.items.map(
      (item): WhatsAppAuditEntry => ({ ...item, createdAt: new Date(item.createdAt) }),
    ),
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    hasMore: data.hasMore,
    users: data.users ?? null,
  };
}

// ───────── C-28 permisos ─────────

// C-28 · GET /wa/permissions
export async function getWhatsAppPermissionSettings(): Promise<WhatsAppPermissionSettings> {
  assertWhatsAppContractAvailable("permissions");
  const { data } = await axiosAuth.get<WhatsAppPermissionSettings>(`${BASE}/permissions`);
  return { matrix: data.matrix, version: data.version };
}

// C-28 · PUT /wa/permissions con If-Match
export async function updateWhatsAppPermissionSettings(
  version: number,
  matrix: WhatsAppPermissionMatrix,
): Promise<WhatsAppPermissionSettings> {
  assertWhatsAppContractAvailable("permissions");
  const { data } = await axiosAuth.put<WhatsAppPermissionSettings>(
    `${BASE}/permissions`,
    { matrix },
    { headers: { "If-Match": String(version) } },
  );
  return { matrix: data.matrix, version: data.version };
}

export interface WhatsAppMyPermissions {
  role: string | null;
  permissions: WhatsAppEffectivePermissions;
}

// C-28 · GET /wa/permissions/me
export async function getMyWhatsAppPermissions(): Promise<WhatsAppMyPermissions> {
  assertWhatsAppContractAvailable("permissions");
  const { data } = await axiosAuth.get<{
    role: string | null;
    permissions: Partial<Record<WhatsAppPermissionCode, boolean>>;
  }>(`${BASE}/permissions/me`);
  return { role: data.role, permissions: data.permissions as WhatsAppEffectivePermissions };
}

/** Lista de códigos concedidos, para `resolveEffectivePermissions`. */
export function grantedCodes(me: WhatsAppMyPermissions | undefined): WhatsAppPermissionCode[] | null {
  if (!me) return null;
  return (Object.entries(me.permissions) as [WhatsAppPermissionCode, boolean | null][])
    .filter(([, granted]) => granted === true)
    .map(([code]) => code);
}

// ───────── C-31 avisos dentro de POWIP ─────────

export interface WhatsAppInAppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  storeId: string | null;
  read: boolean;
  createdAt: Date;
}

interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  storeId: string | null;
  read: boolean;
  createdAt: string;
}

// C-31 · GET /wa/notifications
export async function listWhatsAppNotifications(): Promise<{
  items: WhatsAppInAppNotification[];
  unreadCount: number;
}> {
  assertWhatsAppContractAvailable("inAppNotifications");
  const { data } = await axiosAuth.get<{ items: NotificationDto[]; unreadCount: number }>(
    `${BASE}/notifications`,
  );
  return {
    items: (data.items ?? []).map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      body: item.body ?? null,
      link: item.link ?? null,
      storeId: item.storeId ?? null,
      read: Boolean(item.read),
      createdAt: new Date(item.createdAt),
    })),
    unreadCount: data.unreadCount ?? 0,
  };
}

// C-31 · POST /wa/notifications/:id/read
export async function markWhatsAppNotificationRead(id: string): Promise<void> {
  assertWhatsAppContractAvailable("inAppNotifications");
  await axiosAuth.post(`${BASE}/notifications/${encodeURIComponent(id)}/read`);
}

// C-31 · POST /wa/notifications/read-all
export async function markAllWhatsAppNotificationsRead(): Promise<void> {
  assertWhatsAppContractAvailable("inAppNotifications");
  await axiosAuth.post(`${BASE}/notifications/read-all`);
}
