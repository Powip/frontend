import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type { CrmSettingsE, CrmSettingsEInput, PresenceResponse, SalesBoardExtra } from "@/types/crmAjustesE";

const BASE = `${API.crm}/crm`;

/** Ajustes con los campos del bloque E (mismo endpoint que `getCrmSettings`). */
export async function getCrmSettingsE(): Promise<CrmSettingsE> {
  return (await axiosAuth.get<CrmSettingsE>(`${BASE}/settings`)).data;
}

/** Parcial. 400 con `message` si algo no cumple (máx. 2 en COD, 3 botones, 20 caracteres, días 1-30). */
export async function updateCrmSettingsE(input: CrmSettingsEInput): Promise<CrmSettingsE> {
  return (await axiosAuth.patch<CrmSettingsE>(`${BASE}/settings`, input)).data;
}

/** Ventas: ciudad, envío y pagos de cada pedido, leídos del Core. Máximo 60 pedidos por llamada. */
export async function getSalesBoardExtras(orderIds: string[]): Promise<SalesBoardExtra[]> {
  if (!orderIds.length) return [];
  const { data } = await axiosAuth.get<{ items: SalesBoardExtra[] }>(`${BASE}/sales/board/extras`, {
    params: { orderIds: orderIds.join(",") },
  });
  return data.items ?? [];
}

/** Aviso de que este usuario tiene el chat abierto (cada ~20 s). */
export async function beatPresence(conversationId: string): Promise<void> {
  await axiosAuth.post(`${BASE}/presence/${encodeURIComponent(conversationId)}`);
}

export async function getPresence(conversationIds: string[]): Promise<PresenceResponse> {
  if (!conversationIds.length) return { enabled: true, viewers: {} };
  return (
    await axiosAuth.get<PresenceResponse>(`${BASE}/presence`, { params: { conversationIds: conversationIds.join(",") } })
  ).data;
}
