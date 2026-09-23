import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PartnerTierBadge } from "@/components/partners/partner-tier-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminPartner } from "@/features/partners/models/admin-partner";
import { AdminPartnerStatusBadge } from "../../_components/admin-partner-status-badge";

const PROFILE_LABELS: Record<AdminPartner["profile"], string> = {
  agencia: "🏢 Agencia",
  dev: "👨‍💻 Dev",
  creador: "🎬 Creador",
};

interface PartnerDetailHeaderProps {
  partner: AdminPartner | null | undefined;
  isLoading: boolean;
}

export function PartnerDetailHeader({ partner, isLoading }: PartnerDetailHeaderProps) {
  if (isLoading || !partner) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const initials = partner.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="rounded-2xl">
      <CardContent className="flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-lg font-bold text-primary-foreground">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold text-foreground">{partner.name}</h2>
            <PartnerTierBadge level={partner.tierLevel} />
            <AdminPartnerStatusBadge status={partner.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {partner.handle ?? "—"} · {PROFILE_LABELS[partner.profile]}
            {partner.code && (
              <>
                {" "}
                · <Badge variant="secondary">{partner.code}</Badge>
              </>
            )}
            {partner.commissionOptionCode && ` · Opción ${partner.commissionOptionCode}`}
            {partner.payoutMethodLabel && ` · Cobro: ${partner.payoutMethodLabel}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
