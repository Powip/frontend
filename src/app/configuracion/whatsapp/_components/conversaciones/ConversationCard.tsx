import { WaMini } from "@/components/whatsapp/ui/WaPill";
import { waTemplateName } from "@/components/whatsapp/ui/wa-classes";
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

export function AssigneeAvatar({ name, className }: { name: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid size-5 shrink-0 place-items-center rounded-full bg-wa-primary-soft text-[9.5px] font-bold text-wa-primary",
        className,
      )}
      title={name ?? "Sin asignar"}
    >
      <span aria-hidden="true">{name ? getInitials(name) : "—"}</span>
      <span className="sr-only">{name ? `Asignada a ${name}` : "Sin asignar"}</span>
    </span>
  );
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
      className="flex w-full min-w-0 cursor-pointer flex-col gap-1.5 rounded-xl border border-wa-border bg-wa-surface px-3 py-2.5 text-left text-[12.5px] text-wa-fg shadow-wa outline-none transition-colors hover:border-wa-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary"
    >
      <span className="sr-only">
        {`Abrir conversación con ${title}, ${THREAD_COLUMN_LABELS[column]}.`}
      </span>
      <span className="flex min-w-0 items-baseline justify-between gap-1.5" aria-hidden="true">
        <b className="min-w-0 truncate text-[13px] font-semibold">{title}</b>
        {time && (
          <time
            className="wa-num shrink-0 text-wa-muted"
            dateTime={conversation.lastMessageAt?.toISOString()}
          >
            {time}
          </time>
        )}
      </span>
      <span className="truncate text-wa-muted">{describeConversationContext(conversation)}</span>
      {isReplied && conversation.attention.lastInboundText && (
        <span className="line-clamp-3 rounded-lg bg-wa-surface-2 px-2 py-1.5 text-xs [overflow-wrap:anywhere]">
          <span className="sr-only">El comprador escribió: </span>“
          {conversation.attention.lastInboundText}”
        </span>
      )}
      {isFailed && (
        <span className="rounded-lg bg-wa-surface-2 px-2 py-1.5 text-xs text-wa-red [overflow-wrap:anywhere]">
          {conversation.lastOutbound?.failureReason ?? "Motivo sin informar"}
        </span>
      )}
      <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11.5px] text-wa-muted">
        {conversation.lastOutbound?.templateName && (
          <span className={cn(waTemplateName, "min-w-0 truncate text-[11px] font-medium")}>
            <span className="sr-only">Último aviso: </span>
            {conversation.lastOutbound.templateName}
          </span>
        )}
        <ConversationTags conversation={conversation} />
        {waiting && <WaMini tone={waiting.overdue ? "err" : "warn"}>{waiting.text}</WaMini>}
        <AssigneeAvatar name={conversation.assignee?.name ?? null} className="ml-auto" />
      </span>
    </button>
  );
}
