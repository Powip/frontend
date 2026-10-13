import type { AdvertisingBusinessMetrics } from "@/services/advertisingBusinessMetricsService";
import type {
  AdvertisingSummaryCurrencyV11,
  AdvertisingSummaryV11,
} from "@/services/advertisingV11Service";
import { divideOrderDecimals } from "./advertising-business-results";

export function compareAdvertisingBusinessCurrency(
  summary: AdvertisingSummaryV11,
  spend: AdvertisingSummaryCurrencyV11,
  business: AdvertisingBusinessMetrics | undefined,
  accountSelected = false,
) {
  const pending = (
    reason: string,
  ): {
    costPerDelivered: string | null;
    revenueToSpend: string | null;
    reason: string | null;
    revenueReason?: string;
  } => ({ costPerDelivered: null, revenueToSpend: null, reason });
  if (!business) return pending("Pedidos pendientes");
  if (summary.storeId === "none") return pending("Gasto sin asignar");
  if (accountSelected) return pending("Pedidos de la cuenta por confirmar");
  if (
    business.source !== "powip-business-metrics" ||
    business.definition !== "delivered-order-grand-total-v1" ||
    business.basis !== "delivered"
  )
    return pending("Fecha de entrega por confirmar");
  if (
    summary.from !== business.from ||
    summary.to !== business.to ||
    summary.storeId !== business.storeId ||
    business.channelId !== "all"
  )
    return pending("Periodos o tiendas distintos");
  const countCoverage = business.countCoverage ?? { ...business.coverage, basis: business.basis };
  if (countCoverage.basis !== business.basis || !countCoverage.complete)
    return pending(
      countCoverage.reasons.includes("missing-delivery-date")
        ? "Hay entregados sin fecha confirmada"
        : "Conteo de entregas por confirmar",
    );
  if (spend.coverage !== "complete" || spend.spend === null)
    return pending("Gasto incompleto o provisional");
  if (
    spend.spendSource !== "effective" ||
    !Array.isArray(spend.timeZones) ||
    spend.timeZones.length !== 1 ||
    spend.timeZones[0] !== business.timeZone
  )
    return pending("Zonas horarias distintas");
  const orders = business.currencies.find((row) => row.currency === spend.currency);
  // A single-currency business expense may be divided by its confirmed order volume.
  // Currency remains mandatory for revenue ratios, not for counting orders.
  const useBusinessVolume = Boolean(business.countCoverage && summary.currencies.length === 1);
  const deliveredCount = useBusinessVolume ? business.deliveredCount : orders?.deliveredCount;
  if (!useBusinessVolume && !orders) return pending("Moneda por confirmar");
  if (
    typeof deliveredCount !== "number" ||
    !Number.isSafeInteger(deliveredCount) ||
    deliveredCount < 1
  )
    return pending("Sin entregados comparables");
  try {
    const costPerDelivered = divideOrderDecimals(spend.spend, String(deliveredCount));
    const revenueCoverage = business.revenueCoverage ?? {
      ...business.coverage,
      basis: business.basis,
    };
    if (revenueCoverage.basis !== business.basis || !revenueCoverage.complete || !orders)
      return {
        costPerDelivered,
        revenueToSpend: null,
        reason: null,
        revenueReason: "Venta con moneda por confirmar",
      };
    return {
      costPerDelivered,
      revenueToSpend: divideOrderDecimals(orders.deliveredRevenue, spend.spend, 2),
      reason: null,
    };
  } catch {
    return pending("Importes por revisar");
  }
}

export function formatAdvertisingMetric(value: string | null | undefined, suffix = "") {
  if (!value || value.length > 1024 || !/^\d+(?:\.\d+)?$/.test(value)) return "Pendiente";
  const [whole, fraction = ""] = value.split(".");
  return `${new Intl.NumberFormat("es-PE").format(BigInt(whole))}${fraction ? `.${fraction.slice(0, 2)}` : ""}${suffix}`;
}
