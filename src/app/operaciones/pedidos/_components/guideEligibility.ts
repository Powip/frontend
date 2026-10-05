import type { OrderStatus } from "@/interfaces/IOrder";
import { DELIVERY_TYPE_OPTIONS } from "@/constants/operationsDomain";
import { getStatusLabel } from "@/utils/domain/orders-status-flow";
import type { Sale } from "./types";

/**
 * Elegibilidad para armar guía desde Por Despachar. La regla es la de
 * siempre (sin guía + DOMICILIO + estado permitido); este módulo solo
 * agrega el *motivo* por el que un pedido queda afuera, para que la UI no
 * descarte pedidos en silencio.
 */

// ORDER_STATUS_FLOW (orders-status-flow.ts) solo permite saltar a
// ASIGNADO_A_GUIA desde LLAMADO — un PREPARADO puede armar guía igual: los
// handlers de creación de guía (PedidosContent.tsx) encadenan el/los
// paso(s) intermedio(s) a LLAMADO de forma transparente antes de asignar la
// guía. PAGADO (cobrado al 100% pero todavía no empacado por almacén) queda
// afuera a propósito — cobrar no es preparar, así que ni siquiera se lista
// en esta pestaña (ver PRE_FULFILLMENT_STATUSES en operations-pedidos-tabs.ts).
export const GUIDE_ELIGIBLE_STATUSES: OrderStatus[] = [
  "PREPARADO",
  "LLAMADO",
  "ASIGNADO_A_GUIA",
];

export type GuideBlockReason =
  | "HAS_GUIDE"
  | "STATUS_NOT_ALLOWED"
  | "PICKUP_IN_STORE"
  | "MISSING_DELIVERY_TYPE"
  | "UNSUPPORTED_DELIVERY_TYPE";

export interface BlockedGuideSale {
  sale: Sale;
  reason: GuideBlockReason;
}

/** `mapOrderToSale` reemplaza "_" por " " ("RETIRO TIENDA") — se vuelve al
 *  valor del enum para comparar. */
export function normalizeDeliveryType(value?: string | null): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

export function deliveryTypeLabel(value?: string | null): string {
  const normalized = normalizeDeliveryType(value);
  if (!normalized) return "Sin tipo de entrega";
  return (
    DELIVERY_TYPE_OPTIONS.find((o) => o.value === normalized)?.label ??
    normalized
  );
}

/** `null` = elegible. El orden solo decide qué motivo se muestra cuando hay
 *  varios: estado y guía primero, porque editar la entrega no los resuelve. */
export function getGuideBlockReason(sale: Sale): GuideBlockReason | null {
  if (sale.guideNumber) return "HAS_GUIDE";
  if (!GUIDE_ELIGIBLE_STATUSES.includes(sale.status))
    return "STATUS_NOT_ALLOWED";
  if ((sale.deliveryType ?? "").toUpperCase() === "DOMICILIO") return null;
  const normalized = normalizeDeliveryType(sale.deliveryType);
  if (normalized === "RETIRO_TIENDA") return "PICKUP_IN_STORE";
  if (!normalized) return "MISSING_DELIVERY_TYPE";
  return "UNSUPPORTED_DELIVERY_TYPE";
}

export function guideBlockReasonLabel(
  reason: GuideBlockReason,
  sale: Sale,
): string {
  switch (reason) {
    case "HAS_GUIDE":
      return `Ya tiene la guía ${sale.guideNumber}`;
    case "STATUS_NOT_ALLOWED":
      return `Estado «${getStatusLabel(sale.status)}» no permite generar guía`;
    case "PICKUP_IN_STORE":
      return "Configurado como retiro en tienda";
    case "MISSING_DELIVERY_TYPE":
      return "No tiene tipo de entrega configurado";
    case "UNSUPPORTED_DELIVERY_TYPE":
      return `Tipo de entrega «${deliveryTypeLabel(sale.deliveryType)}» no admite guía`;
  }
}

export function splitGuideEligibility(sales: Sale[]): {
  eligible: Sale[];
  blocked: BlockedGuideSale[];
} {
  const eligible: Sale[] = [];
  const blocked: BlockedGuideSale[] = [];
  for (const sale of sales) {
    const reason = getGuideBlockReason(sale);
    if (reason) blocked.push({ sale, reason });
    else eligible.push(sale);
  }
  return { eligible, blocked };
}
