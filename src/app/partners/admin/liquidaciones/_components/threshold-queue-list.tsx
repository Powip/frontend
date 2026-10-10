import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { AdminThresholdQueueItem } from "@/features/partners/models/admin-liquidation-row";

interface ThresholdQueueListProps {
  items: AdminThresholdQueueItem[] | undefined;
  isLoading: boolean;
}

export function ThresholdQueueList({ items, isLoading }: ThresholdQueueListProps) {
  if (isLoading || !items) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nadie por debajo del umbral.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between text-sm">
          <div>
            <p className="font-medium text-foreground">{item.partnerName}</p>
            <p className="text-xs text-muted-foreground">
              {formatSoles(item.amount)} &lt; {formatSoles(item.threshold)}
            </p>
          </div>
          <Badge variant="secondary">Acumula</Badge>
        </li>
      ))}
    </ul>
  );
}
