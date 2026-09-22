import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Users } from "lucide-react";
import { ReferralOriginBadge } from "@/components/partners/referral-origin-badge";
import { ReferralStatusBadge } from "@/components/partners/referral-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { PartnerReferral } from "@/features/partners/models/partner-referral";

interface ReferralsTableProps {
  referrals: PartnerReferral[] | undefined;
  isLoading: boolean;
  hasAnyReferral: boolean;
  onSelectReferral: (referral: PartnerReferral) => void;
  onRegisterReferral: () => void;
}

export function ReferralsTable({
  referrals,
  isLoading,
  hasAnyReferral,
  onSelectReferral,
  onRegisterReferral,
}: ReferralsTableProps) {
  if (isLoading || !referrals) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!hasAnyReferral) {
    return (
      <EmptyState
        icon={Users}
        title="Todavía no tenés referidos"
        description="Registrá un negocio o compartí tu link para empezar a sumar referidos."
        actionLabel="Registrar referido"
        onAction={onRegisterReferral}
      />
    );
  }

  if (referrals.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No hay referidos en este filtro.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Negocio</TableHead>
          <TableHead>Origen</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">1er mes</TableHead>
          <TableHead className="text-right">Recurrente</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {referrals.map((referral) => (
          <TableRow
            key={referral.id}
            role="button"
            aria-label={`Ver detalle de ${referral.businessName}`}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            tabIndex={0}
            onClick={() => onSelectReferral(referral)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectReferral(referral);
              }
            }}
          >
            <TableCell className="font-medium text-foreground">{referral.businessName}</TableCell>
            <TableCell>
              <ReferralOriginBadge origin={referral.origin} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {format(new Date(referral.registeredAt), "dd MMM", { locale: es })}
            </TableCell>
            <TableCell>{referral.planName ?? <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell>
              <ReferralStatusBadge status={referral.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {referral.firstMonthCommission !== null ? formatSoles(referral.firstMonthCommission) : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {referral.recurringCommission !== null ? formatSoles(referral.recurringCommission) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
