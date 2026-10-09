import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
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
      <div className="grid snap-x auto-cols-[minmax(15rem,85%)] grid-flow-col gap-3 overflow-x-auto pb-2 sm:auto-cols-[minmax(15rem,1fr)]">
        {CONVERSATION_COLUMN_ORDER.map((column) => {
          const items = grouped[column];
          const total = board[column].total;
          const isReplied = column === WHATSAPP_THREAD_COLUMNS.REPLIED;
          const headingId = `conversations-column-${column}`;
          return (
            <section
              key={column}
              aria-labelledby={headingId}
              className={cn(
                "flex min-w-0 snap-start flex-col gap-2 rounded-xl border bg-muted/40 p-2",
                isReplied && "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10",
              )}
            >
              <h3
                id={headingId}
                className="flex items-center justify-between gap-2 px-1 text-sm font-semibold"
              >
                <span>{THREAD_COLUMN_LABELS[column]}</span>
                {total !== null && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      isReplied
                        ? "bg-red-600 text-white dark:bg-red-500"
                        : "bg-background text-muted-foreground",
                    )}
                  >
                    {total}
                    <span className="sr-only"> en total</span>
                  </span>
                )}
              </h3>
              {items.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nada por aquí</p>
              ) : (
                <ul className="flex flex-col gap-2">
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
                  variant="ghost"
                  size="sm"
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
        <p id={LOAD_MORE_BLOCKED_ID} className="text-xs text-muted-foreground">
          {CONVERSATION_PENDING_REASON}
        </p>
      )}
    </div>
  );
}
