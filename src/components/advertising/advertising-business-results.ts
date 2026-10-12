import type { MetaCatalogResponse, MetaCatalogRow } from "@/services/advertisingMetaService";
import type {
  AdvertisingBusinessAnalytics,
  AdvertisingBusinessRow,
} from "@/services/advertisingOrdersService";
import { metaSpendReconciled } from "./advertising-meta-model";

function parse(value: string) {
  if (!/^-?\d+(?:\.\d+)?$/.test(value) || value.length > 1024) throw new Error("Importe inválido");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  return {
    units: BigInt(`${whole}${fraction}`) * (value.startsWith("-") ? -BigInt(1) : BigInt(1)),
    scale: fraction.length,
  };
}
function serialize(units: bigint, scale: number) {
  const negative = units < BigInt(0);
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  return `${negative ? "-" : ""}${scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`;
}
export function subtractOrderDecimals(left: string, right: string) {
  const a = parse(left);
  const b = parse(right);
  const scale = Math.max(a.scale, b.scale);
  return serialize(
    a.units * BigInt(10) ** BigInt(scale - a.scale) -
      b.units * BigInt(10) ** BigInt(scale - b.scale),
    scale,
  );
}
export function divideOrderDecimals(left: string, right: string, places = 6): string | null {
  const a = parse(left);
  const b = parse(right);
  if (a.units < BigInt(0) || b.units <= BigInt(0)) return null;
  const numerator = a.units * BigInt(10) ** BigInt(b.scale + places);
  const denominator = b.units * BigInt(10) ** BigInt(a.scale);
  return serialize((numerator + denominator / BigInt(2)) / denominator, places);
}

export interface AdvertisingBusinessResult {
  spend: string | null;
  cpe: string | null;
  paidRoas: string | null;
  contributionAfterAds: string | null;
  reason: string | null;
}
export function businessResult(
  row: AdvertisingBusinessRow,
  analytics: AdvertisingBusinessAnalytics,
  meta: MetaCatalogResponse | null,
): AdvertisingBusinessResult {
  const empty = (reason: string): AdvertisingBusinessResult => ({
    spend: null,
    cpe: null,
    paidRoas: null,
    contributionAfterAds: null,
    reason,
  });
  if (!row.id || !row.accountId) return empty("Sin anuncio confirmado");
  if (!meta) return empty("Gasto de Meta pendiente");
  const ad: MetaCatalogRow | undefined = meta.rows.find(
    (item) => item.id === row.id && item.accountId === row.accountId && item.level === "ad",
  );
  if (!ad || ad.insights.spend === null) return empty("Gasto de Meta pendiente");
  if (!row.currency || row.currency !== ad.currency || row.adCurrency !== ad.currency)
    return empty("Monedas distintas o sin confirmar");
  if (analytics.timeZone !== ad.timeZone || row.adTimeZone !== ad.timeZone)
    return empty("Zonas horarias distintas");
  if (analytics.from !== meta.from || analytics.to !== meta.to) return empty("Periodos distintos");
  if (analytics.truncated) return empty("Hay grupos pendientes de cargar");
  const reconciliation = ad.insights.coverage.reconciliation;
  if (reconciliation?.status === "mismatch") return empty("Gasto por revisar");
  const periodDays =
    (Date.parse(`${meta.to}T00:00:00Z`) - Date.parse(`${meta.from}T00:00:00Z`)) / 86400000 + 1;
  if (
    !Number.isInteger(periodDays) ||
    periodDays < 1 ||
    periodDays > 366 ||
    ad.insights.coverage.totalDays !== periodDays
  )
    return empty("Gasto por confirmar");
  if (!metaSpendReconciled(ad.insights.coverage)) return empty("Gasto por confirmar");
  const spend = ad.insights.spend;
  const cpe =
    analytics.basis === "delivered" && row.deliveredCount > 0
      ? divideOrderDecimals(spend, String(row.deliveredCount))
      : null;
  const paidRoas =
    analytics.basis === "paid" && row.paidRevenue !== null
      ? divideOrderDecimals(row.paidRevenue, spend, 2)
      : null;
  const contributionAfterAds =
    analytics.basis === "paid" &&
    row.incompleteCostCount === 0 &&
    row.contributionBeforeAds !== null &&
    row.cancelledCount === 0
      ? subtractOrderDecimals(row.contributionBeforeAds, spend)
      : null;
  return { spend, cpe, paidRoas, contributionAfterAds, reason: null };
}
