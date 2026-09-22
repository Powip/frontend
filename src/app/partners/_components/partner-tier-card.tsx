import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { PartnerTier, PartnerTierLevel } from "@/features/partners/models/partner-tier";

interface PartnerTierCardProps {
  tier: PartnerTier | undefined;
  isLoading: boolean;
}

const TIER_LABELS: Record<PartnerTierLevel, { label: string; medal: string }> = {
  bronce: { label: "Nivel Bronce", medal: "🥉" },
  plata: { label: "Nivel Plata", medal: "🥈" },
  oro: { label: "Nivel Oro", medal: "🥇" },
};

export function PartnerTierCard({ tier, isLoading }: PartnerTierCardProps) {
  if (isLoading || !tier) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const { label, medal } = TIER_LABELS[tier.level];
  const progressPct = tier.nextLevelThreshold
    ? Math.min(100, Math.round((tier.activeMrr / tier.nextLevelThreshold) * 100))
    : 100;
  const remaining = tier.nextLevelThreshold ? tier.nextLevelThreshold - tier.activeMrr : 0;

  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">
          {medal}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {tier.extraResidualPct > 0 && (
              <span className="text-xs text-muted-foreground">+{tier.extraResidualPct}% residual</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatSoles(tier.activeMrr)} de MRR activo
            {tier.nextLevelThreshold && ` · faltan ${formatSoles(remaining)} para el siguiente nivel`}
          </p>
          <Progress value={progressPct} className="mt-2" />
        </div>
      </CardContent>
    </Card>
  );
}
