import { financialStateFromAmounts, collectionLabel } from "@/utils/orderState";

export function FinancialStatusBadge({ pendingAmount, status }: { pendingAmount: number; status?: string }) {
  const { isPaid } = financialStateFromAmounts(pendingAmount, 0);
  const label = collectionLabel(pendingAmount, status);
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isPaid ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"}`}>{label}</span>;
}
