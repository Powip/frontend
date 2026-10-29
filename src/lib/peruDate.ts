// Fechas de calendario de Perú (America/Lima, sin horario de verano).
// No dependen de la zona horaria de la máquina.

const peruFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD armado con las partes: no depende de cómo el locale ordena la fecha. */
function formatPeruDay(date: Date): string {
  const parts = peruFormatter.formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export interface DateWindow {
  fromDate: string;
  /** "" = hasta hoy, sin tope. */
  toDate: string;
}

/** Día (YYYY-MM-DD) en Perú para un instante dado. */
export function todayInPeru(now: Date = new Date()): string {
  return formatPeruDay(now);
}

/** Suma `days` días de calendario a una fecha YYYY-MM-DD. */
export function shiftPeruDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Día (YYYY-MM-DD) en Perú de un timestamp ISO. */
export function peruDateOf(isoTimestamp: string): string {
  return formatPeruDay(new Date(isoTimestamp));
}

/** ¿El timestamp cae dentro de la ventana, medido en días de Perú? `toDate: ""` no tiene tope. */
export function isInPeruWindow(isoTimestamp: string, window: DateWindow): boolean {
  const day = peruDateOf(isoTimestamp);
  return day >= window.fromDate && (window.toDate === "" || day <= window.toDate);
}
