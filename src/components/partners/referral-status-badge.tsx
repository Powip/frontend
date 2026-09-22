import { Badge } from "@/components/ui/badge";
import type { ReferralStatus } from "@/features/partners/models/referral-status.enum";

interface ReferralStatusBadgeProps {
  status: ReferralStatus;
}

const STATUS_MAP: Record<ReferralStatus, { label: string; className: string }> = {
  correo_enviado: {
    label: "Correo enviado",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  },
  cuenta_creada: {
    label: "Cuenta creada",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  },
  activo_sin_pago: {
    label: "Activó · sin pago",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  },
  en_revision: {
    label: "En revisión",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  },
  pagando: {
    label: "Pagó · activa",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900",
  },
  cancelado: {
    label: "Canceló",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  },
};

export function ReferralStatusBadge({ status }: ReferralStatusBadgeProps) {
  const mapped = STATUS_MAP[status];

  return (
    <Badge variant="outline" className={mapped.className}>
      {mapped.label}
    </Badge>
  );
}
