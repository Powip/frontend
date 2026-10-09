import {
  Ban,
  Check,
  CheckCheck,
  Clock,
  type LucideIcon,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import {
  WHATSAPP_MESSAGE_STATUSES,
  type WhatsAppMessageStatus,
} from "@/features/whatsapp/enums/whatsapp.enums";
import {
  getMessageStatusAccessibleLabel,
  MESSAGE_STATUS_PRESENTATION,
} from "@/features/whatsapp/utils/message-status.util";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<WhatsAppMessageStatus, { icon: LucideIcon; className: string }> = {
  [WHATSAPP_MESSAGE_STATUSES.QUEUED]: { icon: Clock, className: "text-muted-foreground" },
  [WHATSAPP_MESSAGE_STATUSES.SENT]: {
    icon: Check,
    className: "text-slate-500 dark:text-slate-400",
  },
  [WHATSAPP_MESSAGE_STATUSES.DELIVERED]: {
    icon: CheckCheck,
    className: "text-slate-500 dark:text-slate-400",
  },
  [WHATSAPP_MESSAGE_STATUSES.READ]: {
    icon: CheckCheck,
    className: "text-sky-500 dark:text-sky-400",
  },
  [WHATSAPP_MESSAGE_STATUSES.FAILED]: {
    icon: TriangleAlert,
    className: "text-red-600 dark:text-red-400",
  },
  [WHATSAPP_MESSAGE_STATUSES.SKIPPED]: { icon: Ban, className: "text-red-600 dark:text-red-400" },
  [WHATSAPP_MESSAGE_STATUSES.ASSISTED]: {
    icon: UserRound,
    className: "text-amber-700 dark:text-amber-400",
  },
};

interface MessageStatusTicksProps {
  status: WhatsAppMessageStatus;
  showLabel?: boolean;
  showDetail?: boolean;
  className?: string;
}

export function MessageStatusTicks({
  status,
  showLabel = true,
  showDetail = false,
  className,
}: MessageStatusTicksProps) {
  const { icon: Icon, className: toneClassName } = STATUS_STYLES[status];
  const { label, detail } = MESSAGE_STATUS_PRESENTATION[status];
  const accessibleLabel = getMessageStatusAccessibleLabel(status);
  const visibleDetail = showLabel && showDetail ? detail : null;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)}
      data-status={status}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", toneClassName)} aria-hidden="true" />
      {showLabel ? (
        <span
          className={cn(
            status === WHATSAPP_MESSAGE_STATUSES.READ ? "text-foreground" : toneClassName,
          )}
        >
          {label}
          {visibleDetail ? (
            <span className="font-normal text-muted-foreground"> · {visibleDetail}</span>
          ) : (
            detail && <span className="sr-only">: {detail}</span>
          )}
        </span>
      ) : (
        <span className="sr-only">{accessibleLabel}</span>
      )}
    </span>
  );
}
