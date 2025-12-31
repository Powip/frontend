import { OrderStatus } from "@/interfaces/IOrder";

// Flujo estándar para LIMA
export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDIENTE: ["PREPARADO", "ANULADO"],
  PREPARADO: ["LLAMADO", "ANULADO"],
  LLAMADO: ["EN_ENVIO", "ANULADO"],
  EN_ENVIO: ["ENTREGADO", "ANULADO"],
  ENTREGADO: [],
  ANULADO: [],
};

// Flujo para PROVINCIA (salta PREPARADO y LLAMADO)
export const ORDER_STATUS_FLOW_PROVINCIA: Record<OrderStatus, OrderStatus[]> = {
  PENDIENTE: ["EN_ENVIO", "ANULADO"],
  PREPARADO: ["EN_ENVIO", "ANULADO"], // Por si acaso
  LLAMADO: ["EN_ENVIO", "ANULADO"],   // Por si acaso
  EN_ENVIO: ["ENTREGADO", "ANULADO"],
  ENTREGADO: [],
  ANULADO: [],
};

/**
 * Obtiene los estados disponibles para una venta según su estado actual y región.
 * Para PROVINCIA, solo muestra: estado actual + estados válidos siguientes
 * Para LIMA, muestra todos los estados pero resalta los válidos
 */
export function getAvailableStatuses(
  currentStatus: OrderStatus,
  salesRegion: "LIMA" | "PROVINCIA"
): OrderStatus[] {
  const flow = salesRegion === "PROVINCIA" 
    ? ORDER_STATUS_FLOW_PROVINCIA 
    : ORDER_STATUS_FLOW;
  
  const validNextStatuses = flow[currentStatus] ?? [];
  
  // Retorna el estado actual + los estados válidos siguientes
  return [currentStatus, ...validNextStatuses];
}
