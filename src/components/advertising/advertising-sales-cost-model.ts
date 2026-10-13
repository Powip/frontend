import type { AdvertisingBusinessMetrics } from "@/services/advertisingBusinessMetricsService";
import type { AdvertisingSummaryV11 } from "@/services/advertisingV11Service";
import { divideOrderDecimals } from "./advertising-business-results";

/** Business volume ratio, never an attribution of every order to a specific ad or account. */
export function advertisingSalesCost(
  summary: AdvertisingSummaryV11 | undefined,
  business: AdvertisingBusinessMetrics | undefined,
) {
  const pending = (reason: string) => ({ cost: null, currency: null, reason });
  if (!business) return pending("Faltan los pedidos del periodo.");
  if (!summary) return pending("Falta cargar la inversión.");
  if (summary.storeId === "none") return pending("Asigna el gasto a una tienda.");
  if (
    business.source !== "powip-business-metrics" ||
    business.definition !== "delivered-order-grand-total-v1" ||
    !["created", "delivered"].includes(business.basis) ||
    summary.from !== business.from ||
    summary.to !== business.to ||
    summary.storeId !== business.storeId ||
    business.channelId !== "all"
  )
    return pending("La inversión y los pedidos deben tener el mismo periodo y tienda.");
  const coverage = business.countCoverage ?? { ...business.coverage, basis: business.basis };
  if (coverage.basis !== business.basis || !coverage.complete)
    return pending(
      business.basis === "delivered" && coverage.reasons.includes("missing-delivery-date")
        ? "Hay entregas sin fecha confirmada. Puedes consultar pedidos registrados."
        : "Falta confirmar el conteo de pedidos.",
    );
  if (summary.currencies.length !== 1)
    return pending(
      summary.currencies.length
        ? "La inversión tiene varias monedas; no se suman sin conversión."
        : "No hay inversión disponible para esta tienda y periodo.",
    );
  const spend = summary.currencies[0];
  if (spend.spendSource !== "effective" || spend.coverage !== "complete" || spend.spend === null)
    return pending("La inversión está incompleta o incluye días provisionales.");
  if (spend.timeZones.length !== 1 || spend.timeZones[0] !== business.timeZone)
    return pending("La inversión y los pedidos usan zonas horarias distintas.");
  const count = business.basis === "created" ? business.totalOrders : business.deliveredCount;
  if (!Number.isSafeInteger(count) || count < 0)
    return pending("Falta confirmar el conteo de pedidos.");
  if (count === 0)
    return pending(business.basis === "created" ? "Sin pedidos registrados." : "Sin entregas.");
  try {
    const cost = divideOrderDecimals(spend.spend, String(count));
    return {
      cost,
      currency: spend.currency,
      reason: cost === null ? "Importes por revisar." : null,
    };
  } catch {
    return pending("Importes por revisar.");
  }
}

export function advertisingClosedPeriod(from: string, to: string, now = new Date()) {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => dateParts.find((value) => value.type === type)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const closedTo = yesterday.toISOString().slice(0, 10);
  return to > closedTo && from <= closedTo ? { from, to: closedTo } : null;
}
