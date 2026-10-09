import {
  WHATSAPP_THREAD_COLUMNS,
  type WhatsAppThreadColumn,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppConversationSummary } from "@/features/whatsapp/models/conversation.model";
import { describeWaiting, getInitials } from "@/features/whatsapp/utils/conversation-state.util";
import {
  formatLimaShortDate,
  formatLimaTime,
  isSameLimaDay,
} from "@/features/whatsapp/utils/lima-time.util";
import { THREAD_COLUMN_LABELS } from "@/features/whatsapp/utils/message-status.util";
import { cn } from "@/lib/utils";
import { ConversationTags } from "./ConversationTags";

export function formatConversationTime(value: Date | null, now: Date): string | null {
  if (!value) return null;
  return isSameLimaDay(value, now) ? formatLimaTime(value) : formatLimaShortDate(value);
}

export function describeConversationContext(conversation: WhatsAppConversationSummary): string {
  return [
    conversation.orderNumber ? `Pedido ${conversation.orderNumber}` : "Sin pedido asociado",
    conversation.storeName,
    conversation.courierName,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function getConversationTitle(conversation: WhatsAppConversationSummary): string {
  return conversation.customerName?.trim() || conversation.phone;
}

interface ConversationCardProps {
  conversation: WhatsAppConversationSummary;
  column: WhatsAppThreadColumn;
  now: Date;
  onOpen: (conversationId: string) => void;
}

export function ConversationCard({ conversation, column, now, onOpen }: ConversationCardProps) {
  const title = getConversationTitle(conversation);
  const time = formatConversationTime(conversation.lastMessageAt, now);
  const waiting = describeWaiting(conversation, now);
  const isReplied = column === WHATSAPP_THREAD_COLUMNS.REPLIED;
  const isFailed = column === WHATSAPP_THREAD_COLUMNS.FAILED;

  return (
    <button
      type="button"
      onClick={() => onOpen(conversation.id)}
      className={cn(
        "flex w-full min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-3 text-left text-sm shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isReplied && "border-red-200 dark:border-red-500/30",
      )}
    >
      <span className="sr-only">
        {`Abrir conversación con ${title}, ${THREAD_COLUMN_LABELS[column]}.`}
      </span>
      <span className="flex min-w-0 items-start justify-between gap-2" aria-hidden="true">
        <span className="min-w-0 truncate font-semibold">{title}</span>
        {time && (
          <time
            className="shrink-0 text-xs text-muted-foreground"
            dateTime={conversation.lastMessageAt?.toISOString()}
          >
            {time}
          </time>
        )}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {describeConversationContext(conversation)}
      </span>
      {conversation.lastOutbound?.templateName && (
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          <span className="sr-only">Último aviso: </span>
          {conversation.lastOutbound.templateName}
        </span>
      )}
      {isReplied && conversation.attention.lastInboundText && (
        <span className="line-clamp-3 rounded-md bg-muted/60 px-2 py-1 text-xs italic [overflow-wrap:anywhere]">
          <span className="sr-only">El comprador escribió: </span>“
          {conversation.attention.lastInboundText}”
        </span>
      )}
      {waiting && (
        <span
          className={cn(
            "text-xs font-medium",
            waiting.overdue
              ? "text-red-700 dark:text-red-300"
              : "text-amber-700 dark:text-amber-300",
          )}
        >
          {waiting.text}
        </span>
      )}
      {isFailed && (
        <span className="text-xs font-medium text-red-700 [overflow-wrap:anywhere] dark:text-red-300">
          {conversation.lastOutbound?.failureReason ?? "Motivo sin informar"}
        </span>
      )}
      <span className="flex min-w-0 items-end justify-between gap-2">
        <ConversationTags conversation={conversation} />
        <span
          className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary"
          title={conversation.assignee ? conversation.assignee.name : "Sin asignar"}
        >
          <span aria-hidden="true">
            {conversation.assignee ? getInitials(conversation.assignee.name) : "—"}
          </span>
          <span className="sr-only">
            {conversation.assignee ? `Asignada a ${conversation.assignee.name}` : "Sin asignar"}
          </span>
        </span>
      </span>
    </button>
  );
}
