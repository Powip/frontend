import type { LiveConfig, LiveYapeConfig } from "./types";

/**
 * FEAT-33 A1/B4: formularios de Configuración del panel Live.
 * Los números se editan como texto (para poder borrar y reescribir) y se validan al guardar.
 * Solo se manda lo que cambió y solo se valida lo que cambió: un valor viejo fuera del rango
 * nuevo no bloquea guardar otra cosa (el servidor tampoco lo revisa si no viene en el body).
 */
export interface LiveConfigDraft {
  enabled: boolean;
  liveUrl: string;
  showBackLink: boolean;
  hideSoldOut: boolean;
  allowAccumulation: boolean;
  allowReservations: boolean;
  combineShipping: boolean;
  slug: string;
  reservationMinutes: string;
  maxReservedUnits: string;
  closePolicy: LiveConfig["closePolicy"];
}
type DraftKey = keyof LiveConfigDraft;
export type LiveConfigErrors = Partial<Record<DraftKey, string>>;

const SLUG = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
const HTTPS = /^https:\/\/[^\s/.]+\.[^\s]+$/i;

export function liveConfigDraft(config: LiveConfig): LiveConfigDraft {
  return {
    enabled: config.enabled,
    liveUrl: config.liveUrl ?? "",
    showBackLink: config.showBackLink,
    hideSoldOut: config.hideSoldOut === true,
    allowAccumulation: config.allowAccumulation,
    allowReservations: config.allowReservations,
    combineShipping: config.combineShipping,
    slug: config.slug ?? "",
    reservationMinutes: String(config.reservationMinutes),
    maxReservedUnits: String(config.maxReservedUnits),
    closePolicy: config.closePolicy,
  };
}

function draftValue(draft: LiveConfigDraft, key: DraftKey) {
  const value = draft[key];
  if (key === "reservationMinutes" || key === "maxReservedUnits")
    return Number(value);
  if (key === "liveUrl" || key === "slug") return String(value).trim();
  return value;
}

export function liveConfigChanges(
  saved: LiveConfig,
  draft: LiveConfigDraft,
): Partial<LiveConfig> {
  const base = liveConfigDraft(saved);
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as DraftKey[]) {
    const next = draftValue(draft, key);
    if (next !== draftValue(base, key)) changes[key] = next;
  }
  return changes as Partial<LiveConfig>;
}

const intIn = (raw: string, min: number, max: number) => {
  if (!/^\d+$/.test(raw.trim())) return false;
  const value = Number(raw);
  return value >= min && value <= max;
};

export function liveConfigErrors(
  saved: LiveConfig,
  draft: LiveConfigDraft,
): LiveConfigErrors {
  const changed = liveConfigChanges(saved, draft) as Record<string, unknown>;
  const errors: LiveConfigErrors = {};
  const url = draft.liveUrl.trim();
  if (
    "reservationMinutes" in changed &&
    !intIn(draft.reservationMinutes, 5, 120)
  )
    errors.reservationMinutes = "Entre 5 y 120 minutos.";
  if ("maxReservedUnits" in changed && !intIn(draft.maxReservedUnits, 1, 50))
    errors.maxReservedUnits = "Entre 1 y 50 unidades.";
  if ("liveUrl" in changed && url && !HTTPS.test(url))
    errors.liveUrl = "Pega un enlace que empiece con https://";
  else if (
    draft.showBackLink &&
    !url &&
    ("showBackLink" in changed || "liveUrl" in changed)
  )
    errors.liveUrl = "Pega el link de tu live para mostrar «Volver al live».";
  if ("slug" in changed && draft.slug.trim() && !SLUG.test(draft.slug.trim()))
    errors.slug = "Usa de 3 a 50 letras minúsculas, números o guiones.";
  return errors;
}

export interface LiveYapeDraft {
  enabled: boolean;
  phone: string;
  holder: string;
  reviewHours: string;
}
export type LiveYapeErrors = Partial<
  Record<"phone" | "holder" | "reviewHours", string>
>;

export function liveYapeDraft(config: LiveYapeConfig): LiveYapeDraft {
  return {
    enabled: config.enabled,
    phone: config.phone ?? "",
    holder: config.holder ?? "",
    reviewHours: String(config.reviewHours),
  };
}

/** Quita espacios, guiones y el +51 de un celular peruano. */
export function yapePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("51")
    ? digits.slice(2)
    : digits;
}

export function liveYapeErrors(draft: LiveYapeDraft): LiveYapeErrors {
  const errors: LiveYapeErrors = {};
  if (!/^9\d{8}$/.test(yapePhone(draft.phone)))
    errors.phone = "Número de 9 dígitos que empiece con 9.";
  if (draft.holder.trim().length < 3)
    errors.holder =
      "Escribe el titular tal como sale en Yape (al menos 3 letras).";
  if (!intIn(draft.reviewHours, 1, 72))
    errors.reviewHours = "Entre 1 y 72 horas.";
  return errors;
}

export function liveYapeInput(
  draft: LiveYapeDraft,
): Omit<LiveYapeConfig, "qrUrl"> {
  return {
    enabled: draft.enabled,
    phone: yapePhone(draft.phone),
    holder: draft.holder.trim(),
    reviewHours: Number(draft.reviewHours),
  };
}

export function sameYapeDraft(a: LiveYapeDraft, b: LiveYapeDraft) {
  const x = liveYapeInput(a);
  const y = liveYapeInput(b);
  return (
    x.enabled === y.enabled &&
    x.phone === y.phone &&
    x.holder === y.holder &&
    a.reviewHours.trim() === b.reviewHours.trim()
  );
}

/** «4:10 p. m.», como el mockup. */
export function savedAtLabel(date = new Date()): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "p. m." : "a. m."}`;
}
