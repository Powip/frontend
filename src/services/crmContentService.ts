import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type {
  Material,
  MaterialInput,
  MaterialUpdate,
  Objection,
  ObjectionInput,
  ObjectionStats,
  ObjectionUpdate,
  Script,
  ScriptInput,
  ScriptReads,
  Sheet,
  SheetInput,
  SheetUpdate,
} from "@/types/crmContent";

const BASE = `${API.crm}/crm`;
const enc = encodeURIComponent;

// --- Guion ---

export async function getScript(): Promise<Script> {
  return (await axiosAuth.get<Script>(`${BASE}/content/script`)).data;
}

/** Solo administrador. Sube la versión. */
export async function saveScript(input: ScriptInput): Promise<Script> {
  return (await axiosAuth.put<Script>(`${BASE}/content/script`, input)).data;
}

export async function markScriptRead(): Promise<Script> {
  return (await axiosAuth.post<Script>(`${BASE}/content/script/read`)).data;
}

/** Solo administrador. */
export async function getScriptReads(): Promise<ScriptReads> {
  return (await axiosAuth.get<ScriptReads>(`${BASE}/content/script/reads`)).data;
}

// --- Objeciones ---

export async function listObjections(): Promise<Objection[]> {
  return (await axiosAuth.get<{ items: Objection[] }>(`${BASE}/content/objections`)).data.items;
}

export async function createObjection(input: ObjectionInput): Promise<Objection> {
  return (await axiosAuth.post<Objection>(`${BASE}/content/objections`, input)).data;
}

/**
 * «Enseñarle la respuesta a Pau»: cualquier usuario puede proponer. Queda
 * inactiva hasta que un administrador la apruebe (si propone un administrador,
 * queda activa de inmediato).
 */
export async function proposeObjection(input: ObjectionInput): Promise<Objection> {
  return (await axiosAuth.post<Objection>(`${BASE}/content/objections/propose`, input)).data;
}

export async function updateObjection(id: string, input: ObjectionUpdate): Promise<Objection> {
  return (await axiosAuth.patch<Objection>(`${BASE}/content/objections/${enc(id)}`, input)).data;
}

export async function deleteObjection(id: string): Promise<void> {
  await axiosAuth.delete(`${BASE}/content/objections/${enc(id)}`);
}

/** Registra que la vendedora usó esa respuesta en ese chat. */
export async function registerObjectionUse(
  conversationId: string,
  objectionId: string,
): Promise<void> {
  await axiosAuth.post(`${BASE}/conversations/${enc(conversationId)}/objections`, { objectionId });
}

/** Solo administrador. */
export async function getObjectionStats(days = 30): Promise<ObjectionStats> {
  return (
    await axiosAuth.get<ObjectionStats>(`${BASE}/content/objections/stats`, { params: { days } })
  ).data;
}

// --- Fichas ---

export async function listSheets(search?: string): Promise<Sheet[]> {
  const q = search?.trim();
  return (
    await axiosAuth.get<{ items: Sheet[] }>(`${BASE}/content/sheets`, {
      params: q ? { search: q } : undefined,
    })
  ).data.items;
}

export async function createSheet(input: SheetInput): Promise<Sheet> {
  return (await axiosAuth.post<Sheet>(`${BASE}/content/sheets`, input)).data;
}

export async function updateSheet(id: string, input: SheetUpdate): Promise<Sheet> {
  return (await axiosAuth.patch<Sheet>(`${BASE}/content/sheets/${enc(id)}`, input)).data;
}

export async function deleteSheet(id: string): Promise<void> {
  await axiosAuth.delete(`${BASE}/content/sheets/${enc(id)}`);
}

// --- Material ---

/** `general` = material del negocio sin producto. */
export async function listMaterials(sheetId: string): Promise<Material[]> {
  return (
    await axiosAuth.get<{ items: Material[] }>(`${BASE}/content/materials`, {
      params: { sheetId },
    })
  ).data.items;
}

export async function createMaterial(input: MaterialInput): Promise<Material> {
  return (await axiosAuth.post<Material>(`${BASE}/content/materials`, input)).data;
}

export async function updateMaterial(id: string, input: MaterialUpdate): Promise<Material> {
  return (await axiosAuth.patch<Material>(`${BASE}/content/materials/${enc(id)}`, input)).data;
}

export async function deleteMaterial(id: string): Promise<void> {
  await axiosAuth.delete(`${BASE}/content/materials/${enc(id)}`);
}

export { crmError as crmContentError } from "@/services/crmService";
