import { OrderStatus } from "@/interfaces/IOrder";

// Flujo unificado para LIMA y PROVINCIA (mismo flujo para ambas regiones)
export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  INCOMPLETE: ["PREVENTA", "PENDIENTE", "ANULADO"],
  PREVENTA: ["PENDIENTE", "ANULADO"],
  PENDIENTE: ["PREPARADO", "ANULADO"],
  PREPARADO: ["LLAMADO", "ANULADO"],
  LLAMADO: ["ASIGNADO_A_GUIA", "EN_ENVIO", "ENTREGADO", "ANULADO"],
  ASIGNADO_A_GUIA: ["EN_ENVIO", "ANULADO"],
  EN_ENVIO: ["ENTREGADO", "ANULADO"],
  ENTREGADO: ["ANULADO"],
  ANULADO: [],
  PAGADO: ["ANULADO"],
};

/**
 * Obtiene los estados disponibles para una venta según su estado actual.
 * Ahora usa el mismo flujo para LIMA y PROVINCIA.
 */
export function getAvailableStatuses(
  currentStatus: OrderStatus,
  _salesRegion?: "LIMA" | "PROVINCIA" // Se mantiene el parámetro por compatibilidad pero ya no se usa
): OrderStatus[] {
  const validNextStatuses = ORDER_STATUS_FLOW[currentStatus] ?? [];

  // Retorna el estado actual + los estados válidos siguientes
  return [currentStatus, ...validNextStatuses];
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
