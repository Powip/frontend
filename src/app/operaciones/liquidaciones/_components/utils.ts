import { orderFinancialState } from "@/utils/orderState";
import { OrderHeader } from "@/interfaces/IOrder";
import { COURIER_DIAS_LIMITE, DEFAULT_DIAS_LIMITE, GuiaPorLiquidar } from "./types";

export function money(n: number): string {
  if (!Number.isFinite(n)) return "Por verificar";
  const sign = n < 0 ? "-" : "";
  return `${sign}S/ ${Math.abs(n).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}


/**
 * Heurística best-effort para detectar una entrega parcial ya anotada desde
 * Pedidos, igual de "mejor esfuerzo" que `guessFailureReason` del Tablero
 * (src/app/operaciones/page.tsx). BACKEND GAP: no hay campo estructurado —
 * ver comentario en types.ts sobre `entregaParcial`.
 */
function detectEntregaParcial(
  order: OrderHeader,
): { motivo: string; diferenciaEstimada: number } | null {
  const notes = (order.notes ?? "").toLowerCase();
  if (!notes.includes("parcial") && !notes.includes("diferencia")) return null;
  return {
    motivo: order.notes ?? "Entrega parcial reportada desde Pedidos",
    // BACKEND GAP: no hay monto estructurado de la diferencia, no se puede
    // estimar de forma confiable desde texto libre — se deja en 0 y se
    // señala en la UI que el monto es referencial.
    diferenciaEstimada: 0,
  };
}

/**
 * Construye las filas de "Por Liquidar" a partir de pedidos reales
 * ENTREGADO con courier y saldo pendiente de verificar. La entrega no
 * acredita un cobro ni crea una obligación de liquidación confirmada.
 *
 * @param coveredOrderNumbers orderNumbers ya cubiertos por una liquidación
 *   registrada en esta sesión (estado local, no persiste — ver page.tsx).
 */
export function buildGuiasPorLiquidar(
  orders: OrderHeader[],
  coveredOrderNumbers: Set<string>,
): GuiaPorLiquidar[] {
  return orders
    .filter((o) => o.status === "ENTREGADO" && !!o.courier)
    .map((o) => {
      const codBruto = Number(o.grandTotal || 0);
      const financial = orderFinancialState(o);
      const adelantos = financial.totalPaid;
      const codNeto = financial.pendingAmount;
      const courier = (o.courier ?? "").trim();
      const diasLimite = COURIER_DIAS_LIMITE[courier] ?? DEFAULT_DIAS_LIMITE;
      const saldoPendiente = coveredOrderNumbers.has(o.orderNumber) ? 0 : codNeto;
      const diasTranscurridos = daysSince(o.updated_at ?? o.created_at);
      // No se puede calcular mora de liquidación sin confirmar el cobro.
      const vencido = false;

      return {
        id: o.orderNumber,
        orderId: o.id,
        storeId: o.storeId,
        storeName: o.storeName,
        stockStoreName: o.stockStoreName,
        inventoryId: o.inventoryId,
        stockStoreId: o.stockStoreId,
        cliente: o.customer?.fullName ?? "Sin nombre",
        ciudad: o.customer?.city || o.salesRegion,
        courier,
        entregadoAt: o.updated_at ?? null,
        diasTranscurridos,
        diasLimite,
        codBruto,
        adelantos,
        codNeto,
        saldoPendiente,
        estado: coveredOrderNumbers.has(o.orderNumber) ? "REGISTRO_LOCAL" : "POR_VERIFICAR",
        vencido,
        entregaParcial: detectEntregaParcial(o),
      } satisfies GuiaPorLiquidar;
    })
    .filter((g) => !Number.isFinite(g.saldoPendiente) || g.saldoPendiente > 0 || g.estado === "REGISTRO_LOCAL");
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
