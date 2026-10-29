import { Badge } from "@/components/ui/badge";
import type { CommissionLineStatus } from "@/features/partners/models/commission-line";

interface CommissionStatusBadgeProps {
  status: CommissionLineStatus;
}

const STATUS_MAP: Record<CommissionLineStatus, { label: string; className: string }> = {
  activa: {
    label: "Activa",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900",
  },
  pendiente: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  },
  reverso: {
    label: "Reverso",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  },
};

export function CommissionStatusBadge({ status }: CommissionStatusBadgeProps) {
  const mapped = STATUS_MAP[status];

  return (
    <Badge variant="outline" className={mapped.className}>
      {mapped.label}
    </Badge>
  );
}
