import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { AdminPartnerReferral } from "@/features/partners/models/admin-partner-referral";

const SOURCES = {
  MANUAL: "Manual",
  CODE: "Código",
  LINK_LEGACY: "LINK histórico",
  LINK_ATTRIBUTION: "Atribución LINK",
} as const;
const dateLabel = (instant: string | null) =>
  instant ? new Date(instant).toLocaleString("es-PE") : "No disponible";

export function PartnerReferralsTab({
  referrals,
  isLoading,
}: {
  referrals: AdminPartnerReferral[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !referrals)
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    );
  if (referrals.length === 0)
    return (
      <EmptyState
        icon={Users}
        title="Sin referidos ni atribuciones todavía"
        description="Los registros del partner aparecerán acá."
      />
    );
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Estado persistido del registro. Plan, modalidad de cobro y comisiones no disponibles.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Negocio / empresa</TableHead>
            <TableHead>Fuente</TableHead>
            <TableHead>Capturado</TableHead>
            <TableHead>Empresa creada</TableHead>
            <TableHead>Atribuido</TableHead>
            <TableHead>Estado reportado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {referrals.map((referral) => (
            <TableRow key={`${referral.source}:${referral.id}`}>
              <TableCell>
                <div className="font-medium">{referral.businessName ?? "Nombre no disponible"}</div>
                <div className="text-xs text-muted-foreground">
                  {referral.companyId ?? "Empresa no asociada"}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{SOURCES[referral.source]}</Badge>
              </TableCell>
              <TableCell>{dateLabel(referral.capturedAt)}</TableCell>
              <TableCell>{dateLabel(referral.companyCreatedAt)}</TableCell>
              <TableCell>{dateLabel(referral.attributedAt)}</TableCell>
              <TableCell>{referral.state}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
