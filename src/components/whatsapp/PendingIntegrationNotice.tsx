import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PendingIntegrationNoticeProps {
  title: string;
  description?: string;
  items?: string[];
  className?: string;
}

export function PendingIntegrationNotice({
  title,
  description,
  items,
  className,
}: PendingIntegrationNoticeProps) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-dashed border-wa-border-strong bg-wa-surface-2 px-3.5 py-3 text-[13px] text-wa-muted",
        className,
      )}
    >
      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-wa-fg">{title}</p>
        {description && <p>{description}</p>}
        {items && items.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-4">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
