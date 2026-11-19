import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import { updateConversation } from "@/services/crmService";
import type { Conversation, UpdateConversationInput } from "@/types/crm";
import type {
  Audit,
  ConnectWabaInput,
  ConnectWabaResult,
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
