import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";

/** Estados de pedido que participan del ciclo de envío (excluye retiro en tienda por diseño). */
export const SHIPPING_STATUSES: OrderStatus[] = [
  "PREPARADO",
  "LLAMADO",
  "ASIGNADO_A_GUIA",
  "EN_ENVIO",
  "ENTREGADO",
];

// Mapeo de las 4 pestañas de Pedidos del módulo Operaciones nuevo — las
// mismas del mockup (Por Despachar / En Camino / Necesita Atención /
// Historial). Hubo una versión con una 5ª pestaña "Confirmación" para la
// cola de llamadas pre-despacho; se decidió volver a la estructura del
// mockup y dejar la gestión de llamada solo dentro del modal de pedido
// (tab "Llamada & Promo" de CustomerServiceModal) — no como pestaña propia.
// Un PREPARADO entra a "Por Despachar" sin importar su `callStatus`.
//
// Este archivo es la única fuente de verdad de a qué pestaña pertenece cada
// pedido, para que Pedidos, el Tablero (KPIs/bandeja) y cualquier export
// cuenten exactamente lo mismo.

export type PedidosTabKey = "despachar" | "camino" | "atencion" | "historial";

export interface PedidosTabDef {
  key: PedidosTabKey;
  label: string;
  /** Si aplica, el motivo de alerta (pinta la pestaña en rojo, como "Necesita Atención"). */
  alerta?: boolean;
}

// El ícono de cada pestaña es una preocupación de presentación (lucide-react),
// no de dominio — se define en PedidosContent.tsx, igual que en Guías & Courier.
export const PEDIDOS_TABS: PedidosTabDef[] = [
  { key: "despachar", label: "Por Despachar" },
  { key: "camino", label: "En Camino" },
  { key: "atencion", label: "Necesita Atención", alerta: true },
  { key: "historial", label: "Historial" },
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
  if (order.status === "ENTREGADO" || order.status === "ANULADO") return "historial";

  if (order.status === "EN_ENVIO") {
    if (isFailedDelivery(order) || hasCourierSyncError(order)) return "atencion";
    return "camino";
  }

  // PREPARADO, LLAMADO, ASIGNADO_A_GUIA — y cualquier otro estado previo
  // (PENDIENTE/PAGADO/INCOMPLETE/PREVENTA) como fallback, para no
  // desaparecer un pedido silenciosamente — todos van a "Por Despachar",
  // igual que en el mockup. La gestión de llamada de confirmación se hace
  // desde el modal de pedido, no filtra la pestaña.
  return "despachar";
}

export function countByTab(orders: OrderHeader[]): Record<PedidosTabKey, number> {
  const counts: Record<PedidosTabKey, number> = {
    despachar: 0,
    camino: 0,
    atencion: 0,
    historial: 0,
  };
  for (const order of orders) {
    counts[getPedidosTab(order)] += 1;
  }
  return counts;
}
