import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { operationalStatus } from "@/utils/orderState";
import { isCommercialLeadOrder, salesPhysicalOperationBlockReason } from "@/utils/commercialOrders";

/** Estados de pedido que participan del ciclo de envío (excluye retiro en tienda por diseño). */
export const SHIPPING_STATUSES: OrderStatus[] = [
  "PREPARADO",
  "LLAMADO",
  "ASIGNADO_A_GUIA",
  "EN_ENVIO",
  "DESPACHADO",
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
  return ["EN_ENVIO", "DESPACHADO"].includes(order.status) && order.shalomStatus === "DEVUELTO";
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

  if (["EN_ENVIO", "DESPACHADO"].includes(order.status)) {
    if (isFailedDelivery(order) || hasCourierSyncError(order)) return "atencion";
    return order.status === "DESPACHADO" ? "camino" : "despachar";
  }

  // La aprobación de guía (EN_ENVIO) sigue pendiente de entrega física al courier.
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

/* -----------------------------------------------------------------------
   Pestañas de /operaciones/pedidos (rediseño)

   El listado y los contadores de la vista salen del servidor
   (`GET /order-header/business/operations`, policy `operations-tabs.policy`
   en ms-ventas). `getOperationsTab` es el espejo en el cliente de esa policy:
   lo usan las pantallas que todavía clasifican en el navegador (Tablero,
   Planificación) para que sus números coincidan con la vista.

   Flujo: preparado → en camino → despachado → entregado. Los pendientes
   no se muestran en esta vista (se preparan desde Ventas).
------------------------------------------------------------------------ */

export type OperationsTabKey =
  | "preparados"
  | "camino"
  | "despachados"
  | "entregados"
  | "anulados"
  | "historial"
  | "atencion";

/** Nombre de la pestaña en el backend. */
export type OperationsServerTabName =
  | "preparados"
  | "en-camino"
  | "despachados"
  | "entregados"
  | "anulados"
  | "historial"
  | "atencion";

export interface OperationsTabDef {
  key: OperationsTabKey;
  serverTab: OperationsServerTabName;
  label: string;
  /** Texto del encabezado de la pestaña activa. */
  description: string;
  /** Entregados, Anulados e Historial: solo los últimos 30 días salvo rango explícito. */
  windowed: boolean;
  /** Se destaca en rojo cuando tiene pedidos. */
  alerta?: boolean;
  /** Clave del contador en la respuesta del servidor. */
  countKey: "preparados" | "enCamino" | "despachados" | "entregados" | "anulados" | "historial" | "atencion";
}

// Orden pedido por Operaciones: los atajos (Entregados, Anulados) antes del combinado (Historial).
export const OPERATIONS_TABS: OperationsTabDef[] = [
  {
    key: "preparados",
    serverTab: "preparados",
    label: "Preparados",
    description:
      "Pedidos listos para asignar a una guía de salida. Al asignar la guía, el pedido cambiará a En camino.",
    windowed: false,
    countKey: "preparados",
  },
  {
    key: "camino",
    serverTab: "en-camino",
    label: "En camino",
    description:
      "Pedidos con guía asignada. Aprueba la guía y entrega el paquete al courier; al escanearlo pasará a Despachados.",
    windowed: false,
    countKey: "enCamino",
  },
  {
    key: "despachados",
    serverTab: "despachados",
    label: "Despachados",
    description:
      "Paquetes ya entregados al courier y en reparto. Confirma la entrega cuando el cliente reciba el pedido.",
    windowed: false,
    countKey: "despachados",
  },
  {
    key: "entregados",
    serverTab: "entregados",
    label: "Entregados",
    description: "Pedidos entregados al cliente, del más reciente al más antiguo.",
    windowed: true,
    countKey: "entregados",
  },
  {
    key: "anulados",
    serverTab: "anulados",
    label: "Anulados",
    description: "Pedidos anulados, con su motivo, del más reciente al más antiguo.",
    windowed: true,
    countKey: "anulados",
  },
  {
    key: "historial",
    serverTab: "historial",
    label: "Historial",
    description: "Pedidos cerrados (entregados y anulados) según la fecha del último cambio de estado.",
    windowed: true,
    countKey: "historial",
  },
  {
    key: "atencion",
    serverTab: "atencion",
    label: "Necesita atención",
    description:
      "Pedidos en camino o despachados con una devolución o un error del courier. Revísalos para resolverlos.",
    windowed: false,
    alerta: true,
    countKey: "atencion",
  },
];

export const DEFAULT_OPERATIONS_TAB: OperationsTabKey = "preparados";
const OPERATIONS_TAB_KEYS = new Set<string>(OPERATIONS_TABS.map((tab) => tab.key));

export const getOperationsTabDef = (key: OperationsTabKey): OperationsTabDef =>
  OPERATIONS_TABS.find((tab) => tab.key === key)!;

/** Filtros rápidos del Tablero que hoy dependen del tracking del courier. */
const TRACKING_QUICK_FILTERS = ["agencia-por-vencer", "por-confirmar"] as const;
export type OperationsTrackingQuickFilter = (typeof TRACKING_QUICK_FILTERS)[number];

/**
 * Compatibilidad de URLs (`?tab=…&qf=…`): `por-despachar` y `despachar` pasan a
 * `preparados`; `pendientes` (ya no existe en esta vista) cae en la pestaña por
 * defecto; el antiguo `camino` con filtros de tracking era DESPACHADO → `despachados`.
 */
export function resolveOperationsTab(
  tab: string | null | undefined,
  qf?: string | null,
): { tab: OperationsTabKey; quick?: OperationsTrackingQuickFilter } {
  if (tab === "camino" && (TRACKING_QUICK_FILTERS as readonly string[]).includes(qf ?? "")) {
    return { tab: "despachados", quick: qf as OperationsTrackingQuickFilter };
  }
  if (tab === "por-despachar" || tab === "despachar" || tab === "pendientes") return { tab: DEFAULT_OPERATIONS_TAB };
  if (tab && OPERATIONS_TAB_KEYS.has(tab)) {
    const quick = (TRACKING_QUICK_FILTERS as readonly string[]).includes(qf ?? "") ? (qf as OperationsTrackingQuickFilter) : undefined;
    return { tab: tab as OperationsTabKey, ...(quick ? { quick } : {}) };
  }
  return { tab: DEFAULT_OPERATIONS_TAB };
}

const OPERATIONS_VISIBLE_STATUSES = new Set<OrderStatus>([
  "PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO", "DESPACHADO", "ENTREGADO", "ANULADO",
]);

/**
 * Pestaña de un pedido (espejo de `operations-tabs.policy` en ms-ventas), o `null`
 * si no se muestra en Operaciones: pendientes/pagados, incompletos, preventas,
 * leads y ventas con stock diferido. Sin ventana de fechas (eso lo decide el servidor).
 */
export function getOperationsTab(order: OrderHeader): OperationsTabKey | null {
  if (isCommercialLeadOrder(order) || !OPERATIONS_VISIBLE_STATUSES.has(order.status)) return null;
  if (order.status === "ENTREGADO") return "entregados";
  if (order.status === "ANULADO") return "anulados";
  if (order.commercialStage === "SALE" && order.commercialStockState === "DEFERRED") return null;
  if (["EN_ENVIO", "DESPACHADO"].includes(order.status) && (isFailedDelivery(order) || hasCourierSyncError(order))) {
    return "atencion";
  }
  if (order.status === "DESPACHADO") return "despachados";
  if (order.status === "EN_ENVIO" || order.status === "ASIGNADO_A_GUIA") return "camino";
  return "preparados";
}
