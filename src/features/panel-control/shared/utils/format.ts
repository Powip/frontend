import { dayKeyToUtcMidnight } from "./lima-time";

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "set",
  "oct",
  "nov",
  "dic",
];
const LOCALE = "es-PE";

const isNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const SIN_DATO = "—";

export function formatSoles(value: number | null | undefined): string {
  if (!isNumber(value)) return SIN_DATO;
  const abs = Math.round(Math.abs(value)).toLocaleString(LOCALE);
  return value < 0 ? `−S/ ${abs}` : `S/ ${abs}`;
}

export function formatSolesDecimales(value: number | null | undefined): string {
  if (!isNumber(value)) return SIN_DATO;
  const abs = Math.abs(value).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `−S/ ${abs}` : `S/ ${abs}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (!isNumber(value)) return SIN_DATO;
  return Math.round(value).toLocaleString(LOCALE);
}

export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (!isNumber(value)) return SIN_DATO;
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatVeces(value: number | null | undefined): string {
  if (!isNumber(value)) return SIN_DATO;
  return `${value.toFixed(1)}x`;
}

export function formatMinutes(value: number | null | undefined): string {
  if (!isNumber(value)) return SIN_DATO;
  return `${Math.round(value)} min`;
}

export function formatDays(value: number | null | undefined): string {
  if (!isNumber(value)) return SIN_DATO;
  return `${value.toFixed(1)} días`;
}

export function formatDayKey(key: string): string {
  const date = new Date(dayKeyToUtcMidnight(key));
  return `${date.getUTCDate()} ${MESES_CORTOS[date.getUTCMonth()]}`;
}

export function formatDayKeyWithYear(key: string): string {
  const date = new Date(dayKeyToUtcMidnight(key));
  return `${formatDayKey(key)} ${date.getUTCFullYear()}`;
}

export function formatRange(desde: string, hasta: string): string {
  return desde === hasta ? formatDayKey(desde) : `${formatDayKey(desde)} – ${formatDayKey(hasta)}`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
