import {
  describeLastNotice,
  type WhatsAppLastNotice,
} from "@/features/whatsapp/utils/last-notice.util";
import { isNotSentStatus } from "@/features/whatsapp/utils/message-status.util";
import { cn } from "@/lib/utils";
import { MessageStatusTicks } from "./MessageStatusTicks";

interface WhatsAppLastNoticeIndicatorProps {
  notice: WhatsAppLastNotice | null | undefined;
  className?: string;
}

export function WhatsAppLastNoticeIndicator({
  notice,
  className,
}: WhatsAppLastNoticeIndicatorProps) {
  if (!notice) return null;
  const failed = isNotSentStatus(notice.status);
  return (
    <span
      data-testid="whatsapp-last-notice"
      className={cn(
        "pointer-events-none absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full border px-0.5 shadow-sm",
        failed
          ? "border-red-600 bg-red-600 text-white [&_svg]:text-white"
          : "border-border bg-background",
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex">
        <MessageStatusTicks
          status={notice.status}
          showLabel={false}
          className="[&_svg]:h-2.5 [&_svg]:w-2.5 [&_.sr-only]:hidden"
        />
      </span>
      <span className="sr-only">{`, ${describeLastNotice(notice)}`}</span>
    </span>
  );
}
