import { AlertCircle, Clock, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type NoticeTone = "pending" | "restriction" | "error";

interface UsersNoticeProps {
  id?: string;
  tone: NoticeTone;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  role?: "note" | "status" | "alert";
  className?: string;
}

const TONES: Record<NoticeTone, { icon: typeof Clock; className: string; role: "note" | "alert" }> = {
  pending: {
    icon: Clock,
    className: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200",
    role: "note",
  },
  restriction: {
    icon: Lock,
    className: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    role: "note",
  },
  error: {
    icon: AlertCircle,
    className: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
    role: "alert",
  },
};

export function UsersNotice({ id, tone, title, children, action, role, className }: UsersNoticeProps) {
  const config = TONES[tone];
  const Icon = config.icon;
  return (
    <Alert id={id} role={role ?? config.role} className={cn("min-w-0 py-2.5", config.className, className)}>
      <Icon aria-hidden="true" />
      <AlertTitle className="line-clamp-none whitespace-normal break-words text-[13px]">{title}</AlertTitle>
      {(children || action) && (
        <AlertDescription className="text-xs text-current/80 [&_p]:leading-snug">
          {children && <p className="break-words">{children}</p>}
          {action}
        </AlertDescription>
      )}
    </Alert>
  );
}

interface PendingBackendNoticeProps {
  id?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function PendingBackendNotice(props: PendingBackendNoticeProps) {
  return <UsersNotice tone="pending" {...props} />;
}
