const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "2026-10-20" -> "20 oct 2026". Built from the parts, never via `new Date("2026-10-20")`
 * (that is midnight UTC, which is the previous day in Lima). Returns the input if it is not a
 * plain date, so an unexpected value still shows something.
 */
export function formatOlvaTrackingDate(value: string): string {
  const match = DATE_ONLY.exec(value);

  if (!match) return value;

  const [, year, month, day] = match;

  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
}
