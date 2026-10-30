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
import { WaPill } from "@/components/whatsapp/ui/WaPill";
import {
  waButton,
  waTable,
  waTableWrap,
  waTd,
  waTemplateName,
  waTh,
  waTr,
  waTrClickable,
} from "@/components/whatsapp/ui/wa-classes";
import { WHATSAPP_THREAD_COLUMNS } from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppConversationListPage,
  WhatsAppConversationSummary,
} from "@/features/whatsapp/models/conversation.model";
import { getConversationColumn } from "@/features/whatsapp/utils/conversation-state.util";
import { cn } from "@/lib/utils";
import { AssigneeAvatar, formatConversationTime, getConversationTitle } from "./ConversationCard";
import { ConversationTags } from "./ConversationTags";
import { CONVERSATION_PENDING_REASON } from "./conversation-types";

const PAGINATION_BLOCKED_ID = "conversations-pagination-blocked";

function StatusCell({ conversation }: { conversation: WhatsAppConversationSummary }) {
  const column = getConversationColumn(conversation);
  return (
    <div className="flex flex-col items-start gap-1">
      {column === WHATSAPP_THREAD_COLUMNS.REPLIED && <WaPill tone="err">Respondió</WaPill>}
      {conversation.lastOutbound ? (
        <MessageStatusTicks status={conversation.lastOutbound.status} />
      ) : (
        <span className="text-xs text-wa-muted">Sin aviso saliente</span>
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
      <div className={waTableWrap}>
        <Table className={waTable}>
          <TableHeader>
            <TableRow className={waTr}>
              <TableHead className={waTh}>Último mensaje</TableHead>
              <TableHead className={waTh}>Pedido</TableHead>
              <TableHead className={waTh}>Cliente</TableHead>
              <TableHead className={waTh}>Plantilla</TableHead>
              <TableHead className={waTh}>Estado</TableHead>
              <TableHead className={waTh}>Asesora</TableHead>
              <TableHead className={waTh}>Rastreo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.map((conversation) => (
              <TableRow
                key={conversation.id}
                className={cn(waTr, waTrClickable)}
                onClick={() => onOpen(conversation.id)}
              >
                <TableCell className={cn(waTd, "wa-num whitespace-nowrap")}>
                  {formatConversationTime(conversation.lastMessageAt, now) ?? "—"}
                </TableCell>
                <TableCell className={cn(waTd, "whitespace-nowrap")}>
                  <b className="font-semibold">{conversation.orderNumber ?? "Sin pedido"}</b>
                  <span className="block text-xs text-wa-muted">{conversation.storeName}</span>
                </TableCell>
                <TableCell className={cn(waTd, "min-w-44")}>
                  <button
                    type="button"
                    className="cursor-pointer text-left underline-offset-2 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(conversation.id);
                    }}
                  >
                    {getConversationTitle(conversation)}
                    <span className="sr-only">, abrir conversación</span>
                  </button>
                  <span className="wa-num block text-xs text-wa-muted">{conversation.phone}</span>
                </TableCell>
                <TableCell className={cn(waTd, waTemplateName, "font-medium")}>
                  {conversation.lastOutbound?.templateName ?? "—"}
                </TableCell>
                <TableCell className={waTd}>
                  <StatusCell conversation={conversation} />
                </TableCell>
                <TableCell className={cn(waTd, "whitespace-nowrap")}>
                  <span className="inline-flex items-center gap-1.5">
                    <AssigneeAvatar name={conversation.assignee?.name ?? null} />
                    <span aria-hidden="true">{conversation.assignee?.name ?? "Sin asignar"}</span>
                  </span>
                </TableCell>
                <TableCell className={cn(waTd, "whitespace-nowrap")}>
                  {conversation.trackingOpened ? <WaPill tone="teal">Abrió</WaPill> : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <nav
        aria-label="Paginación de conversaciones"
        className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
      >
        <span className="text-wa-muted">
          {totalPages === null ? `Página ${page.page}` : `Página ${page.page} de ${totalPages}`}
        </span>
        <span className="flex gap-2">
          <Button
            type="button"
            className={waButton({ size: "sm" })}
            disabled={!canGoBack}
            aria-disabled={paginationBlocked && canGoBack ? true : undefined}
            aria-describedby={paginationBlocked && canGoBack ? PAGINATION_BLOCKED_ID : undefined}
            onClick={() => !paginationBlocked && onPageChange?.(page.page - 1)}
          >
            Anterior
          </Button>
          <Button
            type="button"
            className={waButton({ size: "sm" })}
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
        <p id={PAGINATION_BLOCKED_ID} className="m-0 text-xs text-wa-muted">
          {CONVERSATION_PENDING_REASON}
        </p>
      )}
    </div>
  );
}
