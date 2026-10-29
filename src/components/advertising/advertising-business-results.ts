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
export function businessCountAvailable(
  row: AdvertisingBusinessRow,
  analytics: AdvertisingBusinessAnalytics,
  meta: MetaCatalogResponse | null,
  storeId: string,
): boolean {
  const level =
    analytics.groupBy === "ad" ? "ad" : analytics.groupBy === "campaign" ? "campaign" : null;
  if (
    !level ||
    !row.id ||
    !row.accountId ||
    !meta ||
    meta.source !== "meta" ||
    analytics.source !== "powip-orders" ||
    storeId === "none" ||
    (analytics.storeId ?? "all") !== storeId ||
    (analytics.channelId ?? "all") !== "all" ||
    analytics.truncated ||
    analytics.from !== meta.from ||
    analytics.to !== meta.to
  )
    return false;
  const matches = meta.rows.filter(
    (item) => item.id === row.id && item.accountId === row.accountId && item.level === level,
  );
  if (matches.length !== 1) return false;
  const entity = matches[0];
  if (
    !row.currency ||
    row.currency !== entity.currency ||
    row.adCurrency !== entity.currency ||
    row.adTimeZone !== entity.timeZone ||
    analytics.timeZone !== entity.timeZone
  )
    return false;
  const cohort = analytics.cohortCoverage;
  if (cohort?.basis !== analytics.basis || cohort.complete !== true) return false;
  const missing =
    analytics.basis === "delivered"
      ? cohort.missingDeliveredDateCount
      : analytics.basis === "paid"
        ? cohort.missingPaidDateCount
        : 0;
  const legacyMissing =
    analytics.basis === "delivered"
      ? analytics.quality?.missingDeliveredDateCount
      : analytics.basis === "paid"
        ? analytics.quality?.missingPaidDateCount
        : 0;
  return (
    Number.isSafeInteger(missing) &&
    missing === 0 &&
    Number.isSafeInteger(legacyMissing) &&
    legacyMissing === 0
  );
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
  const level =
    analytics.groupBy === "campaign" ? "campaign" : analytics.groupBy === "ad" ? "ad" : null;
  const entities = meta.rows.filter(
    (item) => item.id === row.id && item.accountId === row.accountId && item.level === level,
  );
  const ad: MetaCatalogRow | undefined = entities.length === 1 ? entities[0] : undefined;
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
  const cohort = analytics.cohortCoverage;
  if (
    analytics.basis !== "created" &&
    (cohort?.basis !== analytics.basis ||
      cohort.complete !== true ||
      !Number.isSafeInteger(
        analytics.basis === "delivered"
          ? cohort.missingDeliveredDateCount
          : cohort.missingPaidDateCount,
      ) ||
      (analytics.basis === "delivered"
        ? cohort.missingDeliveredDateCount
        : cohort.missingPaidDateCount) !== 0)
  )
    return {
      spend,
      cpe: null,
      paidRoas: null,
      contributionAfterAds: null,
      reason:
        analytics.basis === "paid"
          ? "Fechas de cobro por completar"
          : "Fechas de entrega por completar",
    };
  const missingDateCount =
    analytics.basis === "delivered"
      ? analytics.quality?.missingDeliveredDateCount
      : analytics.basis === "paid"
        ? analytics.quality?.missingPaidDateCount
        : 0;
  if (!Number.isSafeInteger(missingDateCount) || missingDateCount !== 0)
    return {
      spend,
      cpe: null,
      paidRoas: null,
      contributionAfterAds: null,
      reason:
        analytics.basis === "paid"
          ? "Fechas de cobro por completar"
          : "Fechas de entrega por completar",
    };
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
