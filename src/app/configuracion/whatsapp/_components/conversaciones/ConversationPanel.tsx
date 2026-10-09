"use client";

import { Ban, CheckCircle2, Clock, ExternalLink, RotateCw, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { MessageStatusTicks } from "@/components/whatsapp/MessageStatusTicks";
import { WhatsAppThread } from "@/components/whatsapp/WhatsAppThread";
import { CONVERSATION_WINDOW_TICK_MS } from "@/features/whatsapp/constants/whatsapp-conversation-catalog";
import { useTickingNow } from "@/features/whatsapp/hooks/use-ticking-now";
import type {
  WhatsAppAgentOption,
  WhatsAppConversationCapabilities,
  WhatsAppConversationDetail,
} from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import {
  canMarkAttended,
  describeWaiting,
} from "@/features/whatsapp/utils/conversation-state.util";
import { isNotSentStatus } from "@/features/whatsapp/utils/message-status.util";
import {
  describeReplyWindow,
  type ReplyWindowStatus,
  resolveReplyWindow,
} from "@/features/whatsapp/utils/reply-window.util";
import { cn } from "@/lib/utils";
import { describeConversationContext } from "./ConversationCard";
import { ConversationComposer } from "./ConversationComposer";
import { ConversationTags } from "./ConversationTags";
import {
  type ActionStatus,
  CONVERSATION_PENDING_REASON,
  type ConversationMutations,
  IDLE,
  toActionError,
} from "./conversation-types";
import { OptOutDialog } from "./OptOutDialog";

export type UseStoreAgents = (
  storeId: string | null,
  enabled: boolean,
) => ResourceState<WhatsAppAgentOption[]>;

const NO_ORDER_REASON = "Esta conversación no tiene un pedido asociado.";

interface ConversationPanelProps {
  conversation: WhatsAppConversationDetail;
  templates: ResourceState<WhatsAppTemplate[]>;
  capabilities: WhatsAppConversationCapabilities;
  mutations: ConversationMutations;
  currentUserId: string | null;
  useStoreAgents: UseStoreAgents;
  baseNow?: Date;
  onOpenOrder: (orderId: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}

function WindowBanner({ window }: { window: ReplyWindowStatus }) {
  const { title, detail } = describeReplyWindow(window);
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        window.state === "open" &&
          "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200",
        window.state === "closed" &&
          "bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100",
        window.state === "unknown" && "bg-muted text-muted-foreground",
      )}
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold">{title}</span> · {detail}
      </span>
    </p>
  );
}

function AssignmentSection({
  conversation,
  capabilities,
  mutations,
  currentUserId,
  useStoreAgents,
}: Pick<
  ConversationPanelProps,
  "conversation" | "capabilities" | "mutations" | "currentUserId" | "useStoreAgents"
>) {
  const blockedId = useId();
  const canChange = capabilities.reassign && !!mutations.reassign;
  const agents = useStoreAgents(conversation.storeId, canChange);
  const [status, setStatus] = useState<ActionStatus>(IDLE);
  const assigneeName = conversation.assignee?.name ?? "Sin asignar";
  const assignedToSomeoneElse =
    !!conversation.assignee && conversation.assignee.id !== currentUserId;

  const reassign = async (assigneeId: string) => {
    if (!mutations.reassign || assigneeId === conversation.assignee?.id) return;
    setStatus({ kind: "pending" });
    try {
      await mutations.reassign({
        conversationId: conversation.id,
        assigneeId,
        version: conversation.version,
      });
      setStatus(IDLE);
    } catch (caught) {
      setStatus(toActionError(caught, "No se pudo reasignar la conversación."));
    }
  };

  return (
    <div className="space-y-1.5 text-sm">
      {canChange && agents.kind === "ready" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Asignada a</span>
          <Select
            value={conversation.assignee?.id}
            disabled={status.kind === "pending"}
            onValueChange={(value) => {
              if (value) void reassign(value);
            }}
          >
            <SelectTrigger className="h-8 w-56" aria-label="Asignada a">
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              {agents.data.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            <span className="text-muted-foreground">Asignada a </span>
            <span className="font-medium">{assigneeName}</span>
          </span>
          {capabilities.reassign && (
            <BlockedActionButton
              variant="outline"
              size="sm"
              className="h-7"
              blocked
              blockedReasonId={blockedId}
            >
              Reasignar
            </BlockedActionButton>
          )}
        </div>
      )}
      {capabilities.reassign && !canChange && (
        <p id={blockedId} className="text-xs text-muted-foreground">
          {CONVERSATION_PENDING_REASON}
        </p>
      )}
      {canChange && agents.kind === "loading" && (
        <p className="text-xs text-muted-foreground">Cargando asesoras…</p>
      )}
      {canChange && agents.kind === "error" && (
        <p className="text-xs text-red-700 dark:text-red-300">{agents.message}</p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
          {status.message}
        </p>
      )}
      {assignedToSomeoneElse && capabilities.reply && (
        <p className="text-xs text-muted-foreground">
          La asignación no te impide responder: los demás verán tu mensaje en el hilo.
        </p>
      )}
    </div>
  );
}

function FailedNotice({
  conversation,
  canRetry,
  retry,
  onOpenOrder,
}: {
  conversation: WhatsAppConversationDetail;
  canRetry: boolean;
  retry: ConversationMutations["retry"];
  onOpenOrder: (orderId: string) => void;
}) {
  const retryBlockedId = useId();
  const correctBlockedId = useId();
  const [status, setStatus] = useState<ActionStatus>(IDLE);
  const lastOutbound = conversation.lastOutbound;
  if (!lastOutbound || !isNotSentStatus(lastOutbound.status)) return null;
  const messageId = lastOutbound.messageId;
  const retryReason = !canRetry
    ? "No tienes permiso para reintentar avisos."
    : !retry
      ? CONVERSATION_PENDING_REASON
      : !messageId
        ? "Falta el identificador del aviso para reintentarlo."
        : null;

  const runRetry = async () => {
    if (retryReason || !retry || !messageId || status.kind === "pending") return;
    setStatus({ kind: "pending" });
    try {
      await retry({ conversationId: conversation.id, messageId });
      setStatus(IDLE);
    } catch (caught) {
      setStatus(toActionError(caught, "No se pudo reintentar el aviso."));
    }
  };

  return (
    <section
      aria-label="Aviso no enviado"
      className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100"
    >
      <p className="flex items-start gap-2 font-medium">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="[overflow-wrap:anywhere]">
          No enviado: {lastOutbound.failureReason ?? "motivo sin informar"}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <BlockedActionButton
          variant="outline"
          size="sm"
          blocked={!conversation.orderId}
          blockedReasonId={correctBlockedId}
          onClick={() => conversation.orderId && onOpenOrder(conversation.orderId)}
        >
          Corregir en el pedido
        </BlockedActionButton>
        <BlockedActionButton
          variant="outline"
          size="sm"
          blocked={retryReason !== null || status.kind === "pending"}
          blockedReasonId={retryBlockedId}
          onClick={runRetry}
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Reintentar
        </BlockedActionButton>
      </div>
      {!conversation.orderId && (
        <p id={correctBlockedId} className="text-xs">
          {NO_ORDER_REASON}
        </p>
      )}
      {retryReason && (
        <p id={retryBlockedId} className="text-xs">
          {retryReason}
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="text-xs font-medium">
          {status.message}
        </p>
      )}
      <p className="text-xs">
        Cuando corrijas el dato, el aviso sale solo si el pedido sigue en el mismo estado.
      </p>
    </section>
  );
}

export function ConversationPanel({
  conversation,
  templates,
  capabilities,
  mutations,
  currentUserId,
  useStoreAgents,
  baseNow,
  onOpenOrder,
  onDirtyChange,
}: ConversationPanelProps) {
  const viewOrderBlockedId = useId();
  const attendBlockedId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [optOutOpen, setOptOutOpen] = useState(false);
  const [attendStatus, setAttendStatus] = useState<ActionStatus>(IDLE);
  const expiresAt =
    conversation.replyWindow?.open === true ? conversation.replyWindow.expiresAt : null;
  const now = useTickingNow({
    baseNow,
    intervalMs: CONVERSATION_WINDOW_TICK_MS,
    nextChangeAt: expiresAt,
  });
  const window = resolveReplyWindow(conversation.replyWindow, now);
  const waiting = describeWaiting(conversation, now);
  const messageCount = conversation.messages.length;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || messageCount === 0) return;
    element.scrollTop = element.scrollHeight;
  }, [messageCount]);

  const attendReason = !mutations.markAttended ? CONVERSATION_PENDING_REASON : null;

  const markAttended = async () => {
    if (attendReason || !mutations.markAttended || attendStatus.kind === "pending") return;
    setAttendStatus({ kind: "pending" });
    try {
      await mutations.markAttended({
        conversationId: conversation.id,
        version: conversation.version,
      });
      setAttendStatus(IDLE);
    } catch (caught) {
      setAttendStatus(toActionError(caught, "No se pudo marcar como atendida."));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Teléfono</dt>
          <dd className="font-medium">{conversation.phone}</dd>
          <dt className="text-muted-foreground">Pedido</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">
            {describeConversationContext(conversation)}
          </dd>
          <dt className="text-muted-foreground">Último aviso</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {conversation.lastOutbound ? (
              <>
                <MessageStatusTicks status={conversation.lastOutbound.status} showDetail />
                {conversation.lastOutbound.templateName && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {conversation.lastOutbound.templateName}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Sin aviso saliente</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Atención</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {conversation.attention.pendingReply ? (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-red-500">
                Respondió · sin atender
              </span>
            ) : conversation.attention.attended ? null : (
              <span className="text-muted-foreground">Sin respuestas pendientes</span>
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
            <ConversationTags conversation={conversation} />
          </dd>
        </dl>

        <AssignmentSection
          conversation={conversation}
          capabilities={capabilities}
          mutations={mutations}
          currentUserId={currentUserId}
          useStoreAgents={useStoreAgents}
        />

        <div className="flex flex-wrap gap-2">
          <BlockedActionButton
            variant="outline"
            size="sm"
            blocked={!conversation.orderId}
            blockedReasonId={viewOrderBlockedId}
            onClick={() => conversation.orderId && onOpenOrder(conversation.orderId)}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Ver pedido
          </BlockedActionButton>
          {canMarkAttended(conversation) && capabilities.reply && (
            <BlockedActionButton
              variant="outline"
              size="sm"
              blocked={attendReason !== null || attendStatus.kind === "pending"}
              blockedReasonId={attendBlockedId}
              onClick={markAttended}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Marcar atendida
            </BlockedActionButton>
          )}
          {capabilities.manageOptOuts && !conversation.optedOut && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-red-700 dark:text-red-300"
              onClick={() => setOptOutOpen(true)}
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
              Dar de baja
            </Button>
          )}
        </div>
        {!conversation.orderId && (
          <p id={viewOrderBlockedId} className="text-xs text-muted-foreground">
            {NO_ORDER_REASON}
          </p>
        )}
        {canMarkAttended(conversation) && capabilities.reply && attendReason && (
          <p id={attendBlockedId} className="text-xs text-muted-foreground">
            {attendReason}
          </p>
        )}
        {attendStatus.kind === "error" && (
          <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
            {attendStatus.message}
          </p>
        )}
        {canMarkAttended(conversation) && (
          <p className="text-xs text-muted-foreground">
            Marcar atendida no indica que el comprador leyó un mensaje.
          </p>
        )}

        <WindowBanner window={window} />

        <FailedNotice
          conversation={conversation}
          canRetry={capabilities.reply}
          retry={mutations.retry}
          onOpenOrder={onOpenOrder}
        />

        <WhatsAppThread messages={conversation.messages} now={now} />
      </div>

      <div className="max-h-[55dvh] shrink-0 overflow-y-auto border-t bg-background px-4 py-3">
        <ConversationComposer
          conversation={conversation}
          window={window}
          templates={templates}
          canReply={capabilities.reply}
          mutations={mutations}
          onDirtyChange={onDirtyChange}
        />
      </div>

      {optOutOpen && (
        <OptOutDialog
          conversation={conversation}
          optOut={mutations.optOut}
          onClose={() => setOptOutOpen(false)}
        />
      )}
    </div>
  );
}
