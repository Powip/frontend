"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  readWhatsAppLastNotice,
  requestWhatsAppLastNotice,
  subscribeWhatsAppLastNotice,
} from "@/features/whatsapp/api/last-notices.api";
import {
  describeLastNotice,
  type WhatsAppLastNotice,
} from "@/features/whatsapp/utils/last-notice.util";
import { isNotSentStatus } from "@/features/whatsapp/utils/message-status.util";
import { cn } from "@/lib/utils";
import { MessageStatusTicks } from "./MessageStatusTicks";

interface WhatsAppLastNoticeIndicatorProps {
  notice: WhatsAppLastNotice | null | undefined;
  /** Con el id del pedido, si la lista no trae el aviso, se pide a wa-hub (C-29). */
  orderId?: string | null;
  className?: string;
}

const noopSubscribe = () => () => {};
const readNothing = () => null;

export function WhatsAppLastNoticeIndicator({
  notice: given,
  orderId,
  className,
}: WhatsAppLastNoticeIndicatorProps) {
  const lookup = !given && orderId ? orderId : null;
  useEffect(() => {
    if (lookup) requestWhatsAppLastNotice(lookup);
  }, [lookup]);
  const fetched = useSyncExternalStore(
    lookup ? (listener) => subscribeWhatsAppLastNotice(lookup, listener) : noopSubscribe,
    lookup ? () => readWhatsAppLastNotice(lookup) : readNothing,
    readNothing,
  );
  const notice = given ?? fetched;
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
