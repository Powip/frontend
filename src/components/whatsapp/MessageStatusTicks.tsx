import { Ban, Clock, TriangleAlert, UserRound } from "lucide-react";
import {
  WHATSAPP_MESSAGE_STATUSES,
  type WhatsAppMessageStatus,
} from "@/features/whatsapp/enums/whatsapp.enums";
import {
  getMessageStatusAccessibleLabel,
  MESSAGE_STATUS_PRESENTATION,
} from "@/features/whatsapp/utils/message-status.util";
import { cn } from "@/lib/utils";

export function SingleTick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className={cn("h-3 w-[18px] shrink-0", className)}>
      <path
        d="M3 6.5 6.5 10 14 2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DoubleTick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className={cn("h-3 w-[18px] shrink-0", className)}>
      <path
        d="M1 6.5 4.5 10 12 2.5M8.2 9.2l.8.8L16.5 2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusIcon({ status }: { status: WhatsAppMessageStatus }) {
  switch (status) {
    case WHATSAPP_MESSAGE_STATUSES.SENT:
      return <SingleTick className="text-wa-tick" />;
    case WHATSAPP_MESSAGE_STATUSES.DELIVERED:
      return <DoubleTick className="text-wa-tick" />;
    case WHATSAPP_MESSAGE_STATUSES.READ:
      return <DoubleTick className="text-wa-tick-read" />;
    case WHATSAPP_MESSAGE_STATUSES.FAILED:
      return <TriangleAlert className="size-[15px] shrink-0" aria-hidden="true" />;
    case WHATSAPP_MESSAGE_STATUSES.SKIPPED:
      return <Ban className="size-[15px] shrink-0" aria-hidden="true" />;
    case WHATSAPP_MESSAGE_STATUSES.ASSISTED:
      return <UserRound className="size-[15px] shrink-0" aria-hidden="true" />;
    case WHATSAPP_MESSAGE_STATUSES.QUEUED:
      return <Clock className="size-[15px] shrink-0" aria-hidden="true" />;
  }
}

const TONE: Record<WhatsAppMessageStatus, string> = {
  [WHATSAPP_MESSAGE_STATUSES.QUEUED]: "text-wa-muted",
  [WHATSAPP_MESSAGE_STATUSES.SENT]: "",
  [WHATSAPP_MESSAGE_STATUSES.DELIVERED]: "",
  [WHATSAPP_MESSAGE_STATUSES.READ]: "",
  [WHATSAPP_MESSAGE_STATUSES.FAILED]: "text-wa-red",
  [WHATSAPP_MESSAGE_STATUSES.SKIPPED]: "text-wa-red",
  [WHATSAPP_MESSAGE_STATUSES.ASSISTED]: "text-wa-muted",
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
  const { label, detail } = MESSAGE_STATUS_PRESENTATION[status];
  const accessibleLabel = getMessageStatusAccessibleLabel(status);
  const visibleDetail = showLabel && showDetail ? detail : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-medium",
        !visibleDetail && "whitespace-nowrap",
        TONE[status],
        className,
      )}
      data-status={status}
    >
      <StatusIcon status={status} />
      {showLabel ? (
        <span>
          {label}
          {visibleDetail ? (
            <span className="font-normal text-wa-muted"> · {visibleDetail}</span>
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
