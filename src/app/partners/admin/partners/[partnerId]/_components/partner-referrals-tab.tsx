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
import { cn } from "@/lib/utils";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { AdminPartnerReferral } from "@/features/partners/models/admin-partner-referral";

interface PartnerReferralsTabProps {
  referrals: AdminPartnerReferral[] | undefined;
  isLoading: boolean;
}

export function PartnerReferralsTab({ referrals, isLoading }: PartnerReferralsTabProps) {
  if (isLoading || !referrals) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (referrals.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Sin referidos todavía"
        description="Cuando este partner registre referidos, van a aparecer acá."
      />
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
          <TableHead>Modal.</TableHead>
          <TableHead className="text-right">1er mes</TableHead>
          <TableHead className="text-right">Recurrente</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {referrals.map((referral) => (
          <TableRow key={referral.id}>
            <TableCell className="font-medium text-foreground">{referral.businessName}</TableCell>
            <TableCell>
              <ReferralOriginBadge origin={referral.origin} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {format(new Date(referral.registeredAt), "dd MMM", { locale: es })}
            </TableCell>
            <TableCell>{referral.planName ?? <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell className="capitalize">
              {referral.billingCycle ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums",
                referral.firstMonthCommission !== null && referral.firstMonthCommission < 0 && "text-destructive",
              )}
            >
              {referral.firstMonthCommission !== null ? formatSoles(referral.firstMonthCommission) : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {referral.recurringCommission !== null ? formatSoles(referral.recurringCommission) : "—"}
            </TableCell>
            <TableCell>
              <ReferralStatusBadge status={referral.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
