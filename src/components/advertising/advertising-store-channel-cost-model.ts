import type { AdvertisingBusinessMetrics } from "@/services/advertisingBusinessMetricsService";
import type { AdvertisingSummaryV11 } from "@/services/advertisingV11Service";
import { divideOrderDecimals } from "./advertising-business-results";
import { sumAdvertisingDecimals } from "./advertising-decimal";

export function advertisingStoreChannelTimeZone(summary: AdvertisingSummaryV11, channelId: string) {
  const ids = new Set(
    (summary.channelDaily ?? [])
      .filter((row) => row.storeId === summary.storeId && row.channelId === channelId)
      .map((row) => row.accountId),
  );
  const accounts = summary.byAccount.filter((account) => ids.has(account.accountId));
  const zones = [...new Set(accounts.map((account) => account.timeZone))];
  return ids.size &&
    accounts.length === ids.size &&
    zones.length === 1 &&
    typeof zones[0] === "string"
    ? zones[0]
    : null;
}

export interface AdvertisingStoreChannelComparison {
  spend: string | null;
  deliveredCount: number | null;
  deliveredCountStatus: "confirmed" | "partial" | null;
  costPerDelivered: string | null;
  reason: string | null;
}

/** A channel comparison only uses explicitly identified origins on both sides. */
export function compareAdvertisingStoreChannel(
  summary: AdvertisingSummaryV11,
  channelId: string,
  currency: string,
  business: AdvertisingBusinessMetrics | undefined,
  storeBusiness: AdvertisingBusinessMetrics | undefined,
): AdvertisingStoreChannelComparison {
  let deliveredCount: number | null = null;
  let deliveredCountStatus: AdvertisingStoreChannelComparison["deliveredCountStatus"] = null;
  const pending = (reason: string): AdvertisingStoreChannelComparison => ({
    spend: null,
    deliveredCount,
    deliveredCountStatus,
    costPerDelivered: null,
    reason,
  });
  if (["all", "none", ""].includes(summary.storeId) || ["all", "none", ""].includes(channelId))
    return pending("Selecciona tienda y canal");
  if (!business) return pending("Entregas pendientes");
  const scopeReason = (data: AdvertisingBusinessMetrics, expectedChannel: string) => {
    if (
      data.source !== "powip-business-metrics" ||
      data.definition !== "delivered-order-grand-total-v1" ||
      data.basis !== "delivered"
    )
      return "Fecha de entrega por confirmar";
    if (
      data.from !== summary.from ||
      data.to !== summary.to ||
      data.storeId !== summary.storeId ||
      data.channelId !== expectedChannel
    )
      return "Periodo, tienda o canal distintos";
    return null;
  };
  const channelScopeReason = scopeReason(business, channelId);
  if (channelScopeReason) return pending(channelScopeReason);
  const matchingOrders = Array.isArray(business.currencies)
    ? business.currencies.filter((row) => row?.currency === currency)
    : [];
  const orders = matchingOrders.length === 1 ? matchingOrders[0] : undefined;
  if (!orders || !Number.isSafeInteger(orders.deliveredCount) || orders.deliveredCount < 0)
    return pending("Entregados por confirmar");
  // A verified channel count remains useful even when the spend cannot be compared.
  deliveredCount = orders.deliveredCount;
  deliveredCountStatus = business.coverage?.complete === true ? "confirmed" : "partial";
  if (business.coverage?.complete !== true) return pending("Entregas por completar");
  if (!storeBusiness) return pending("Entregas de la tienda pendientes");
  const storeScopeReason = scopeReason(storeBusiness, "all");
  if (storeScopeReason) return pending(storeScopeReason);
  if (storeBusiness.coverage?.complete !== true) return pending("Entregas por completar");
  if (
    !Number.isSafeInteger(storeBusiness.unknownChannelCount) ||
    storeBusiness.unknownChannelCount !== 0
  )
    return pending("Hay entregas sin canal confirmado");
  const total = summary.currencies.find((row) => row.currency === currency);
  if (total?.coverage !== "complete" || total.spendSource !== "effective")
    return pending("Gasto por completar");
  const rows = (summary.channelDaily ?? []).filter(
    (row) => row.storeId === summary.storeId && row.currency === currency,
  );
  if (rows.some((row) => row.channelId === null && !/^0+(?:\.0+)?$/.test(row.spend)))
    return pending("Hay gasto sin canal confirmado");
  const selected = rows.filter((row) => row.channelId === channelId);
  if (
    !selected.length ||
    selected.some(
      (row) =>
        row.coverage !== "complete" ||
        row.provisional ||
        row.date < summary.from ||
        row.date > summary.to,
    )
  )
    return pending("Gasto del canal por confirmar");
  const ids = new Set(selected.map((row) => row.accountId));
  const accounts = summary.byAccount.filter((row) => ids.has(row.accountId));
  if (
    accounts.length !== ids.size ||
    accounts.some(
      (row) =>
        row.currency !== currency ||
        row.timeZone !== business.timeZone ||
        row.timeZone !== storeBusiness.timeZone,
    )
  )
    return pending("Moneda o zona horaria distinta");
  if (orders.deliveredCount < 1) return pending("Sin entregados comparables");
  try {
    const spend = sumAdvertisingDecimals(selected.map((row) => row.spend));
    if (spend === null) return pending("Gasto del canal por confirmar");
    const costPerDelivered = divideOrderDecimals(spend, String(orders.deliveredCount));
    return {
      spend,
      deliveredCount: orders.deliveredCount,
      deliveredCountStatus,
      costPerDelivered,
      reason: costPerDelivered === null ? "Importes por revisar" : null,
    };
  } catch {
    return pending("Importes por revisar");
  }
}
