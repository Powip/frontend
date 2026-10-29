import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export const STORE_CHANNEL_TYPES = [
  "WHATSAPP",
  "INSTAGRAM",
  "FACEBOOK",
  "WEB",
  "SHOPIFY",
  "TIKTOK",
  "MARKETPLACE",
  "PHYSICAL",
  "OTHER",
] as const;
export type StoreChannelType = (typeof STORE_CHANNEL_TYPES)[number];
export interface StoreSalesChannel {
  id: string;
  storeId: string;
  type: StoreChannelType;
  label: string;
  identifier: string | null;
  externalId: string | null;
  normalizedIdentifier: string | null;
  isActive: boolean;
}
export interface CreateStoreSalesChannel {
  type: StoreChannelType;
  label: string;
  identifier?: string | null;
  externalId?: string | null;
}
export interface StoreChannelPresentation {
  id: string;
  color: string | null;
  is_legacy: boolean;
}

function channel(data: unknown, storeId?: string): StoreSalesChannel {
  if (!data || typeof data !== "object")
    throw new Error("No se pudo cargar el canal de la tienda.");
  const row = data as StoreSalesChannel;
  if (
    typeof row.id !== "string" ||
    typeof row.storeId !== "string" ||
    (storeId && row.storeId !== storeId) ||
    !STORE_CHANNEL_TYPES.includes(row.type) ||
    typeof row.label !== "string" ||
    typeof row.isActive !== "boolean" ||
    ![row.identifier, row.externalId, row.normalizedIdentifier].every(
      (value) => value === null || typeof value === "string",
    )
  ) {
    throw new Error("No se pudo cargar el canal de la tienda.");
  }
  return row;
}
const route = (storeId: string) => `${GATEWAY.company}/stores/${encodeURIComponent(storeId)}`;

export async function fetchStoreSalesChannels(
  storeId: string,
  signal?: AbortSignal,
): Promise<StoreSalesChannel[]> {
  const { data } = await axiosAuth.get<unknown>(`${route(storeId)}/channels`, {
    signal,
  });
  if (!Array.isArray(data) || data.length > 2000)
    throw new Error("No se pudieron cargar los canales de la tienda.");
  const rows = data.map((row) => channel(row, storeId));
  if (new Set(rows.map((row) => row.id)).size !== rows.length)
    throw new Error("No se pudieron cargar los canales de la tienda.");
  return rows;
}

export async function createStoreSalesChannel(
  storeId: string,
  input: CreateStoreSalesChannel,
): Promise<StoreSalesChannel> {
  const payload = {
    type: input.type,
    label: input.label.trim(),
    identifier: input.identifier?.trim() || null,
    externalId: input.externalId?.trim() || null,
  };
  const { data } = await axiosAuth.post<unknown>(`${route(storeId)}/channels`, payload);
  return channel(data, storeId);
}

export async function updateStoreSalesChannel(
  storeId: string,
  channelId: string,
  input: { label?: string; isActive?: boolean },
): Promise<StoreSalesChannel> {
  const payload = {
    ...(input.label !== undefined ? { label: input.label.trim() } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  };
  const { data } = await axiosAuth.patch<unknown>(
    `${route(storeId)}/channels/${encodeURIComponent(channelId)}`,
    payload,
  );
  const row = channel(data, storeId);
  if (row.id !== channelId) throw new Error("No se pudo guardar el canal de la tienda.");
  return row;
}

export async function deactivateStoreSalesChannel(
  storeId: string,
  channelId: string,
): Promise<StoreSalesChannel> {
  const { data } = await axiosAuth.delete<unknown>(
    `${route(storeId)}/channels/${encodeURIComponent(channelId)}`,
  );
  const row = channel(data, storeId);
  if (row.id !== channelId || row.isActive) throw new Error("No se pudo desactivar el canal.");
  return row;
}

export async function updateStorePresentation(
  storeId: string,
  color: string | null,
): Promise<StoreChannelPresentation> {
  const { data } = await axiosAuth.patch<StoreChannelPresentation>(
    `${route(storeId)}/presentation`,
    { color },
  );
  if (
    data?.id !== storeId ||
    typeof data.is_legacy !== "boolean" ||
    (data.color !== null && (typeof data.color !== "string" || !/^#[0-9a-f]{6}$/i.test(data.color)))
  ) {
    throw new Error("No se pudo guardar el color de la tienda.");
  }
  return data;
}

export function storeChannelError(error: unknown): string {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401) return "Tu sesión venció. Vuelve a iniciar sesión.";
  if (status === 403) return "Necesitas permiso para configurar esta tienda.";
  if (status === 404) return "La tienda o el canal ya no está disponible.";
  if (status === 409) return "Este canal ya existe. Revisa los canales inactivos.";
  if (status === 400) return "Revisa el nombre y el identificador del canal.";
  return "No se pudo guardar el cambio. Inténtalo de nuevo.";
}
