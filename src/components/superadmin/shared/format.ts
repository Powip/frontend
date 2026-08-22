export function money(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function moneyCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `S/ ${(n / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })}k`;
  return money(n);
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function relativeDays(iso: string): string {
  const dias = Math.floor((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (dias === 0) return "Hoy";
  if (dias === -1) return "Ayer";
  if (dias < 0) return `Hace ${Math.abs(dias)}d`;
  if (dias === 1) return "Mañana";
  return `En ${dias}d`;
}

/** "hace 12 min" / "hace 3h" / "hace 2d" — granularidad fina para feeds de actividad/alertas. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.round(diffMs / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias}d`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
