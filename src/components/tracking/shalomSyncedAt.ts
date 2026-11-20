const LIMA_TZ = "America/Lima";

/**
 * Texto de frescura del estado de Shalom a partir de `syncedAt` (ISO).
 * - menos de 1 min: «Actualizado hace un momento»
 * - menos de 60 min: «Actualizado hace X min»
 * - después: «Actualizado: dd/mm hh:mm» (hora de Lima)
 * Sin fecha válida devuelve null (backend viejo: no se muestra nada).
 */
export function formatShalomSyncedAt(
  syncedAt: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!syncedAt) return null;
  const time = new Date(syncedAt).getTime();
  if (Number.isNaN(time)) return null;

  const minutes = Math.floor(Math.max(0, now - time) / 60_000);
  if (minutes < 1) return "Actualizado hace un momento";
  if (minutes < 60) return `Actualizado hace ${minutes} min`;

  const parts = new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(time));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `Actualizado: ${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}
