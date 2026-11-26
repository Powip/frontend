import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type {
  CatalogAttribution,
  CatalogSettings,
  MaterialStatus,
  Testimony,
  TestimoniesResponse,
} from "@/types/crmBlockDK";

const BASE = `${API.crm}/crm`;
const enc = encodeURIComponent;

// --- K4: testimonios ---

export async function listTestimonies(status?: MaterialStatus): Promise<TestimoniesResponse> {
  const { data } = await axiosAuth.get<TestimoniesResponse>(`${BASE}/content/testimonies`, {
    params: status ? { status } : {},
  });
  return data;
}

/** El supervisor publica directo; la vendedora publica el primero de un producto y el resto queda por aprobar. */
export async function proposeTestimony(input: { sheetId: string; title: string; url: string }): Promise<Testimony> {
  return (await axiosAuth.post<Testimony>(`${BASE}/content/testimonies`, input)).data;
}

export async function reviewMaterial(id: string, status: "published" | "rejected"): Promise<Testimony> {
  return (await axiosAuth.patch<Testimony>(`${BASE}/content/materials/${enc(id)}/review`, { status })).data;
}

// --- K5: catálogo ---

export async function getCatalogSettings(): Promise<CatalogSettings> {
  return (await axiosAuth.get<CatalogSettings>(`${BASE}/content/catalog-settings`)).data;
}

export async function saveCatalogSettings(input: { showSoldOut?: boolean }): Promise<CatalogSettings> {
  return (await axiosAuth.put<CatalogSettings>(`${BASE}/content/catalog-settings`, input)).data;
}

/** Los días de atribución viven en los ajustes del CRM (fuente única). */
export async function saveAttributionDays(attributionDays: number): Promise<void> {
  await axiosAuth.patch(`${BASE}/settings`, { attributionDays });
}

export async function getCatalogAttribution(): Promise<CatalogAttribution> {
  return (await axiosAuth.get<CatalogAttribution>(`${BASE}/content/catalog-attribution`)).data;
}

/** Regenera el PDF con precios y stock de hoy y lo devuelve como Blob. */
export async function generateCatalogPdf(businessName?: string): Promise<Blob> {
  const { data } = await axiosAuth.get<Blob>(`${BASE}/content/catalog-pdf`, {
    params: businessName ? { businessName } : {},
    responseType: "blob",
  });
  return data;
}
