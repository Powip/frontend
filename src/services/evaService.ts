import axios from "axios";

const API_INTEGRATIONS = (
  process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3004"
).replace(/\/$/, "");

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

// ─── TIPOS ──────────────────────────────────────────────

export type EvaClientType = "RECOJO" | "ALMACEN";

/** 1 = GENERAL, 2 = TARDE (ver EvaServiceType en ms-integrations). */
export type EvaServiceType = 1 | 2;

/** Valores exactos exigidos por EVA (sensibles a mayúsculas/espacios). */
export type EvaPaymentMethod =
  | "EFECTIVO"
  | "SOLO ENTREGAR"
  | "POS"
  | "TRANSFERENCIA / YAPE"
  | "TRANSFERENCIA DIRECTA A EMPRESA"
  | "CAMBIO / CAMBIO CON COBRO"
  | "RECOJO EN RUTA";

export interface EvaCredentialSafe {
  id: string;
  companyId: string;
  baseUrl: string | null;
  clientType: EvaClientType;
  maskedApiKey: string;
  hasWebhookSecret: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveEvaCredentialPayload {
  companyId: string;
  apiKey: string;
  baseUrl?: string;
  clientType: EvaClientType;
  webhookSecret?: string;
}

export interface EvaGps {
  lat: number;
  lng: number;
}

export interface CreateEvaOrderPayload {
  companyId: string;
  orderId: string;
  shipmentId?: string;
  recipientName: string;
  /** Debe incluir el prefijo +51. */
  recipientPhone: string;
  /** Debe matchear exactamente uno de los 65 distritos del Anexo A del manual EVA. */
  district: string;
  address: string;
  amount: number;
  paymentMethod: EvaPaymentMethod;
  serviceType: EvaServiceType;
  reference?: string;
  observations?: string;
  gps?: EvaGps;
  /** Requerido si la cuenta EVA de la empresa es RECOJO. */
  product?: string;
  /** Requerido si la cuenta EVA de la empresa es RECOJO. */
  packages?: number;
  /** Requerido si la cuenta EVA de la empresa es ALMACEN. Formato CODIGO(cant)[,CODIGO(cant)...]. */
  sku?: string;
}

export interface EvaCreateOrderResult {
  trackingId: string;
  externalOrderId: string;
}

// ─── SERVICIOS ──────────────────────────────────────────

export const getEvaCredentials = async (
  token: string,
  companyId: string,
): Promise<EvaCredentialSafe | null> => {
  try {
    const res = await axios.get<EvaCredentialSafe>(
      `${API_INTEGRATIONS}/eva/credentials/${companyId}`,
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

export const saveEvaCredentials = async (
  token: string,
  payload: SaveEvaCredentialPayload,
): Promise<EvaCredentialSafe> => {
  const res = await axios.post<EvaCredentialSafe>(
    `${API_INTEGRATIONS}/eva/credentials`,
    payload,
    { headers: headers(token) },
  );
  return res.data;
};

/**
 * A diferencia de Aliclik, el connection-test de EVA no devuelve `{ ok, message }`:
 * devuelve la credencial actualizada (activada si la Api-Key es válida) o rechaza
 * con 401 si es inválida — el llamador debe envolver esto en try/catch.
 */
export const testEvaConnection = async (
  token: string,
  companyId: string,
): Promise<EvaCredentialSafe> => {
  const res = await axios.post<EvaCredentialSafe>(
    `${API_INTEGRATIONS}/eva/credentials/${companyId}/connection-test`,
    {},
    { headers: headers(token) },
  );
  return res.data;
};

export const createEvaOrder = async (
  token: string,
  payload: CreateEvaOrderPayload,
): Promise<EvaCreateOrderResult> => {
  const res = await axios.post<EvaCreateOrderResult>(
    `${API_INTEGRATIONS}/eva/orders`,
    payload,
    { headers: headers(token) },
  );
  return res.data;
};

// ─── DISTRITOS (Anexo A del manual EVA — hallazgo #14) ───

/**
 * Cache in-memory a nivel de módulo del maestro de distritos: se resetea al
 * recargar la página. El maestro ya está cacheado del lado de ms-integrations
 * (constante estática, sin llamar a EVA en el hot path) — acá solo evitamos
 * repetir el request si el modal se abre más de una vez en la misma sesión.
 * Si el request falla, NO se cachea el error: el próximo llamado reintenta.
 */
let cachedEvaDistricts: string[] | null = null;

/**
 * Devuelve el maestro completo de distritos válidos para EVA (65 valores exactos,
 * sensibles a mayúsculas/tildes/espacios). Un solo request por sesión de página —
 * el filtrado/selección se hace 100% en cliente sobre la lista ya cargada, sin
 * pegarle a la API por cada tecla.
 */
export const getEvaDistricts = async (token: string): Promise<string[]> => {
  if (cachedEvaDistricts) return cachedEvaDistricts;

  const res = await axios.get<{ districts: string[] }>(
    `${API_INTEGRATIONS}/eva/districts`,
    { headers: headers(token) },
  );
  cachedEvaDistricts = res.data.districts;
  return cachedEvaDistricts;
};
