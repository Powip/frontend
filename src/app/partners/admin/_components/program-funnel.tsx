import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelBars } from "@/components/partners/funnel-bars";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminDashboardSummary } from "@/features/partners/models/admin-dashboard-summary";

interface ProgramFunnelProps {
  funnel: AdminDashboardSummary["funnel"] | undefined;
  isLoading: boolean;
}

export function ProgramFunnel({ funnel, isLoading }: ProgramFunnelProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Embudo del programa</CardTitle>
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
