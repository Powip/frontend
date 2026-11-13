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
