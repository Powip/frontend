import type {
  AdvertisingOrderBasis,
  AdvertisingOrderCostKey,
} from "@/services/advertisingOrdersService";
import { formatAdvertisingDecimal } from "./advertising-decimal";

export const ORDER_COST_LABELS: Record<AdvertisingOrderCostKey, string> = {
  productCost: "Productos",
  shippingCost: "Envío",
  channelFee: "Comisión del canal",
  paymentFee: "Comisión del pago",
  otherCost: "Otros costos",
};
export const ORDER_BASIS_LABELS: Record<AdvertisingOrderBasis, string> = {
  created: "Pedido creado",
  delivered: "Pedido entregado",
  paid: "Pedido cobrado",
};
export function formatOrderAmount(amount: string | null, currency: string | null) {
  if (amount === null) return "Pendiente";
  if (currency === null) return "Sin moneda";
  const negative = amount.startsWith("-");
  return `${negative ? "−" : ""}${formatAdvertisingDecimal(negative ? amount.slice(1) : amount, currency)}`;
}
export function formatOrderTimestamp(value: string | null, timeZone = "America/Lima") {
  if (!value) return "Sin fecha confirmada";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
export function financeInputValue(value: string) {
  return value.trim() === "" ? null : value.trim();
}
export function validFinanceInput(value: string) {
  return value.trim() === "" || /^\d{1,10}(?:\.\d{1,2})?$/.test(value.trim());
}
