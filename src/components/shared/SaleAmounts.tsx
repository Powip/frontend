import { formatSalesMoney } from "@/utils/salesMoney";
import type { PendingApprovalSummary } from "@/utils/pendingApproval";
import { FinancialStatusBadge } from "./FinancialStatusBadge";

/** FEAT-33 A4: Total · Adel (solo validado) · «Yape por validar» en morado · Debe, y la etiqueta. */
export function SaleAmounts({
  total,
  advancePayment,
  pendingPayment,
  awaitingApproval,
  status,
  currency,
}: {
  total: number;
  advancePayment: number;
  pendingPayment: number;
  awaitingApproval: PendingApprovalSummary;
  status?: string;
  currency?: string | null;
}) {
  const reviewing = awaitingApproval.amount > 0;
  return (
    <>
      <div className="font-semibold">{formatSalesMoney(total, currency)}</div>
      <div className="text-green-600">
        Adel: {formatSalesMoney(advancePayment, currency)}
      </div>
      {reviewing ? (
        <div className="text-purple-700 dark:text-purple-300">
          {awaitingApproval.label ?? "Pago por validar"}:{" "}
          {formatSalesMoney(awaitingApproval.amount, currency)}
        </div>
      ) : null}
      <div className="text-red-600">
        Debe: {formatSalesMoney(pendingPayment, currency)}
      </div>
      {reviewing ? (
        <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300">
          Por validar
        </span>
      ) : (
        <FinancialStatusBadge pendingAmount={pendingPayment} status={status} />
      )}
    </>
  );
}
