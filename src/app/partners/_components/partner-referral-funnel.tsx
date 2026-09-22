import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PartnerFunnelStep } from "@/features/partners/models/partner-summary";

interface PartnerReferralFunnelProps {
  funnel: PartnerFunnelStep[] | undefined;
  isLoading: boolean;
}

export function PartnerReferralFunnel({ funnel, isLoading }: PartnerReferralFunnelProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Embudo de referidos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !funnel ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (
          <FunnelBars steps={funnel} />
        )}
      </CardContent>
    </Card>
  );
}

function FunnelBars({ steps }: { steps: PartnerFunnelStep[] }) {
  const max = Math.max(1, ...steps.map((step) => step.count));

  return (
    <div className="space-y-4">
      {steps.map((step) => (
        <div key={step.label}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{step.label}</span>
            <span className="tabular-nums font-semibold text-foreground">{step.count}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(step.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
