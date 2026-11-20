import { todayInLima } from "@/lib/purchaseOrders";

// FEAT-24 H10 — periodos (YYYY-MM), rangos del reporte de compras y el 423 de un
// mes cerrado (H10-D6). Funciones puras.

export const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** «2026-10» → «Octubre 2026». Lo que no es un periodo se devuelve tal cual. */
export function periodLabel(period: string | null | undefined): string {
  const match = PERIOD.exec(period ?? "");
  if (!match) return period ?? "—";
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

/** «2026-10» → «oct 2026» (ejes y tablas compactas). */
export function shortPeriodLabel(period: string): string {
  const match = PERIOD.exec(period);
  if (!match) return period;
  return `${SHORT_MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** Periodo `months` meses antes (negativo) o después. */
export function shiftPeriod(period: string, months: number): string {
  const match = PERIOD.exec(period);
  if (!match) return period;
  const index = Number(match[1]) * 12 + Number(match[2]) - 1 + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Último día de un periodo: «2026-02» → «2026-02-28». */
export function lastDayOf(period: string): string {
  const match = PERIOD.exec(period);
  if (!match) return period;
  const days = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
  return `${period}-${String(days).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------------------
   Reporte de compras: periodos rápidos (mockup vComRep)
--------------------------------------------------------------------------- */

export type PurchasesPeriodKind = "mes" | "mesant" | "trim" | "anio" | "rango";

export const PURCHASES_PERIOD_OPTIONS: Array<[PurchasesPeriodKind, string]> = [
  ["mes", "Este mes"],
  ["mesant", "Mes anterior"],
  ["trim", "Trimestre"],
  ["anio", "Este año"],
  ["rango", "Elegir fechas"],
];

/** El backend acepta hasta 731 días por consulta. */
export const MAX_RANGE_DAYS = 731;

export interface PurchasesRange {
  from: string;
  to: string;
  /** Texto para la pantalla, el PDF y el Excel. */
  label: string;
  /** Mensaje si el rango elegido no sirve. */
  error?: string;
}

const dayDiff = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

/**
 * Rango de un periodo rápido, en días de Lima. «Trimestre» es el último trimestre calendario terminado (en
 * octubre: julio a septiembre); «Este año», del 1 de enero a hoy.
 */
export function purchasesRange(kind: PurchasesPeriodKind, custom: { from?: string; to?: string } = {}, now: Date = new Date()): PurchasesRange {
  const today = todayInLima(now);
  const current = today.slice(0, 7);
  if (kind === "mes") return { from: `${current}-01`, to: today, label: periodLabel(current) };
  if (kind === "mesant") {
    const previous = shiftPeriod(current, -1);
    return { from: `${previous}-01`, to: lastDayOf(previous), label: periodLabel(previous) };
  }
  if (kind === "trim") {
    const month = Number(current.slice(5, 7));
    const quarterStart = shiftPeriod(`${current.slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}`, -3);
    const quarterEnd = shiftPeriod(quarterStart, 2);
    return {
      from: `${quarterStart}-01`,
      to: lastDayOf(quarterEnd),
      label: `${shortPeriodLabel(quarterStart).split(" ")[0]}–${shortPeriodLabel(quarterEnd)}`,
    };
  }
  if (kind === "anio") return { from: `${today.slice(0, 4)}-01-01`, to: today, label: `Año ${today.slice(0, 4)}` };
  const from = custom.from ?? "";
  const to = custom.to ?? "";
  const label = `${formatYmd(from)} al ${formatYmd(to)}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { from, to, label, error: "Elige las dos fechas." };
  if (from > to) return { from, to, label, error: "La fecha «Desde» tiene que ser anterior a «Hasta»." };
  if (dayDiff(from, to) > MAX_RANGE_DAYS) return { from, to, label, error: "El rango puede tener hasta dos años." };
  return { from, to, label };
}

/** «2026-11-18» → «18/11/2026». */
export function formatYmd(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "—";
}

/* ---------------------------------------------------------------------------
   423 — operación con fecha en un mes cerrado
--------------------------------------------------------------------------- */

interface LockedBody {
  statusCode?: number;
  code?: string;
  period?: string;
  message?: unknown;
}

const lockedBody = (error: unknown): { status?: number; data?: LockedBody } => {
  const response = (error as { response?: { status?: number; data?: LockedBody } } | null)?.response;
  return { status: response?.status, data: response?.data };
};

/** ¿La API rechazó la operación porque su fecha cae en un periodo cerrado? */
export function isPeriodLocked(error: unknown): boolean {
  const { status, data } = lockedBody(error);
  return status === 423 || data?.code === "PERIODO_CERRADO";
}

/**
 * Texto claro para el 423: qué mes está cerrado, el motivo del servidor y qué hacer. `null` si el error es
 * otro.
 */
export function periodLockedMessage(error: unknown): string | null {
  if (!isPeriodLocked(error)) return null;
  const { data } = lockedBody(error);
  const month = data?.period ? periodLabel(data.period) : null;
  const server = typeof data?.message === "string" && data.message.trim() ? data.message.trim() : null;
  const head = month ? `${month} está cerrado.` : "El mes de esta operación está cerrado.";
  const detail = server && !server.startsWith(head) ? ` ${server}` : "";
  return `${head}${detail} Para corregirlo, registra un ajuste en el mes abierto o pide al Administrador que reabra el mes en Inventario › Cierre mensual.`;
}
