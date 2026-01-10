import { OrderStatus } from "@/interfaces/IOrder";

// Flujo unificado para LIMA y PROVINCIA (mismo flujo para ambas regiones)
export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDIENTE: ["PREPARADO", "ANULADO"],
  PREPARADO: ["LLAMADO", "ANULADO"],
  LLAMADO: ["ASIGNADO_A_GUIA", "EN_ENVIO", "ANULADO"],
  ASIGNADO_A_GUIA: ["EN_ENVIO", "ANULADO"],
  EN_ENVIO: ["ENTREGADO", "ANULADO"],
  ENTREGADO: [],
  ANULADO: [],
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
