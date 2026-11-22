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
  MetaAccount,
  TikTokAccount,
  TikTokOAuthResult,
  TikTokWebhookResult,
  CrmSettings,
  CrmSettingsInput,
  TeamDays,
  TeamPerson,
  TeamStats,
} from "@/types/crmTeam";

const BASE = `${API.crm}/crm`;

/** Todo lo de este archivo es solo de administrador (403 `{ message }` si no). */

export async function getTeamStats(days: TeamDays): Promise<TeamStats> {
  return (await axiosAuth.get<TeamStats>(`${BASE}/team/stats`, { params: { days } })).data;
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
      `${API.integrations}/whatsapp/onboarding/connect-custom-waba`,
      {
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
        businessPhoneNumber: input.businessPhoneNumber,
        accessToken: input.accessToken,
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
