import type { OrderStatus } from "@/interfaces/IOrder";

/**
 * Estados en los que el pedido ya pasó LLAMADO. Si todavía guarda una
 * programación (callStatus SCHEDULED + callbackAt) es un resto: el cron de
 * ms-ventas (order-scheduled-tasks) a estos estados solo les limpia la
 * programación vencida, sin tocar el estado. Mantener ambas listas alineadas.
 */
const STATUSES_PAST_CALL: readonly OrderStatus[] = [
  "ASIGNADO_A_GUIA",
  "EN_ENVIO",
  "DESPACHADO",
  "ENTREGADO",
  "ANULADO",
];

interface ReprogramadoInput {
  status: OrderStatus;
  callStatus?: "PENDING" | "NO_ANSWER" | "CONFIRMED" | "SCHEDULED" | null;
  callbackAt?: string | null;
}

/** ¿Se muestra el chip "🔁 fecha" (pedido reprogramado y aún por despachar)? */
export function shouldShowReprogramado(sale: ReprogramadoInput): boolean {
  if (sale.callStatus !== "SCHEDULED" || !sale.callbackAt) return false;
  return !STATUSES_PAST_CALL.includes(sale.status);
}
