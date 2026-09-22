import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PARTNER_PLAN_OPTIONS } from "@/features/partners/models/plan-option";
import {
  estimateFirstMonthCommission,
  estimateRecurringCommission,
} from "@/features/partners/utils/estimate-commission-earnings";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { CommissionOptionDetail } from "@/features/partners/models/commission-option-detail";

interface CommissionComparisonTableProps {
  options: CommissionOptionDetail[] | undefined;
  isLoading: boolean;
  discountPct: number;
}

export function CommissionComparisonTable({
  options,
  isLoading,
  discountPct,
}: CommissionComparisonTableProps) {
  if (isLoading || !options) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Plan</TableHead>
          <TableHead>Precio/mes</TableHead>
          {options.map((option) => (
            <TableHead key={option.code}>
              {option.code} ({option.firstMonthPct}/{option.recurringPct}%)
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {PARTNER_PLAN_OPTIONS.map((plan) => (
          <TableRow key={plan.value}>
            <TableCell className="font-medium text-foreground">{plan.label}</TableCell>
            <TableCell className="tabular-nums">{formatSoles(plan.monthlyPrice)}</TableCell>
            {options.map((option) => (
              <TableCell key={option.code} className="tabular-nums">
                {formatSoles(
                  estimateFirstMonthCommission(plan.monthlyPrice, option.firstMonthPct, discountPct),
                )}{" "}
                / {formatSoles(estimateRecurringCommission(plan.monthlyPrice, option.recurringPct))}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
