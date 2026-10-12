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
  const pending = (reason: string) => ({ costPerDelivered: null, revenueToSpend: null, reason });
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
  if (spend.coverage !== "complete" || !business.coverage.complete || spend.spend === null)
    return pending("Datos por completar");
  if (
    spend.spendSource !== "effective" ||
    !Array.isArray(spend.timeZones) ||
    spend.timeZones.length !== 1 ||
    spend.timeZones[0] !== business.timeZone
  )
    return pending("Zonas horarias distintas");
  const orders = business.currencies.find((row) => row.currency === spend.currency);
  if (!orders) return pending("Moneda por confirmar");
  if (!Number.isSafeInteger(orders.deliveredCount) || orders.deliveredCount < 1)
    return pending("Sin entregados comparables");
  try {
    return {
      costPerDelivered: divideOrderDecimals(spend.spend, String(orders.deliveredCount)),
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
