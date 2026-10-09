import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MessageStatusTicks } from "@/components/whatsapp/MessageStatusTicks";
import { WHATSAPP_THREAD_COLUMNS } from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppConversationListPage,
  WhatsAppConversationSummary,
} from "@/features/whatsapp/models/conversation.model";
import { getConversationColumn } from "@/features/whatsapp/utils/conversation-state.util";
import { formatConversationTime, getConversationTitle } from "./ConversationCard";
import { ConversationTags } from "./ConversationTags";
import { CONVERSATION_PENDING_REASON } from "./conversation-types";

const PAGINATION_BLOCKED_ID = "conversations-pagination-blocked";

function StatusCell({ conversation }: { conversation: WhatsAppConversationSummary }) {
  const column = getConversationColumn(conversation);
  return (
    <div className="flex flex-col items-start gap-1">
      {column === WHATSAPP_THREAD_COLUMNS.REPLIED && (
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-red-500">
          Respondió
        </span>
      )}
      {conversation.lastOutbound ? (
        <MessageStatusTicks status={conversation.lastOutbound.status} />
      ) : (
        <span className="text-xs text-muted-foreground">Sin aviso saliente</span>
      )}
      <ConversationTags conversation={conversation} />
    </div>
  );
}

interface ConversationsTableProps {
  page: WhatsAppConversationListPage;
  now: Date;
  onOpen: (conversationId: string) => void;
  onPageChange?: (page: number) => void;
}

export function ConversationsTable({ page, now, onOpen, onPageChange }: ConversationsTableProps) {
  const totalPages =
    page.total === null ? null : Math.max(1, Math.ceil(page.total / page.pageSize));
  const canGoBack = page.page > 1;
  const canGoForward = page.hasMore;
  const paginationBlocked = !onPageChange;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Último mensaje</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Plantilla</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Asesora</TableHead>
              <TableHead>Rastreo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.map((conversation) => (
              <TableRow
                key={conversation.id}
                className="cursor-pointer"
                onClick={() => onOpen(conversation.id)}
              >
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatConversationTime(conversation.lastMessageAt, now) ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {conversation.orderNumber ?? "Sin pedido"}
                  <span className="block text-xs text-muted-foreground">
                    {conversation.storeName}
                  </span>
                </TableCell>
                <TableCell className="min-w-44">
                  <button
                    type="button"
                    className="text-left font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(conversation.id);
                    }}
                  >
                    {getConversationTitle(conversation)}
                    <span className="sr-only">, abrir conversación</span>
                  </button>
                  <span className="block text-xs text-muted-foreground">{conversation.phone}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {conversation.lastOutbound?.templateName ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusCell conversation={conversation} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {conversation.assignee?.name ?? "Sin asignar"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {conversation.trackingOpened ? "Abrió" : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <nav
        aria-label="Paginación de conversaciones"
        className="flex flex-wrap items-center justify-between gap-2 text-sm"
      >
        <span className="text-muted-foreground">
          {totalPages === null ? `Página ${page.page}` : `Página ${page.page} de ${totalPages}`}
        </span>
        <span className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoBack}
            aria-disabled={paginationBlocked && canGoBack ? true : undefined}
            aria-describedby={paginationBlocked && canGoBack ? PAGINATION_BLOCKED_ID : undefined}
            onClick={() => !paginationBlocked && onPageChange?.(page.page - 1)}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoForward}
            aria-disabled={paginationBlocked && canGoForward ? true : undefined}
            aria-describedby={paginationBlocked && canGoForward ? PAGINATION_BLOCKED_ID : undefined}
            onClick={() => !paginationBlocked && onPageChange?.(page.page + 1)}
          >
            Siguiente
          </Button>
        </span>
      </nav>
      {paginationBlocked && (canGoBack || canGoForward) && (
        <p id={PAGINATION_BLOCKED_ID} className="text-xs text-muted-foreground">
          {CONVERSATION_PENDING_REASON}
        </p>
      )}
    </div>
  );
}
