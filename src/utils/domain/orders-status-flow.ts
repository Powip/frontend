import { OrderStatus } from "@/interfaces/IOrder";

// Flujo unificado para LIMA y PROVINCIA (mismo flujo para ambas regiones).
// PENDIENTE y PREPARADO ofrecen "En envío"/"Contactado" como atajo directo
// en el <select> manual — el backend solo valida saltos de un paso, así que
// PedidosContent.tsx encadena los estados intermedios en varios PATCH
// (ver STATUS_PROGRESSION/getStatusChainSteps más abajo) para que ese atajo
// funcione sin exponerle la mecánica al usuario.
export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  INCOMPLETE: ["PREVENTA", "PENDIENTE", "ANULADO"],
  PREVENTA: ["PENDIENTE", "ANULADO"],
  PENDIENTE: ["PREPARADO", "LLAMADO", "EN_ENVIO", "ANULADO"],
  PREPARADO: ["LLAMADO", "EN_ENVIO", "ANULADO"],
  LLAMADO: ["ASIGNADO_A_GUIA", "EN_ENVIO", "ENTREGADO", "ANULADO"],
  ASIGNADO_A_GUIA: ["EN_ENVIO", "ANULADO"],
  EN_ENVIO: ["ENTREGADO", "ANULADO"],
  ENTREGADO: ["ANULADO"],
  ANULADO: [],
  // PAGADO no es una etapa de fulfillment: es "PENDIENTE + pagado al 100%"
  // (el backend solo entra a PAGADO desde PENDIENTE al cobrarse el total y
  // vuelve a PENDIENTE si se revierte el pago). Se mantiene espejado al
  // backend, que solo permite el salto directo PAGADO→PREPARADO (+ANULADO).
  // El armado de guía desde PAGADO NO depende de esta tabla: encadena
  // PREPARADO→LLAMADO→ASIGNADO_A_GUIA vía getStatusChainSteps (que usa
  // STATUS_PROGRESSION/FULFILLMENT_RANK, no ORDER_STATUS_FLOW).
  PAGADO: ["PREPARADO", "ANULADO"],
};

/** Etiquetas legibles para mostrar en selects/badges — nunca el enum crudo. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  INCOMPLETE: "Incompleto",
  PREVENTA: "Preventa",
  PENDIENTE: "Pendiente",
  PREPARADO: "Preparado",
  LLAMADO: "Contactado",
  ASIGNADO_A_GUIA: "Asignado a guía",
  EN_ENVIO: "En envío",
  ENTREGADO: "Entregado",
  ANULADO: "Anulado",
  PAGADO: "Pagado",
};

export function getStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABEL[status] ?? status;
}

/**
 * Mapea el pseudo-estado PAGADO a su etapa de fulfillment real (PENDIENTE)
 * para mostrarlo en vistas operativas (Operaciones › Pedidos). En esas
 * tablas la columna "Estado" es la etapa del pedido, no el cobro — el cobro
 * se gestiona en el modal de pagos. El resto de estados pasan sin cambio.
 */
export function toFulfillmentStatus(status: OrderStatus): OrderStatus {
  return status === "PAGADO" ? "PENDIENTE" : status;
}

// Progresión lineal usada solo para calcular los saltos intermedios de los
// atajos "En envío"/"Contactado" desde PENDIENTE o PREPARADO — no reemplaza
// ORDER_STATUS_FLOW, es auxiliar de getStatusChainSteps.
const STATUS_PROGRESSION: OrderStatus[] = ["PENDIENTE", "PREPARADO", "LLAMADO", "EN_ENVIO", "ENTREGADO"];

// Rango del flujo de despacho — incluye ASIGNADO_A_GUIA (que no está en
// STATUS_PROGRESSION porque no es un paso obligado de la cadena) y equipara
// PAGADO con PENDIENTE. Se usa solo para detectar si el `target` ya quedó
// atrás y no hay nada que encadenar: el flujo nunca retrocede de estado.
const FULFILLMENT_RANK: Partial<Record<OrderStatus, number>> = {
  PENDIENTE: 1,
  PAGADO: 1,
  PREPARADO: 2,
  LLAMADO: 3,
  ASIGNADO_A_GUIA: 4,
  EN_ENVIO: 5,
  ENTREGADO: 6,
};

/**
 * Pasos reales (uno por PATCH) para llegar de `current` a `target` sin
 * violar ORDER_STATUS_FLOW del backend. Si el salto no es un avance sobre
 * la progresión lineal (p.ej. ANULADO o ASIGNADO_A_GUIA), devuelve un único
 * paso directo — esos ya son válidos de un solo salto. Si el `target` ya se
 * alcanzó o quedó atrás en el flujo, devuelve `[]` (no se retrocede ni se
 * repite estado).
 */
export function getStatusChainSteps(current: OrderStatus, target: OrderStatus): OrderStatus[] {
  // PAGADO es "PENDIENTE + pagado" — misma etapa operativa. El backend valida
  // la progresión desde PENDIENTE (PAGADO→PREPARADO es salto directo válido),
  // así que se normaliza acá para calcular la cadena.
  const normalizedCurrent = current === "PAGADO" ? "PENDIENTE" : current;

  const currentRank = FULFILLMENT_RANK[normalizedCurrent];
  const targetRank = FULFILLMENT_RANK[target];
  if (
    currentRank !== undefined &&
    targetRank !== undefined &&
    targetRank <= currentRank
  ) {
    return [];
  }

  const from = STATUS_PROGRESSION.indexOf(normalizedCurrent);
  const to = STATUS_PROGRESSION.indexOf(target);
  if (from === -1 || to === -1 || to <= from) return [target];
  return STATUS_PROGRESSION.slice(from + 1, to + 1);
}

/**
 * Obtiene los estados disponibles para una venta según su estado actual.
 * Ahora usa el mismo flujo para LIMA y PROVINCIA.
 *
 * INCOMPLETE nunca se incluye: es el estado de un carrito/venta que no
 * terminó el checkout, no una etapa operativa que se deba poder elegir o
 * ver ofrecida en un selector de cambio de estado.
 */
export function getAvailableStatuses(
  currentStatus: OrderStatus,
  _salesRegion?: "LIMA" | "PROVINCIA" // Se mantiene el parámetro por compatibilidad pero ya no se usa
): OrderStatus[] {
  const validNextStatuses = ORDER_STATUS_FLOW[currentStatus] ?? [];

  // Retorna el estado actual + los estados válidos siguientes
  return [currentStatus, ...validNextStatuses].filter(
    (s) => s !== "INCOMPLETE",
  );
}

const STATUS_PILL_CLASSES: Record<OrderStatus, string> = {
  INCOMPLETE: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  PREVENTA: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  PENDIENTE: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  PREPARADO: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  LLAMADO: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  ASIGNADO_A_GUIA: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
  EN_ENVIO: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30",
  ENTREGADO: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
  ANULADO: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  PAGADO: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
};

/**
 * Clases de color para mostrar el `<select>` de estado como una píldora,
 * en línea con el uso de badges de color en Centro de Envíos.
 */
export function getStatusPillClasses(status: OrderStatus): string {
  return (
    STATUS_PILL_CLASSES[status] ??
    "bg-muted text-muted-foreground border-border"
  );
}

/** Punto de color por estado en saturación sólida — para usar a tamaño de punto (selects, leyendas). */
const STATUS_DOT_CLASSES: Record<OrderStatus, string> = {
  INCOMPLETE: "bg-slate-400",
  PREVENTA: "bg-slate-400",
  PENDIENTE: "bg-amber-500",
  PREPARADO: "bg-blue-500",
  LLAMADO: "bg-violet-500",
  ASIGNADO_A_GUIA: "bg-indigo-500",
  EN_ENVIO: "bg-cyan-500",
  ENTREGADO: "bg-green-500",
  ANULADO: "bg-red-500",
  PAGADO: "bg-teal-500",
};

export function getStatusDotClass(status: OrderStatus): string {
  return STATUS_DOT_CLASSES[status] ?? "bg-muted-foreground";
}
