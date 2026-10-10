import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { PayoutSettings } from "@/features/partners/models/payout-settings";

interface MinimumThresholdCardProps {
  settings: PayoutSettings | undefined;
  isLoading: boolean;
}

export function MinimumThresholdCard({ settings, isLoading }: MinimumThresholdCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Umbral mínimo
        </p>
        {isLoading || !settings ? (
          <Skeleton className="mt-2 h-4 w-full" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Si la comisión del ciclo es menor a <b className="text-foreground">{formatSoles(settings.minimumThreshold)}</b>,
            se acumula al siguiente pago.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
