import type { AdsRow, AdsSummary } from "@/services/advertisingV22Service";
import { daysForRow, isMetaPaused, numeric } from "./model";

/** Catalog evidence remains usable when the independent sales request fails. */
export function catalogChannels(row: AdsRow): Set<string> {
  const channels = new Set<string>();
  const destination = (value: string | null | undefined) => {
    const kind = value?.toUpperCase();
    if (["WEB", "WEBSITE", "SHOPIFY", "SHOPIFY_COD"].includes(kind ?? "")) channels.add("web");
    else if (
      ["WHATSAPP", "INSTAGRAM", "INSTAGRAM_DIRECT", "MESSENGER", "FACEBOOK"].includes(kind ?? "")
    )
      channels.add("messages");
  };
  destination(row.destinationType);
  for (const item of row.destinations ?? []) destination(item.type);
  if (channels.size === 0) {
    if ((numeric(row.insights.resultMetrics?.messages.count) ?? 0) > 0) channels.add("messages");
    if ((numeric(row.insights.resultMetrics?.webPurchases.count) ?? 0) > 0) channels.add("web");
  }
  return channels.size ? channels : new Set(["other"]);
}
export function isActiveAd(row: AdsRow) {
  return !isMetaPaused(row) && (row.effectiveStatus ?? row.status) === "ACTIVE";
}
export function lastSpendAt(row: AdsRow, summary?: AdsSummary) {
  const recorded = (row as AdsRow & { lastSpendAt?: string | null }).lastSpendAt;
  if (recorded && Number.isFinite(Date.parse(recorded))) return recorded;
  return summary
    ? (daysForRow(row, summary)
        .filter((day) => (numeric(day.spend) ?? 0) > 0)
        .map((day) => day.date)
        .sort()
        .at(-1) ?? null)
    : null;
}
export function lastSpendLabel(row: AdsRow, summary: AdsSummary | undefined, today: string) {
  const last = lastSpendAt(row, summary);
  if (!last) return "—";
  const hasZone = /(?:Z|[+-]\d\d:\d\d)$/.test(last);
  const day = hasZone
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: row.timeZone || "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(last))
    : last.slice(0, 10);
  const elapsed = Math.max(
    0,
    Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000),
  );
  if (elapsed === 0)
    return last.length > 10
      ? `hoy ${hasZone ? new Intl.DateTimeFormat("es-PE", { timeZone: row.timeZone || "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(last)) : last.slice(11, 16)}`
      : "hoy";
  return elapsed === 1 ? "ayer" : `hace ${elapsed} días`;
}
export function sortAdItems<T extends { row: AdsRow; state: string }>(
  items: T[],
  sort: string,
  statusOrder: string[],
) {
  return [...items].sort((a, b) => {
    const spend = (numeric(b.row.insights.spend) ?? 0) - (numeric(a.row.insights.spend) ?? 0);
    if (sort === "spend") return spend || a.row.name.localeCompare(b.row.name);
    if (sort === "attention")
      return (
        (statusOrder.indexOf(a.state) < 0 ? 99 : statusOrder.indexOf(a.state)) -
          (statusOrder.indexOf(b.state) < 0 ? 99 : statusOrder.indexOf(b.state)) || spend
      );
    return (
      Number(isActiveAd(b.row)) - Number(isActiveAd(a.row)) ||
      (Date.parse(lastSpendAt(b.row) ?? "") || 0) - (Date.parse(lastSpendAt(a.row) ?? "") || 0) ||
      spend ||
      a.row.name.localeCompare(b.row.name)
    );
  });
}
