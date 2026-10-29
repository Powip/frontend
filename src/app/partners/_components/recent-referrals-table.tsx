import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ReferralOriginBadge } from "@/components/partners/referral-origin-badge";
import { ReferralStatusBadge } from "@/components/partners/referral-status-badge";

interface RecentReferralsTableProps {
  referrals: PartnerReferral[] | undefined;
  isLoading: boolean;
}

export function RecentReferralsTable({ referrals, isLoading }: RecentReferralsTableProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Últimos referidos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !referrals ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Todavía no tenés referidos"
            description="Cuando registres un negocio o alguien entre con tu link, va a aparecer acá."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Negocio</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">1er mes</TableHead>
                <TableHead className="text-right">Recurrente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.map((referral) => (
                <TableRow key={referral.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{referral.businessName}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(referral.registeredAt), "dd MMM", { locale: es })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ReferralOriginBadge origin={referral.origin} />
                  </TableCell>
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
        )}
      </CardContent>
    </Card>
  );
}
