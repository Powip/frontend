import type { OrderStatus } from "@/interfaces/IOrder";

/** PAGADO is a legacy payment projection, never proof that the package is prepared. */
export function operationalStatus(status: OrderStatus): OrderStatus {
  return status === "PAGADO" ? "PENDIENTE" : status;
}

interface FinancialPayment { status?: string; amount: string | number }
interface FinancialOrder { grandTotal: string | number; payments?: readonly FinancialPayment[] }
const moneyMinor = (value: unknown): number => {
  if (typeof value !== "number" && typeof value !== "string") return Number.NaN;
  const raw = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return Number.NaN;
  const [whole, fraction = ""] = raw.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : Number.NaN;
};

function financialStateFromMinor(totalMinor: number, approvedPaidMinor: number) {
  const approvedPaid = approvedPaidMinor / 100;
  if (!Number.isSafeInteger(totalMinor) || !Number.isSafeInteger(approvedPaidMinor))
    return { totalPaid: approvedPaid, pendingAmount: Number.NaN, isPaid: false, label: "Pago por verificar" };
  const pendingAmount = Math.max(0, totalMinor - approvedPaidMinor) / 100;
  return { totalPaid: approvedPaid, pendingAmount, isPaid: pendingAmount === 0, label: pendingAmount === 0 ? "Pagado" : "Con saldo" };
}

export function financialStateFromAmounts(total: number, approvedPaid: number) {
  return financialStateFromMinor(moneyMinor(total), moneyMinor(approvedPaid));
}

export function orderFinancialState(order: FinancialOrder) {
  const approvedPaidMinor = order.payments?.reduce(
    (sum, payment) => payment.status === "PAID" ? sum + moneyMinor(payment.amount) : sum, 0,
  );
  return financialStateFromMinor(moneyMinor(order.grandTotal), approvedPaidMinor === undefined ? Number.NaN : approvedPaidMinor);
}

/** Receipt totals.totalPaid is the server's approved-payment total. */
export function receiptFinancialState(receipt: { totals: { grandTotal: number; totalPaid?: number }; payments?: readonly FinancialPayment[] }) {
  return typeof receipt.totals.totalPaid === "number" && Number.isFinite(receipt.totals.totalPaid)
    ? financialStateFromAmounts(receipt.totals.grandTotal, receipt.totals.totalPaid)
    : orderFinancialState({ grandTotal: receipt.totals.grandTotal, payments: receipt.payments });
}

export function deliveryPaymentBlockReason(pendingAmount: number, targetStatus: string): string | null {
  return targetStatus === "ENTREGADO" && (!Number.isFinite(pendingAmount) || pendingAmount > 0)
    ? "Verifica y aprueba el pago del saldo pendiente antes de entregar el pedido."
    : null;
}
