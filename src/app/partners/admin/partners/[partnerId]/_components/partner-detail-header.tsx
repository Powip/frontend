import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminPartner } from "@/features/partners/models/admin-partner";
import { AdminPartnerStatusBadge } from "../../_components/admin-partner-status-badge";

export function PartnerDetailHeader({
  partner,
  isLoading,
}: {
  partner: AdminPartner | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !partner)
    return (
      <Card>
        <CardContent>
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-extrabold">{partner.displayName}</h2>
          <AdminPartnerStatusBadge status={partner.status} />
          {partner.referralCode ? <Badge variant="secondary">{partner.referralCode}</Badge> : null}
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">País / moneda</dt>
            <dd>
              {partner.country} / {partner.currency}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Solicitud</dt>
            <dd>{partner.applicationReference}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Solicitado</dt>
            <dd>{new Date(partner.appliedAt).toLocaleString("es-PE")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Activado</dt>
            <dd>
              {partner.activatedAt
                ? new Date(partner.activatedAt).toLocaleString("es-PE")
                : "No disponible"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Perfil, nivel, opción de comisión y método de cobro no disponibles.
        </p>
      </CardContent>
    </Card>
  );
}
