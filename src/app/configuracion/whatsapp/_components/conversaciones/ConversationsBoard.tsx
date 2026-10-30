import { MessageSquare, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { DoubleTick, SingleTick } from "@/components/whatsapp/MessageStatusTicks";
import { waButton } from "@/components/whatsapp/ui/wa-classes";
import {
  WHATSAPP_THREAD_COLUMNS,
  type WhatsAppThreadColumn,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppConversationBoard } from "@/features/whatsapp/models/conversation.model";
import {
  CONVERSATION_COLUMN_ORDER,
  groupBoardByColumn,
} from "@/features/whatsapp/utils/conversation-state.util";
import { THREAD_COLUMN_LABELS } from "@/features/whatsapp/utils/message-status.util";
import { cn } from "@/lib/utils";
import { ConversationCard } from "./ConversationCard";
import { CONVERSATION_PENDING_REASON } from "./conversation-types";

const LOAD_MORE_BLOCKED_ID = "conversations-load-more-blocked";

export const COLUMN_ICONS: Record<WhatsAppThreadColumn, ReactNode> = {
  [WHATSAPP_THREAD_COLUMNS.SENT]: <SingleTick className="text-wa-tick" />,
  [WHATSAPP_THREAD_COLUMNS.DELIVERED]: <DoubleTick className="text-wa-tick" />,
  [WHATSAPP_THREAD_COLUMNS.READ]: <DoubleTick className="text-wa-tick-read" />,
  [WHATSAPP_THREAD_COLUMNS.REPLIED]: (
    <MessageSquare className="size-4 shrink-0 text-wa-red" aria-hidden="true" />
  ),
  [WHATSAPP_THREAD_COLUMNS.FAILED]: (
    <TriangleAlert className="size-4 shrink-0 text-wa-red" aria-hidden="true" />
  ),
};

export const BOARD_GRID =
  "relative grid snap-x auto-cols-[minmax(200px,85%)] grid-flow-col gap-3 overflow-x-auto pb-1.5 sm:auto-cols-[minmax(200px,1fr)]";

export const COLUMN_CLASS =
  "flex min-h-60 min-w-0 snap-start flex-col gap-2 rounded-[14px] border border-wa-border bg-wa-surface-2 p-2.5";

export const HOT_COLUMN_CLASS =
  "border-[color-mix(in_srgb,var(--wa-red)_40%,var(--wa-border))] bg-[color-mix(in_srgb,var(--wa-red-soft)_45%,var(--wa-surface-2))]";

interface ConversationsBoardProps {
  board: WhatsAppConversationBoard;
  now: Date;
  onOpen: (conversationId: string) => void;
  onLoadMore?: (column: WhatsAppThreadColumn) => void;
}

export function ConversationsBoard({ board, now, onOpen, onLoadMore }: ConversationsBoardProps) {
  const grouped = groupBoardByColumn(board);
  const anyHasMore = CONVERSATION_COLUMN_ORDER.some((column) => board[column].hasMore);

  return (
    <div className="space-y-2">
      <div className={BOARD_GRID}>
        {CONVERSATION_COLUMN_ORDER.map((column) => {
          const items = grouped[column];
          const total = board[column].total;
          const hot = column === WHATSAPP_THREAD_COLUMNS.REPLIED && (total ?? items.length) > 0;
          const headingId = `conversations-column-${column}`;
          return (
            <section
              key={column}
              aria-labelledby={headingId}
              className={cn(COLUMN_CLASS, hot && HOT_COLUMN_CLASS)}
            >
              <h3
                id={headingId}
                className="m-0 flex items-center gap-2 px-1 pt-0.5 pb-1.5 text-[13px] font-semibold"
              >
                {COLUMN_ICONS[column]}
                <span>{THREAD_COLUMN_LABELS[column]}</span>
                {total !== null && (
                  <span
                    className={cn(
                      "wa-num ml-auto rounded-full border px-2 text-[11px] font-semibold",
                      hot
                        ? "border-wa-red bg-wa-red text-white"
                        : "border-wa-border bg-wa-surface text-wa-muted",
                    )}
                  >
                    {total}
                    <span className="sr-only"> en total</span>
                  </span>
                )}
              </h3>
              {items.length === 0 ? (
                <p className="m-0 p-1 text-xs text-wa-muted">Nada por aquí</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {items.map((conversation) => (
                    <li key={conversation.id}>
                      <ConversationCard
                        conversation={conversation}
                        column={column}
                        now={now}
                        onOpen={onOpen}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {board[column].hasMore && (
                <BlockedActionButton
                  className={waButton({ variant: "ghost", size: "sm" })}
                  blocked={!onLoadMore}
                  blockedReasonId={LOAD_MORE_BLOCKED_ID}
                  onClick={() => onLoadMore?.(column)}
                >
                  Ver más
                </BlockedActionButton>
              )}
            </section>
          );
        })}
      </div>
      {anyHasMore && !onLoadMore && (
        <p id={LOAD_MORE_BLOCKED_ID} className="m-0 text-xs text-wa-muted">
          {CONVERSATION_PENDING_REASON}
        </p>
      )}
    </div>
  );
}
