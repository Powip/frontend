import { Clock } from "lucide-react";

interface PendingBackendNoticeProps {
  id?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function PendingBackendNotice({ id, title, children, className = "" }: PendingBackendNoticeProps) {
  return (
    <div
      id={id}
      role="note"
      className={`flex gap-2 rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 ${className}`}
    >
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="font-semibold">{title}</p>
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
