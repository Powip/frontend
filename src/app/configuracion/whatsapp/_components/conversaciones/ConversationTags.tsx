import type { ReactNode } from "react";
import { WaMini, type WaTone } from "@/components/whatsapp/ui/WaPill";
import { WHATSAPP_MESSAGE_STATUSES } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppConversationSummary } from "@/features/whatsapp/models/conversation.model";
import { isShownAsAttended } from "@/features/whatsapp/utils/conversation-state.util";
import { cn } from "@/lib/utils";

export function ConversationTags({
  conversation,
  className,
}: {
  conversation: WhatsAppConversationSummary;
  className?: string;
}) {
  const tags: { key: string; tone: WaTone; label: ReactNode }[] = [];
  if (conversation.trackingOpened) {
    tags.push({ key: "tracking", tone: "teal", label: "Abrió rastreo" });
  }
  if (isShownAsAttended(conversation)) {
    tags.push({ key: "attended", tone: "ok", label: "Atendida" });
  }
  if (conversation.lastOutbound?.status === WHATSAPP_MESSAGE_STATUSES.ASSISTED) {
    tags.push({ key: "assisted", tone: "warn", label: "Asistido" });
  }
  if (conversation.flaggedForReview) {
    tags.push({ key: "review", tone: "warn", label: "Revisar" });
  }
  if (conversation.optedOut) {
    tags.push({ key: "opted-out", tone: "neutral", label: "Dado de baja" });
  }
  if (tags.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => (
        <WaMini key={tag.key} tone={tag.tone}>
          {tag.label}
        </WaMini>
      ))}
    </span>
  );
}
