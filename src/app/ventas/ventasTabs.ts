import type { OrderStatus } from "@/interfaces/IOrder";
import {
  type DateWindow,
  isInPeruWindow,
  peruDateOf,
  shiftPeruDate,
} from "@/lib/peruDate";

export const VENTAS_RECENT_DAYS = 30;

/** Primer día (inclusive) de los pendientes recientes: hoy − 29. */
export function ventasRecentFrom(today: string): string {
  return shiftPeruDate(today, -(VENTAS_RECENT_DAYS - 1));
}

/** Último día (inclusive) de los pendientes antiguos: hoy − 30. */
export function ventasAntiguosTo(today: string): string {
  return shiftPeruDate(today, -VENTAS_RECENT_DAYS);
}

export interface VentasTabSale {
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

// PAGADO es "PENDIENTE ya cobrado al 100%", no una etapa de fulfillment
// distinta (ver ORDER_STATUS_FLOW/FULFILLMENT_RANK en orders-status-flow.ts,
// donde PAGADO comparte rango con PENDIENTE) — debe listarse junto con
// PENDIENTE en "Ventas Pendientes", si no la tab queda en 0 apenas se cobra
// un pedido y solo se lo ve en "Todas las Ventas".
export const isPendienteStatus = (status: OrderStatus) => status === "PENDIENTE" || status === "PAGADO";

/** Días de Perú sin movimiento (hoy − updatedAt), mínimo 0. */
export function daysWithoutMovement(updatedAt: string, today: string): number {
  const [y1, m1, d1] = peruDateOf(updatedAt).split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  const diff = (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000;
  return Math.max(0, Math.round(diff));
}

/** Reparte la lista unida en las pestañas de Ventas, devolviendo las mismas referencias. */
export function splitVentasTabs<T extends VentasTabSale>(
  sales: T[],
  o: { today: string; anuladasWindow: DateWindow; todasWindow: DateWindow },
): { pendientes: T[]; antiguos: T[]; anulados: T[]; todas: T[] } {
  const recentFrom = ventasRecentFrom(o.today);
  const pendientes: T[] = [];
  const antiguos: T[] = [];
  const anulados: T[] = [];
  const todas: T[] = [];

  for (const s of sales) {
    if (isPendienteStatus(s.status)) {
      if (peruDateOf(s.createdAt) >= recentFrom) pendientes.push(s);
      else antiguos.push(s);
    }
    if (s.status === "ANULADO" && isInPeruWindow(s.createdAt, o.anuladasWindow)) {
      anulados.push(s);
    }
    if (s.status !== "INCOMPLETE" && isInPeruWindow(s.createdAt, o.todasWindow)) {
      todas.push(s);
    }
  }

  antiguos.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  return { pendientes, antiguos, anulados, todas };
}
