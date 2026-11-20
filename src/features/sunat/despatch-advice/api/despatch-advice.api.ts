import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { DownloadFileResult } from "@/types/download-file.types";
import { extractFilename } from "@/utils/http/extract-filename";
import type {
  DespatchAdvice,
  DespatchAdvicePage,
  GreCredential,
  GreSettings,
  IssueDespatchAdviceRequest,
  ListDespatchAdvicesQuery,
  UbigeoDistrict,
  UbigeoOptions,
  UbigeoResolution,
  UpsertGreCredentialRequest,
} from "../types/despatch-advice.types";

// FEAT-24 H12 — GRE remitente en ms-sunat. La empresa sale del token: nunca se
// manda un companyId. Ninguna de estas llamadas habla con SUNAT salvo emitir,
// reenviar y consultar el estado, y eso lo hace ms-sunat del otro lado.

const base = () => `${API.sunat}/api/v1`;
const id = (value: string) => encodeURIComponent(value);

/** Valida, numera, firma y envía. 201 con la guía en SENT, REJECTED o PENDING (+ lastError). */
export async function issueDespatchAdviceApi(body: IssueDespatchAdviceRequest): Promise<DespatchAdvice> {
  const { data } = await axiosAuth.post<DespatchAdvice>(`${base()}/despatch-advices`, body);
  return data;
}

export async function listDespatchAdvicesApi(query: ListDespatchAdvicesQuery, signal?: AbortSignal): Promise<DespatchAdvicePage> {
  const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== ""));
  const { data } = await axiosAuth.get<DespatchAdvicePage>(`${base()}/despatch-advices`, { params, signal });
  return data;
}

/** Todas las guías que cumplen el filtro (de a 100, el máximo del backend), para los reportes. */
export async function listAllDespatchAdvicesApi(query: Omit<ListDespatchAdvicesQuery, "page" | "pageSize">, maxPages = 20): Promise<DespatchAdvice[]> {
  const items: DespatchAdvice[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await listDespatchAdvicesApi({ ...query, page, pageSize: 100 });
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) break;
  }
  return items;
}

/** Si la guía está SENT, ms-sunat consulta el ticket en SUNAT y guarda el veredicto y el CDR. */
export async function refreshDespatchAdviceStatusApi(adviceId: string): Promise<DespatchAdvice> {
  const { data } = await axiosAuth.get<DespatchAdvice>(`${base()}/despatch-advices/${id(adviceId)}/status`);
  return data;
}

/** Reenvía una guía PENDING (nunca recibió ticket) con el mismo número. */
export async function sendDespatchAdviceApi(adviceId: string): Promise<DespatchAdvice> {
  const { data } = await axiosAuth.post<DespatchAdvice>(`${base()}/despatch-advices/${id(adviceId)}/send`, {});
  return data;
}

async function downloadDespatchAdviceFile(adviceId: string, file: "xml" | "cdr"): Promise<DownloadFileResult> {
  const response = await axiosAuth.get<Blob>(`${base()}/despatch-advices/${id(adviceId)}/${file}`, { responseType: "blob" });
  return { blob: response.data, filename: extractFilename(response.headers["content-disposition"]) };
}

export const downloadDespatchAdviceXmlApi = (adviceId: string) => downloadDespatchAdviceFile(adviceId, "xml");
export const downloadDespatchAdviceCdrApi = (adviceId: string) => downloadDespatchAdviceFile(adviceId, "cdr");

export async function getGreSettingsApi(signal?: AbortSignal): Promise<GreSettings> {
  const { data } = await axiosAuth.get<GreSettings>(`${base()}/despatch-advices/settings`, { signal });
  return data;
}

export async function upsertGreCredentialApi(sunatProfileId: string, body: UpsertGreCredentialRequest): Promise<GreCredential> {
  const { data } = await axiosAuth.put<GreCredential>(`${base()}/sunat-profiles/${id(sunatProfileId)}/gre-credentials`, body);
  return data;
}

/** Nombres de la dirección → ubigeo INEI. Siempre 200; `resolved: false` si no cruza. */
export async function resolveUbigeoApi(
  names: { department?: string | null; province?: string | null; district?: string | null },
  signal?: AbortSignal,
): Promise<UbigeoResolution> {
  const params = Object.fromEntries(Object.entries(names).filter(([, value]) => typeof value === "string" && value.trim() !== ""));
  const { data } = await axiosAuth.get<UbigeoResolution>(`${base()}/ubigeo/resolve`, { params, signal });
  return data;
}

/** Sin `parent`: departamentos; 2 dígitos: provincias; 4 dígitos: distritos. */
export async function listUbigeoOptionsApi(parent: string, signal?: AbortSignal): Promise<UbigeoOptions> {
  const { data } = await axiosAuth.get<UbigeoOptions>(`${base()}/ubigeo/options`, { params: parent ? { parent } : {}, signal });
  return data;
}

/** Nombres INEI de un código de 6 dígitos; 404 si no es un distrito. */
export async function getUbigeoApi(ubigeo: string, signal?: AbortSignal): Promise<UbigeoDistrict> {
  const { data } = await axiosAuth.get<UbigeoDistrict>(`${base()}/ubigeo/${id(ubigeo)}`, { signal });
  return data;
}

/** Pedido completo de ms-ventas (cliente, ítems y almacén) para precargar la guía. */
export async function getOrderForGreApi<T = unknown>(orderId: string, signal?: AbortSignal): Promise<T> {
  const { data } = await axiosAuth.get<T>(`${API.ventas}/order-header/${id(orderId)}`, { signal });
  return data;
}
