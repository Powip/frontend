import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { AdminPartner } from "@/features/partners/models/admin-partner";
import { AdminPartnerStatusBadge } from "./admin-partner-status-badge";

export function AdminPartnersTable({
  partners,
  isLoading,
}: {
  partners: AdminPartner[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !partners)
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  if (partners.length === 0)
    return (
      <EmptyState
        icon={Users}
        title="Todavía no hay partners"
        description="No hay partners para este filtro."
      />
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Partner</TableHead>
          <TableHead>País / moneda</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Referidos manuales</TableHead>
          <TableHead>Atribuciones LINK</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partners.map((partner) => (
          <TableRow key={partner.id}>
            <TableCell>
              <div className="font-medium">{partner.displayName}</div>
              <div className="text-xs text-muted-foreground">{partner.applicationReference}</div>
            </TableCell>
            <TableCell>
              {partner.country} / {partner.currency}
            </TableCell>
            <TableCell>
              {partner.referralCode ? (
                <Badge variant="secondary">{partner.referralCode}</Badge>
              ) : (
                "No disponible"
              )}
            </TableCell>
            <TableCell className="tabular-nums">{partner.manualReferralsCount}</TableCell>
            <TableCell className="tabular-nums">{partner.linkAttributionsCount}</TableCell>
            <TableCell>
              <AdminPartnerStatusBadge status={partner.status} />
            </TableCell>
            <TableCell className="text-right">
              <Button asChild size="sm" variant="outline">
                <Link href={`/partners/admin/partners/${partner.id}`}>Ver ficha</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
