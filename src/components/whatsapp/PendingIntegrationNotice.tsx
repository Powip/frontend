import { Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    <Alert
      role="note"
      className={cn(
        "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200",
        className,
      )}
    >
      <Clock aria-hidden="true" />
      <AlertTitle className="line-clamp-none whitespace-normal">{title}</AlertTitle>
      {(description || (items && items.length > 0)) && (
        <AlertDescription className="text-slate-600 dark:text-slate-300">
          {description && <p>{description}</p>}
          {items && items.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </AlertDescription>
      )}
    </Alert>
  );
}
