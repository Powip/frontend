type Money = number | string | null | undefined;

/** Forma mínima de un pedido para calcular su saldo en una guía de despacho. */
export interface GuideBalanceOrder {
  grandTotal?: Money;
  totals?: { grandTotal?: Money } | null;
  payments?: ReadonlyArray<{ amount: Money; status: string }> | null;
}

export interface GuideOrderBalance {
  total: number;
  /** Adelantos aprobados (PAID): lo único que el courier NO debe cobrar. */
  paid: number;
  /** Adelantos registrados pero aún sin aprobar (PENDING), acotado al saldo. */
  awaitingApproval: number;
  /** Lo que el courier cobra hoy: total − aprobado. Un adelanto sin aprobar no resta. */
  pending: number;
  /** Lo que quedaría por cobrar si se aprobaran los adelantos pendientes. */
  pendingAfterApproval: number;
}

// Se opera en centavos enteros: restar decimales en coma flotante deja residuos
// (100.01 − (29.94 + 70.07) = 1.4e-14) que marcarían un pedido pagado como "por cobrar".
const minorOf = (value: Money) => Math.round((Number(value ?? 0) || 0) * 100);

const sumByStatusMinor = (order: GuideBalanceOrder, status: string) =>
  (order.payments ?? [])
    .filter((payment) => payment.status === status)
    .reduce((sum, payment) => sum + minorOf(payment.amount), 0);

/**
 * Saldo de un pedido dentro de una guía de despacho.
 *
 * Fuente única para la guía impresa, el panel de cobranza de "Ver guía", el
 * texto copiado y el Excel. El backend solo maneja PENDING / PAID / LOST: un
 * pago PENDING es un adelanto sin aprobar y por eso no reduce el cobro del
 * courier (si el comprobante fuera falso, el negocio perdería ese dinero),
 * pero se informa aparte para que nadie despache sin saberlo.
 */
export function guideOrderBalance(order: GuideBalanceOrder): GuideOrderBalance {
  const total = minorOf(order.totals?.grandTotal ?? order.grandTotal);
  const paid = sumByStatusMinor(order, "PAID");
  const pending = Math.max(total - paid, 0);
  const awaitingApproval = Math.min(sumByStatusMinor(order, "PENDING"), pending);
  return {
    total: total / 100,
    paid: paid / 100,
    awaitingApproval: awaitingApproval / 100,
    pending: pending / 100,
    pendingAfterApproval: (pending - awaitingApproval) / 100,
  };
}

/** Un pedido con adelanto sin aprobar, listo para mostrarse en el aviso previo al despacho. */
export interface AdvanceRow {
  id: string;
  orderNumber: string;
  /** Adelanto registrado pero aún sin aprobar (pago PENDING). */
  awaitingApproval: number;
  /** Lo que cobraría el courier hoy: el adelanto sin aprobar no resta. */
  pending: number;
}

/** Pedidos con pagos completos (recibos o listas del backend): filas solo de los que tienen un adelanto sin aprobar. */
export function advancesAwaitingApproval(
  orders: ReadonlyArray<GuideBalanceOrder & { id: string; orderNumber?: string | null }>,
): AdvanceRow[] {
  return orders.flatMap((order) => {
    const { awaitingApproval, pending } = guideOrderBalance(order);
    return awaitingApproval > 0
      ? [{ id: order.id, orderNumber: order.orderNumber ?? order.id, awaitingApproval, pending }]
      : [];
  });
}

/** Ventas de las pantallas de Ventas y Pedidos: ya traen los montos calculados con guideOrderBalance. */
export function advanceRowsFromSales(
  sales: ReadonlyArray<{
    id: string;
    orderNumber?: string | null;
    awaitingApprovalAmount?: number;
    collectAmount?: number;
  }>,
): AdvanceRow[] {
  return sales.flatMap((sale) =>
    (sale.awaitingApprovalAmount ?? 0) > 0
      ? [{
          id: sale.id,
          orderNumber: sale.orderNumber ?? sale.id,
          awaitingApproval: sale.awaitingApprovalAmount ?? 0,
          pending: sale.collectAmount ?? 0,
        }]
      : [],
  );
}
