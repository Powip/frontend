import { Badge } from "@/components/ui/badge";
import type { PartnerApprovalStatus } from "@/features/partners/models/admin-partner";

interface AdminPartnerStatusBadgeProps {
  status: PartnerApprovalStatus;
}

const STATUS_MAP: Record<PartnerApprovalStatus, { label: string; className: string }> = {
  activo: {
    label: "Activo",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900",
  },
  por_aprobar: {
    label: "Por aprobar",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  },
  rechazado: {
    label: "Rechazado",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  },
};

export function AdminPartnerStatusBadge({ status }: AdminPartnerStatusBadgeProps) {
  const mapped = STATUS_MAP[status];

  return (
    <Badge variant="outline" className={mapped.className}>
      {mapped.label}
    </Badge>
  );
}
