import { CierreDiaFormInput, CierreDiaRecord } from "@/interfaces/ICierreDia";

/**
 * Persistencia de Cierre del Día.
 *
 * No existe todavía un endpoint en ms-ventas para esto, así que se guarda
 * en localStorage por tienda. Las funciones están pensadas para que el día
 * que exista el endpoint (ej. `/atencion-al-cliente/cierre-dia`) alcance con
 * reemplazar el cuerpo de estas funciones por llamadas a `axiosAuth` — las
 * firmas y el shape de `CierreDiaRecord` no deberían cambiar.
 */

function storageKey(storeId: string): string {
  return `powip_cierre_dia_${storeId}`;
}

function readAll(storeId: string): Record<string, CierreDiaRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(storeId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(storeId: string, data: Record<string, CierreDiaRecord>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(storeId), JSON.stringify(data));
}

export async function getCierreDiaDay(
  storeId: string,
  date: string,
): Promise<CierreDiaRecord | null> {
  const all = readAll(storeId);
  return all[date] ?? null;
}

export async function getCierreDiaRange(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<CierreDiaRecord[]> {
  const all = readAll(storeId);
  return Object.values(all)
    .filter((r) => r.date >= startDate && r.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCierreDiaMonth(
  storeId: string,
  monthStr: string, // YYYY-MM
): Promise<CierreDiaRecord[]> {
  const all = readAll(storeId);
  return Object.values(all)
    .filter((r) => r.date.startsWith(monthStr))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveCierreDiaDay(
  storeId: string,
  date: string,
  input: CierreDiaFormInput,
): Promise<CierreDiaRecord> {
  const all = readAll(storeId);
  const existing = all[date];
  const record: CierreDiaRecord = {
    ...input,
    storeId,
    date,
    savedAt: existing?.savedAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  all[date] = record;
  writeAll(storeId, all);
  return record;
}

export async function deleteCierreDiaDay(storeId: string, date: string): Promise<void> {
  const all = readAll(storeId);
  delete all[date];
  writeAll(storeId, all);
}
