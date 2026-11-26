import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import { updateConversation } from "@/services/crmService";
import type { Conversation, UpdateConversationInput } from "@/types/crm";
import type {
  Audit,
  ConnectWabaInput,
  ConnectMetaAccountInput,
  ConnectWabaResult,
  CompleteEmbeddedSignupInput,
  CompleteMetaLoginResult,
  MetaChannel,
  MetaLoginConfig,
  EmbeddedSignupConfig,
  MetaAccount,
  TikTokAccount,
  TikTokOAuthResult,
  TikTokWebhookResult,
  CrmSettings,
  CrmSettingsInput,
  CreateExportInput,
  ExportLogItem,
  ExportSheet,
  TeamDay,
  TeamDays,
  TeamPerson,
  TeamStats,
} from "@/types/crmTeam";

const BASE = `${API.crm}/crm`;

/** Todo lo de este archivo es solo de administrador (403 `{ message }` si no). */

export async function getTeamStats(days: TeamDays): Promise<TeamStats> {
  return (await axiosAuth.get<TeamStats>(`${BASE}/team/stats`, { params: { days } })).data;
}

/** Ventas de hoy. La vendedora solo recibe lo suyo; el supervisor elige (`all` = todo el equipo). */
export async function getTeamDay(userId?: string): Promise<TeamDay> {
  return (
    await axiosAuth.get<TeamDay>(`${BASE}/team/day`, { params: userId ? { userId } : undefined })
  ).data;
}

export async function listTeamMembers(): Promise<TeamPerson[]> {
  return (await axiosAuth.get<{ items: TeamPerson[] }>(`${BASE}/team/members`)).data.items;
}

/** `PATCH /crm/conversations/:id` con persona y nombre. */
export async function reassignConversation(
  id: string,
  person: TeamPerson,
): Promise<Conversation> {
  // Variable (no literal) a propósito: `UpdateConversationInput` aún no declara `assignedUserName`.
  const input: UpdateConversationInput & { assignedUserName: string } = {
    assignedUserId: person.userId,
    assignedUserName: person.userName,
  };
  return updateConversation(id, input);
}

export async function getAudit(): Promise<Audit> {
  return (await axiosAuth.get<Audit>(`${BASE}/audit`)).data;
}

/** Crea una tarea en la Agenda de esa persona para leer el guion. */
export async function remindScript(person: TeamPerson): Promise<{ ok: true }> {
  return (
    await axiosAuth.post<{ ok: true }>(`${BASE}/content/script/remind`, {
      userId: person.userId,
      userName: person.userName,
    })
  ).data;
}

/** Meta de cobro del día (supervisora). */
export async function setDailyGoal(dailyGoal: number): Promise<{ dailyGoal: number }> {
  return (await axiosAuth.patch<{ dailyGoal: number }>(`${BASE}/team/goal`, { dailyGoal })).data;
}

/** Solo administrador. Cada descarga queda en el registro. */
export async function createExport(input: CreateExportInput): Promise<ExportSheet[]> {
  return (await axiosAuth.post<{ sheets: ExportSheet[] }>(`${BASE}/export`, input)).data.sheets;
}

export async function getExportLog(): Promise<ExportLogItem[]> {
  return (await axiosAuth.get<{ items: ExportLogItem[] }>(`${BASE}/export/log`)).data.items;
}

export async function getCrmSettings(): Promise<CrmSettings> {
  return (await axiosAuth.get<CrmSettings>(`${BASE}/settings`)).data;
}

/** Parcial. 400 con `message` si activas un mensaje vacío o `round_robin` sin personas. */
export async function updateCrmSettings(input: CrmSettingsInput): Promise<CrmSettings> {
  return (await axiosAuth.patch<CrmSettings>(`${BASE}/settings`, input)).data;
}

/** ms-integrations: 201, o 400 (validación), 401, 422 (Meta lo rechaza) y 502 (falló Meta). */
export async function connectCustomWaba(input: ConnectWabaInput): Promise<ConnectWabaResult> {
  return (
    await axiosAuth.post<ConnectWabaResult>(
      `${API.integrations}/whatsapp/onboarding/${encodeURIComponent(input.storeId)}/connect-custom-waba`,
      {
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
        businessPhoneNumber: input.businessPhoneNumber,
        accessToken: input.accessToken,
        ...(input.asCompanyDefault ? { asCompanyDefault: true } : {}),
        ...(input.confirmNoCoexistence ? { confirmNoCoexistence: true } : {}),
      },
    )
  ).data;
}

/** Datos públicos para abrir el Embedded Signup («Conectar con Facebook»). */
export async function getEmbeddedSignupConfig(): Promise<EmbeddedSignupConfig> {
  return (
    await axiosAuth.get<EmbeddedSignupConfig>(
      `${API.integrations}/whatsapp/onboarding/embedded-signup/config`,
    )
  ).data;
}

/**
 * Canjea el `code` del Embedded Signup. ms-integrations guarda el número en la misma
 * conexión que usan la Bandeja y las notificaciones. 503 sin claves, 502 si Meta falla.
 */
export async function completeEmbeddedSignup(
  input: CompleteEmbeddedSignupInput,
): Promise<ConnectWabaResult> {
  return (
    await axiosAuth.post<ConnectWabaResult>(
      `${API.integrations}/whatsapp/onboarding/${encodeURIComponent(input.storeId)}/embedded-signup`,
      {
        code: input.code,
        ...(input.wabaId ? { wabaId: input.wabaId } : {}),
        ...(input.phoneNumberId ? { phoneNumberId: input.phoneNumberId } : {}),
        ...(input.asCompanyDefault ? { asCompanyDefault: true } : {}),
        ...(input.coexistence ? { coexistence: true } : {}),
        ...(input.confirmNoCoexistence ? { confirmNoCoexistence: true } : {}),
      },
    )
  ).data;
}

/**
 * Mensaje legible de un error de ms-integrations. El 400 de validación trae
 * `errors: [{ field, message }]` además de `message: "Validation failed"`.
 */
export function integrationsErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[]; errors?: Array<{ field?: string; message?: string }> }
      | undefined;
    if (data?.errors?.length) {
      return data.errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join(", ");
    }
    const msg = Array.isArray(data?.message) ? data?.message.join(", ") : data?.message;
    if (msg) return msg;
    if (!err.response) return "No se pudo conectar con el servicio de integraciones";
    return err.message || "Error desconocido";
  }
  return err instanceof Error ? err.message : "Error desconocido";
}

const META_ACCOUNTS = () => `${API.integrations}/meta-messaging/accounts`;

/** ms-integrations: cuentas de Messenger e Instagram conectadas. */
export async function listMetaAccounts(): Promise<MetaAccount[]> {
  return (await axiosAuth.get<{ status: string; data: MetaAccount[] }>(META_ACCOUNTS())).data.data;
}

/** 201, o 400 (validación), 422 (Meta rechaza el token). */
export async function connectMetaAccount(input: ConnectMetaAccountInput): Promise<MetaAccount> {
  return (
    await axiosAuth.post<{ status: string; data: MetaAccount }>(META_ACCOUNTS(), {
      channel: input.channel,
      accountId: input.accountId,
      pageId: input.pageId,
      ...(input.name ? { name: input.name } : {}),
      accessToken: input.accessToken,
    })
  ).data.data;
}

/** Datos públicos para abrir «Conectar con Facebook» de Instagram y Messenger (sin secretos). */
export async function getMetaLoginConfig(): Promise<MetaLoginConfig> {
  return (await axiosAuth.get<MetaLoginConfig>(`${META_ACCOUNTS()}/login/config`)).data;
}

/**
 * Canjea el `code` de «Conectar con Facebook». ms-integrations guarda la página (Messenger) y su
 * Instagram vinculado y suscribe la página al webhook. 503 sin claves, 422 si Meta lo rechaza.
 */
export async function completeMetaLogin(input: {
  code: string;
  channels?: MetaChannel[];
}): Promise<CompleteMetaLoginResult> {
  return (
    await axiosAuth.post<{ status: string; data: CompleteMetaLoginResult }>(`${META_ACCOUNTS()}/login`, {
      code: input.code,
      ...(input.channels?.length ? { channels: input.channels } : {}),
    })
  ).data.data;
}

/** 204. */
export async function deleteMetaAccount(id: string): Promise<void> {
  await axiosAuth.delete(`${META_ACCOUNTS()}/${encodeURIComponent(id)}`);
}

const TIKTOK = () => `${API.integrations}/tiktok-messaging`;

/** ms-integrations: cuentas de TikTok conectadas. */
export async function listTikTokAccounts(): Promise<TikTokAccount[]> {
  return (await axiosAuth.get<{ status: string; data: TikTokAccount[] }>(`${TIKTOK()}/accounts`)).data.data;
}

/** 204. */
export async function deleteTikTokAccount(id: string): Promise<void> {
  await axiosAuth.delete(`${TIKTOK()}/accounts/${encodeURIComponent(id)}`);
}

/** URL de la pantalla de permiso de TikTok. 503 si el entorno no tiene las claves. */
export async function getTikTokAuthUrl(): Promise<string> {
  return (await axiosAuth.get<{ status: string; data: { url: string } }>(`${TIKTOK()}/oauth/auth-url`)).data
    .data.url;
}

/** Canjea el código que devolvió TikTok. 400 (enlace vencido), 403 (otro usuario), 422 (TikTok lo rechaza). */
export async function connectTikTokOAuth(code: string, state: string): Promise<TikTokOAuthResult> {
  const res = await axiosAuth.post<{ status: string; data: TikTokAccount; webhook: TikTokWebhookResult }>(
    `${TIKTOK()}/oauth/connect`,
    { code, state },
  );
  return { account: res.data.data, webhook: res.data.webhook };
}

/** Sale de Powip hacia una URL externa (pantalla de permiso de TikTok). */
export function goToExternalUrl(url: string): void {
  window.location.assign(url);
}
