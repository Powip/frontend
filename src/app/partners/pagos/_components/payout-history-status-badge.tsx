import { Badge } from "@/components/ui/badge";
import type { PayoutHistoryStatus } from "@/features/partners/models/payout-history-entry";

interface PayoutHistoryStatusBadgeProps {
  status: PayoutHistoryStatus;
}

const STATUS_MAP: Record<PayoutHistoryStatus, { label: string; className: string }> = {
  programado: {
    label: "Programado",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  },
  pagado: {
    label: "Pagado",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900",
  },
};

export function PayoutHistoryStatusBadge({ status }: PayoutHistoryStatusBadgeProps) {
  const mapped = STATUS_MAP[status];

  return (
    <Badge variant="outline" className={mapped.className}>
      {mapped.label}
    </Badge>
  );
}
