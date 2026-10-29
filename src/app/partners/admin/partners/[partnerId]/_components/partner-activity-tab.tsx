import { Skeleton } from "@/components/ui/skeleton";
import type { AdminPartnerActivity } from "@/features/partners/models/admin-partner-activity";

export function PartnerActivityTab({
  activity,
  isLoading,
}: {
  activity: AdminPartnerActivity[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !activity)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-12 w-full" />
        ))}
      </div>
    );
  if (activity.length === 0)
    return <p className="py-6 text-sm text-muted-foreground">Sin eventos registrados.</p>;
  return (
    <ol className="space-y-4 border-l border-border pl-4">
      {activity.map((event, index) => (
        <li
          key={`${event.occurredAt}:${event.action}:${event.entityId}:${index}`}
          className="relative"
        >
          <span
            aria-hidden="true"
            className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary"
          />
          <p className="text-sm font-medium">{event.action}</p>
          <p className="text-xs text-muted-foreground">
            {event.entityType}
            {event.entityId ? ` · ${event.entityId}` : ""}
          </p>
          <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">
            {new Date(event.occurredAt).toLocaleString("es-PE")}
          </time>
        </li>
      ))}
    </ol>
  );
}
