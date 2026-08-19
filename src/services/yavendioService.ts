import axios from "axios";

export const API_INTEGRATIONS = (
  process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3004"
).replace(/\/$/, "");

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

// ─── TIPOS ──────────────────────────────────────────────

export interface YavendioSafeConfig {
  id: string;
  companyId: string;
  /** Enmascarada por el backend (`****XXXX`) — nunca viaja en texto plano. */
  apiKey: string | null;
  importStoreId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveYavendioConfigPayload {
  companyId: string;
  apiKey?: string;
  importStoreId?: string;
}

export interface CatalogSyncErrorItem {
  productId: string;
  sku?: string;
  message: string;
}

export interface CatalogSyncSummary {
  companyId: string;
  totalProducts: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: CatalogSyncErrorItem[];
}

export type SyncProductOutcome = "created" | "updated" | "skipped";

export interface SyncProductResult {
  productId: string;
  companyId: string;
  outcome: SyncProductOutcome;
}

export interface YavendioWebhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  description: string | null;
  createdAt: string;
}

export interface CreateYavendioWebhookPayload {
  url: string;
  events: string[];
  description?: string;
}

interface YavendioWebhookListResponse {
  data: YavendioWebhook[];
}

/**
 * La respuesta real de `POST /yavendio/webhooks/:companyId` incluye además un
 * campo `secret` (`whsec_...`) que YaVendió muestra una única vez y que el
 * backend ya persistió internamente (`YavendioConfig.webhookSecret`). No se
 * agrega a `YavendioWebhook` a propósito: nunca debe llegar a estado de React
 * ni a un log del cliente — `createYavendioWebhook` lo descarta antes de
 * devolver.
 */
interface YavendioWebhookCreateResponse extends YavendioWebhook {
  secret: string;
}

// ─── SERVICIOS ──────────────────────────────────────────

export const getYavendioConfig = async (
  token: string,
  companyId: string,
): Promise<YavendioSafeConfig | null> => {
  try {
    const res = await axios.get<YavendioSafeConfig>(
      `${API_INTEGRATIONS}/yavendio/config/${companyId}`,
      { headers: headers(token) },
    );
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
};

export const saveYavendioConfig = async (
  token: string,
  payload: SaveYavendioConfigPayload,
): Promise<YavendioSafeConfig> => {
  const res = await axios.post<YavendioSafeConfig>(
    `${API_INTEGRATIONS}/yavendio/config`,
    payload,
    { headers: headers(token) },
  );
  return res.data;
};

/**
 * A diferencia de Aliclik, el connection-test de Yavendio no devuelve `{ ok, message }`:
 * devuelve la config actualizada (activada si la Api-Key es válida) o rechaza
 * con 401 si es inválida — el llamador debe envolver esto en try/catch.
 */
export const testYavendioConnection = async (
  token: string,
  companyId: string,
): Promise<YavendioSafeConfig> => {
  const res = await axios.post<YavendioSafeConfig>(
    `${API_INTEGRATIONS}/yavendio/config/${companyId}/connection-test`,
    {},
    { headers: headers(token) },
  );
  return res.data;
};

/**
 * Sincroniza el catálogo completo de la empresa hacia Yavendio (`POST /yavendio/sync/:companyId`).
 * Es una llamada síncrona del lado del backend (procesa los productos en serie) — puede
 * tardar según el tamaño del catálogo, no tiene barra de progreso en tiempo real.
 */
export const syncYavendioCatalog = async (
  token: string,
  companyId: string,
): Promise<CatalogSyncSummary> => {
  const res = await axios.post<CatalogSyncSummary>(
    `${API_INTEGRATIONS}/yavendio/sync/${companyId}`,
    {},
    { headers: headers(token) },
  );
  return res.data;
};

/**
 * Sincroniza un único producto hacia Yavendio (`POST /yavendio/sync/:companyId/product/:productId`).
 * A diferencia de `syncYavendioCatalog`, este es el ÚNICO camino que propaga
 * productos descontinuados (`status=false`) — el sync masivo los filtra
 * server-side y nunca los toca. Puede rechazar (p. ej. `BadRequestException`
 * del backend); el llamador es responsable de capturar el error, esta
 * función no lo atrapa.
 */
export const syncYavendioProduct = async (
  token: string,
  companyId: string,
  productId: string,
): Promise<SyncProductResult> => {
  const res = await axios.post<SyncProductResult>(
    `${API_INTEGRATIONS}/yavendio/sync/${companyId}/product/${productId}`,
    {},
    { headers: headers(token) },
  );
  return res.data;
};

/**
 * Lista los webhooks registrados en YaVendió para la empresa
 * (`GET /yavendio/webhooks/:companyId`). Puede incluir webhooks creados a
 * mano desde el dashboard de YaVendió — el llamador es responsable de
 * identificar cuál es el propio de Powip (por `url`), esta función no filtra.
 */
export const listYavendioWebhooks = async (
  token: string,
  companyId: string,
): Promise<YavendioWebhook[]> => {
  const res = await axios.get<YavendioWebhookListResponse>(
    `${API_INTEGRATIONS}/yavendio/webhooks/${companyId}`,
    { headers: headers(token) },
  );
  return res.data.data;
};

/**
 * Registra un webhook nuevo en YaVendió (`POST /yavendio/webhooks/:companyId`).
 * El `secret` que devuelve la API real se descarta acá mismo — nunca sale de
 * esta función.
 */
export const createYavendioWebhook = async (
  token: string,
  companyId: string,
  payload: CreateYavendioWebhookPayload,
): Promise<YavendioWebhook> => {
  const res = await axios.post<YavendioWebhookCreateResponse>(
    `${API_INTEGRATIONS}/yavendio/webhooks/${companyId}`,
    payload,
    { headers: headers(token) },
  );
  const { id, url, events, isActive, description, createdAt } = res.data;
  return { id, url, events, isActive, description, createdAt };
};

/**
 * Activa/desactiva un webhook existente
 * (`PATCH /yavendio/webhooks/:companyId/:webhookId`). Manda ÚNICAMENTE
 * `isActive` en el body — `url`/`events`/`description` quedan sin tocar del
 * lado del backend si no vienen en el body.
 */
export const setYavendioWebhookActive = async (
  token: string,
  companyId: string,
  webhookId: string,
  isActive: boolean,
): Promise<YavendioWebhook> => {
  const res = await axios.patch<YavendioWebhook>(
    `${API_INTEGRATIONS}/yavendio/webhooks/${companyId}/${webhookId}`,
    { isActive },
    { headers: headers(token) },
  );
  return res.data;
};

/**
 * Elimina un webhook (`DELETE /yavendio/webhooks/:companyId/:webhookId`).
 */
export const deleteYavendioWebhook = async (
  token: string,
  companyId: string,
  webhookId: string,
): Promise<void> => {
  await axios.delete(
    `${API_INTEGRATIONS}/yavendio/webhooks/${companyId}/${webhookId}`,
    { headers: headers(token) },
  );
};
