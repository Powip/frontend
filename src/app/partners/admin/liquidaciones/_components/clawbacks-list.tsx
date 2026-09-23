import { Skeleton } from "@/components/ui/skeleton";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { AdminClawback } from "@/features/partners/models/admin-liquidation-row";

interface ClawbacksListProps {
  clawbacks: AdminClawback[] | undefined;
  isLoading: boolean;
}

export function ClawbacksList({ clawbacks, isLoading }: ClawbacksListProps) {
  if (isLoading || !clawbacks) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (clawbacks.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin reversos en este ciclo.</p>;
  }

  return (
    <ul className="space-y-2">
      {clawbacks.map((clawback) => (
        <li key={clawback.id} className="flex items-center justify-between text-sm">
          <div>
            <p className="font-medium text-foreground">{clawback.partnerName}</p>
            <p className="text-xs text-muted-foreground">{clawback.note}</p>
          </div>
          <span className="tabular-nums font-semibold text-destructive">{formatSoles(clawback.amount)}</span>
        </li>
      ))}
    </ul>
  );
}
