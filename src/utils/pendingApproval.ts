/**
 * FEAT-33 A4/D5: un pago enviado y todavía sin validar no es «saldo». Se informa aparte, con su
 * método («Yape por validar», «Transferencia por validar»), y no cuenta como adelanto hasta que
 * Finanzas lo valida.
 */
interface PendingPayment {
  status?: string;
  amount: string | number;
  paymentMethod?: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  YAPE: "Yape",
  PLIN: "Plin",
  BCP: "BCP",
  BANCO_NACION: "Banco de la Nación",
  MERCADO_PAGO: "Mercado Pago",
  POS: "POS",
  TRANSFERENCIA: "Transferencia",
  EFECTIVO: "Efectivo",
  CONTRAENTREGA: "Contraentrega",
  CONTRA_ENTREGA: "Contraentrega",
};

export interface PendingApprovalSummary {
  amount: number;
  label: string | null;
}

export function pendingApprovalSummary(
  payments?: readonly PendingPayment[] | null,
): PendingApprovalSummary {
  const pending = (payments ?? []).filter(
    (payment) => payment.status === "PENDING",
  );
  if (!pending.length) return { amount: 0, label: null };
  const cents = pending.reduce((sum, payment) => {
    const value = Math.round(Number(payment.amount) * 100);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const methods = new Set(
    pending.map((payment) => (payment.paymentMethod ?? "").toUpperCase()),
  );
  const label =
    methods.size > 1
      ? "Pagos por validar"
      : `${METHOD_LABELS[[...methods][0]] ?? "Pago"} por validar`;
  return { amount: cents / 100, label };
}

/** Punto rojo del botón $: algo por validar (acción de Finanzas) o saldo por cobrar. */
export function paymentAttention({
  awaitingApproval,
  debt,
}: {
  awaitingApproval: number;
  debt: number;
}): "review" | "balance" | null {
  if (awaitingApproval > 0) return "review";
  return debt > 0 ? "balance" : null;
}
