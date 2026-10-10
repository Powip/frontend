import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PartnerTierBadge } from "@/components/partners/partner-tier-badge";
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
import type { AdminPartner } from "@/features/partners/models/admin-partner";

interface TopPartnersTableProps {
  partners: AdminPartner[] | undefined;
  isLoading: boolean;
}

const TOP_PARTNERS_LIMIT = 5;

export function TopPartnersTable({ partners, isLoading }: TopPartnersTableProps) {
  const topPartners = partners
    ?.filter((partner) => partner.status === "activo")
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, TOP_PARTNERS_LIMIT);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Top partners</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !topPartners ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : topPartners.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Todavía no hay partners activos"
            description="Cuando aprobés al primero, va a aparecer acá."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Pagando</TableHead>
                <TableHead className="text-right">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topPartners.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell>
                    <Link
                      href={`/partners/admin/partners/${partner.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {partner.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <PartnerTierBadge level={partner.tierLevel} />
                  </TableCell>
                  <TableCell className="tabular-nums">{partner.activeReferralsCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatSoles(partner.mrr)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
