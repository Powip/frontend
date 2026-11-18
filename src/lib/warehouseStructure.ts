import type { WarehouseDetails, WarehouseDetailsPatch } from "@/services/warehouseOpsService";

// FEAT-24 H5-C (H5-D7/D8) — reglas puras de la ficha del almacén (datos para
// la guía de remisión y SUNAT) y de sus ubicaciones. Las mismas validaciones
// que la fachada: lo que pasa aquí, pasa allá.

export const DETAIL_FIELDS = ["code", "ubigeo", "address", "contactName", "contactPhone", "sunatEstablishmentCode"] as const;
export type DetailField = (typeof DETAIL_FIELDS)[number];
export type DetailsForm = Record<DetailField, string>;

export const DETAIL_LABEL: Record<DetailField, string> = {
  code: "Código interno",
  ubigeo: "Ubigeo",
  address: "Dirección",
  contactName: "Contacto",
  contactPhone: "Teléfono de contacto",
  sunatEstablishmentCode: "Código de establecimiento SUNAT",
};

export function detailsFormFrom(details: Partial<WarehouseDetails> | null | undefined): DetailsForm {
  return Object.fromEntries(DETAIL_FIELDS.map((field) => [field, details?.[field] ?? ""])) as DetailsForm;
}

export function detailsProblem(form: DetailsForm): string | null {
  if (form.code.trim().length > 10) return "El código interno tiene como máximo 10 caracteres.";
  if (form.ubigeo.trim() && !/^\d{6}$/.test(form.ubigeo.trim())) return "El ubigeo son 6 dígitos (por ejemplo, 150101).";
  if (form.sunatEstablishmentCode.trim() && !/^\d{4}$/.test(form.sunatEstablishmentCode.trim()))
    return "El código de establecimiento SUNAT son 4 dígitos (por ejemplo, 0001).";
  if (form.address.trim().length > 300) return "La dirección tiene como máximo 300 caracteres.";
  return null;
}

/** Solo lo que cambió; un campo vaciado va como `null` (lo borra). */
export function detailsPatch(form: DetailsForm, current: Partial<WarehouseDetails> | null | undefined): WarehouseDetailsPatch {
  const patch: WarehouseDetailsPatch = {};
  for (const field of DETAIL_FIELDS) {
    const next = form[field].trim();
    const before = (current?.[field] ?? "").trim();
    if (next === before) continue;
    patch[field] = next === "" ? null : next;
  }
  return patch;
}

/** Código de ubicación: A-Z, 0-9 y . _ / - (hasta 30), en mayúsculas. */
export function normalizeLocationCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function locationCodeProblem(raw: string): string | null {
  const code = normalizeLocationCode(raw);
  if (!code) return "Escribe el código de la ubicación (por ejemplo, A-01-03).";
  if (code.length > 30) return "El código tiene como máximo 30 caracteres.";
  if (!/^[A-Z0-9._/-]+$/.test(code)) return "Usa solo letras, números y . _ / - (sin espacios).";
  return null;
}

/** Saldos que impiden desactivar (lo mismo que valida logistics). */
export function blockingBalances(counters: WarehouseDetails["counters"] | undefined): string[] {
  if (!counters) return [];
  const parts: Array<[number, string]> = [
    [counters.physical, "stock físico"],
    [counters.reserved, "reservas"],
    [counters.inTransit, "unidades en tránsito"],
    [counters.pendingReturn, "devoluciones por recibir"],
    [counters.incomingTransfer, "traslados en camino"],
  ];
  return parts.filter(([value]) => Number(value) > 0).map(([value, label]) => `${value} ${label}`);
}
