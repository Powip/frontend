import { Ban, CheckCircle2, Flag, MousePointerClick, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { WHATSAPP_MESSAGE_STATUSES } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppConversationSummary } from "@/features/whatsapp/models/conversation.model";
import { isShownAsAttended } from "@/features/whatsapp/utils/conversation-state.util";
import { cn } from "@/lib/utils";

function Tag({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium [&>svg]:h-3 [&>svg]:w-3",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ConversationTags({
  conversation,
  className,
}: {
  conversation: WhatsAppConversationSummary;
  className?: string;
}) {
  const tags: ReactNode[] = [];
  if (isShownAsAttended(conversation)) {
    tags.push(
      <Tag
        key="attended"
        className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
      >
        <CheckCircle2 aria-hidden="true" />
        Atendida
      </Tag>,
    );
  }
  if (conversation.trackingOpened) {
    tags.push(
      <Tag key="tracking" className="bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
        <MousePointerClick aria-hidden="true" />
        Abrió rastreo
      </Tag>,
    );
  }
  if (conversation.lastOutbound?.status === WHATSAPP_MESSAGE_STATUSES.ASSISTED) {
    tags.push(
      <Tag
        key="assisted"
        className="bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300"
      >
        <UserRound aria-hidden="true" />
        Asistido
      </Tag>,
    );
  }
  if (conversation.flaggedForReview) {
    tags.push(
      <Tag
        key="review"
        className="bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-300"
      >
        <Flag aria-hidden="true" />
        Revisar
      </Tag>,
    );
  }
  if (conversation.optedOut) {
    tags.push(
      <Tag key="opted-out" className="bg-muted text-muted-foreground">
        <Ban aria-hidden="true" />
        Dado de baja
      </Tag>,
    );
  }
  if (tags.length === 0) return null;
  return <span className={cn("flex flex-wrap gap-1", className)}>{tags}</span>;
}
