interface ReceiptPaymentLike {
  amount?: number | string | null;
  status?: string | null;
}

interface ReceiptTotalsLike {
  grandTotal?: number | string | null;
  totalPaid?: number | string | null;
  totalPendingApproval?: number | string | null;
}

export interface CustomerReceiptBalance {
  grandTotal: number;
  confirmedAdvance: number;
  pendingAdvance: number;
  registeredAdvance: number;
  amountToCollect: number;
}

function nonNegativeAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
}

/**
 * Saldo que se comunica al cliente en notas de venta y etiquetas.
 *
 * Un adelanto PENDING todavía no es dinero confirmado para Finanzas, pero sí
 * fue registrado por el cliente. Por eso se descuenta del monto que el
 * documento le presenta como "por cobrar" y se rotula como pendiente de
 * validación. La deuda contable/operativa continúa usando `totals.pendingAmount`
 * del backend, que solo descuenta pagos PAID.
 */
export function getCustomerReceiptBalance(
  totals: ReceiptTotalsLike,
  payments: ReceiptPaymentLike[] = [],
): CustomerReceiptBalance {
  const grandTotal = nonNegativeAmount(totals.grandTotal);
  const confirmedAdvance = nonNegativeAmount(totals.totalPaid);
  const pendingFromPayments = payments
    .filter((payment) => payment.status === "PENDING")
    .reduce((sum, payment) => sum + nonNegativeAmount(payment.amount), 0);
  const pendingAdvance =
    totals.totalPendingApproval === undefined ||
    totals.totalPendingApproval === null
      ? pendingFromPayments
      : nonNegativeAmount(totals.totalPendingApproval);
  const registeredAdvance = confirmedAdvance + pendingAdvance;

  return {
    grandTotal,
    confirmedAdvance,
    pendingAdvance,
    registeredAdvance,
    amountToCollect: Math.max(grandTotal - registeredAdvance, 0),
  };
}
