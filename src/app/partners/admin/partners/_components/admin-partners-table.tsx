import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { AdminPartnerStatusBadge } from "./admin-partner-status-badge";

const PROFILE_LABELS: Record<AdminPartner["profile"], string> = {
  agencia: "🏢 Agencia",
  dev: "👨‍💻 Dev",
  creador: "🎬 Creador",
};

interface AdminPartnersTableProps {
  partners: AdminPartner[] | undefined;
  isLoading: boolean;
  approvingId: string | null;
  onApprove: (id: string) => void;
}

export function AdminPartnersTable({
  partners,
  isLoading,
  approvingId,
  onApprove,
}: AdminPartnersTableProps) {
  if (isLoading || !partners) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (partners.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Todavía no hay partners"
        description="Invitá al primero para empezar el programa."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Partner</TableHead>
          <TableHead>Perfil</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Opción</TableHead>
          <TableHead>Nivel</TableHead>
          <TableHead>Referidos</TableHead>
          <TableHead>MRR</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partners.map((partner) => (
          <TableRow key={partner.id}>
            <TableCell>
              <div className="font-medium text-foreground">{partner.name}</div>
              {partner.handle && <div className="text-xs text-muted-foreground">{partner.handle}</div>}
            </TableCell>
            <TableCell>
              <span className="text-sm">{PROFILE_LABELS[partner.profile]}</span>
            </TableCell>
            <TableCell>
              {partner.code ? (
                <Badge variant="secondary">{partner.code}</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>{partner.commissionOptionCode ?? <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell>
              <PartnerTierBadge level={partner.tierLevel} />
            </TableCell>
            <TableCell className="tabular-nums">
              {partner.referralsCount} · {partner.activeReferralsCount}a
            </TableCell>
            <TableCell className="tabular-nums">{formatSoles(partner.mrr)}</TableCell>
            <TableCell>
              <AdminPartnerStatusBadge status={partner.status} />
            </TableCell>
            <TableCell className="text-right">
              {partner.status === "por_aprobar" ? (
                <Button
                  size="sm"
                  onClick={() => onApprove(partner.id)}
                  disabled={approvingId === partner.id}
                >
                  {approvingId === partner.id ? "Aprobando..." : "Aprobar"}
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/partners/admin/partners/${partner.id}`}>Ver ficha</Link>
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
