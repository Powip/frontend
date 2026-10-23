import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { operationalStatus } from "@/utils/orderState";
import { isCommercialLeadOrder, salesPhysicalOperationBlockReason } from "@/utils/commercialOrders";

/** Estados de pedido que participan del ciclo de envío (excluye retiro en tienda por diseño). */
export const SHIPPING_STATUSES: OrderStatus[] = [
  "PREPARADO",
  "LLAMADO",
  "ASIGNADO_A_GUIA",
  "EN_ENVIO",
  "ENTREGADO",
];

// Las colas operativas separan preparación, despacho, tránsito y cierre.
// El pago es una dimensión independiente y nunca decide la pestaña.

export type PedidosTabKey = "pendientes" | "despachar" | "camino" | "atencion" | "historial" | "anulados";

/** Confirmed purchases enter Operations before preparation, regardless of their payment balance. */
export function isOperationsOrderVisible(order: OrderHeader): boolean {
  if (["INCOMPLETE", "PREVENTA"].includes(order.status) || isCommercialLeadOrder(order)) return false;
  if (order.commercialStage === "SALE" && order.commercialStockState === "DEFERRED") return true;
  return !salesPhysicalOperationBlockReason(order);
}

/** Etapas que todavía no pueden entrar en planificación de guías ni en el escáner de despacho. */
export const PRE_FULFILLMENT_STATUSES: OrderStatus[] = [
  "INCOMPLETE",
  "PREVENTA",
  "PENDIENTE",
  "PAGADO",
];

export interface PedidosTabDef {
  key: PedidosTabKey;
  label: string;
  /** Si aplica, el motivo de alerta (pinta la pestaña en rojo, como "Necesita Atención"). */
  alerta?: boolean;
}

// El ícono de cada pestaña es una preocupación de presentación (lucide-react),
// no de dominio — se define en PedidosContent.tsx, igual que en Guías & Courier.
export const PEDIDOS_TABS: PedidosTabDef[] = [
  { key: "pendientes", label: "Pendientes" },
  { key: "despachar", label: "Por Despachar" },
  { key: "camino", label: "En Camino" },
  { key: "atencion", label: "Necesita Atención", alerta: true },
  { key: "historial", label: "Historial" },
  { key: "anulados", label: "Anulados" },
];

/** Pedido fallido en tránsito: mismo criterio que ya usan Centro de Envíos y Seguimiento hoy. */
export function isFailedDelivery(order: OrderHeader): boolean {
  return order.status === "EN_ENVIO" && order.shalomStatus === "DEVUELTO";
}

export function hasCourierSyncError(order: OrderHeader): boolean {
  return (
    !!order.shalomError ||
    !!(order.syncErrors && Object.keys(order.syncErrors).length > 0)
  );
}

/**
 * ¿Está reprogramada la ENTREGA para hoy? (reprogramación de courier/despacho
 * — distinto del `callStatus === "SCHEDULED"`, que es reprogramación de
 * LLAMADA y hoy solo se gestiona dentro del modal de pedido).
 *
 * NOTA: no existe hoy un campo estructurado de "fecha de entrega
 * reprogramada" separado de `callbackAt` — este helper asume que, una vez
 * que el pedido pasa por Necesita Atención y se reprograma la entrega, se
 * reutiliza `callbackAt` para guardar esa fecha. Confirmar/crear el campo
 * dedicado es parte de las brechas de backend.
 */
export function isDeliveryRescheduledForToday(order: OrderHeader): boolean {
  if (!order.callbackAt) return false;
  const today = new Date();
  const cb = new Date(order.callbackAt);
  return (
    cb.getFullYear() === today.getFullYear() &&
    cb.getMonth() === today.getMonth() &&
    cb.getDate() === today.getDate()
  );
}

export function getPedidosTab(order: OrderHeader): PedidosTabKey {
  if (order.status === "ANULADO") return "anulados";
  if (order.status === "ENTREGADO") return "historial";
  if (operationalStatus(order.status) === "PENDIENTE" || (order.commercialStage === "SALE" && order.commercialStockState === "DEFERRED")) return "pendientes";

  if (order.status === "EN_ENVIO") {
    if (isFailedDelivery(order) || hasCourierSyncError(order)) return "atencion";
    return "camino";
  }

  // PREPARADO, LLAMADO y ASIGNADO_A_GUIA están listos para despacho.
  return "despachar";
}

export function countByTab(orders: OrderHeader[]): Record<PedidosTabKey, number> {
  const counts: Record<PedidosTabKey, number> = {
    pendientes: 0,
    despachar: 0,
    camino: 0,
    atencion: 0,
    historial: 0,
    anulados: 0,
  };
  for (const order of orders) {
    counts[getPedidosTab(order)] += 1;
  }
  return counts;
}
