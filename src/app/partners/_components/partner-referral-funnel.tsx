import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelBars } from "@/components/partners/funnel-bars";
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
