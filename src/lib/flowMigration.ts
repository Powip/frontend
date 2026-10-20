/**
 * Fechas de la migración a Flow (FEAT-25). Todas son "solo día" (yyyy-MM-dd) y se leen en hora
 * de Lima: los clientes son de Perú y entre las 19:00 y las 23:59 de Lima, en UTC ya es mañana.
 */
const LIMA = "America/Lima";

/** Hoy en Lima, como yyyy-MM-dd. */
export function limaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Mediodía UTC del día: así ningún formateo ni suma lo corre de día. */
const atNoonUtc = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`);

export function addDays(isoDate: string, days: number): string {
  const date = atNoonUtc(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Primer cobro de Flow si migra hoy: el día siguiente al último día pagado, si todavía no venció
 * (misma regla que ms-subscription). null = se cobra hoy, al registrar la tarjeta.
 */
export function firstChargePreview(endDate: string | null | undefined, today: string): string | null {
  if (!endDate || endDate < today) return null;
  return addDays(endDate, 1);
}

/** "jueves 23/10". */
export function formatLimaDate(isoDate: string): string {
  const date = atNoonUtc(isoDate);
  const weekday = new Intl.DateTimeFormat("es-PE", { weekday: "long", timeZone: "UTC" }).format(date);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${weekday} ${day}/${month}`;
}

/** Migración ya hecha que espera su primer cobro: Flow la creó con fecha de inicio futura. */
export function isScheduledMigration(sub: { gateway: string; status: string; startDate: string | null }): boolean {
  return sub.gateway === "FLOW" && sub.status === "PENDING_PAYMENT" && Boolean(sub.startDate);
}
