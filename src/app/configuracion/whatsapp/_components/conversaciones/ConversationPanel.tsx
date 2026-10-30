"use client";

import { Check, Pencil, RotateCw, TriangleAlert } from "lucide-react";
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
import { WaDot, WaMini, WaPill } from "@/components/whatsapp/ui/WaPill";
import { waButton, waSelectTriggerSm } from "@/components/whatsapp/ui/wa-classes";
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
import { AssigneeAvatar } from "./ConversationCard";
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

function WindowBar({ window }: { window: ReplyWindowStatus }) {
  const { title, detail } = describeReplyWindow(window);
  return (
    <p role="status" className="m-0 flex items-start gap-2 text-xs">
      {window.state === "open" ? (
        <>
          <WaDot className="mt-[5px] size-[7px]" />
          <span className="min-w-0">
            <span className="font-semibold">{title}</span> · {detail}
          </span>
        </>
      ) : (
        <>
          <WaMini tone={window.state === "closed" ? "neutral" : "warn"} className="shrink-0">
            {title}
          </WaMini>
          <span className="min-w-0 text-wa-muted">{detail}</span>
        </>
      )}
    </p>
  );
}

function useAssignmentControl({
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
  const assigneeName = conversation.assignee?.name ?? null;
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

  return {
    control:
      canChange && agents.kind === "ready" ? (
        <Select
          value={conversation.assignee?.id}
          disabled={status.kind === "pending"}
          onValueChange={(value) => {
            if (value) void reassign(value);
          }}
        >
          <SelectTrigger className={cn(waSelectTriggerSm, "ml-auto")} aria-label="Asignada a">
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
      ) : (
        <span className="ml-auto flex items-center gap-1.5 text-xs">
          <AssigneeAvatar name={assigneeName} />
          <span aria-hidden="true">{assigneeName ?? "Sin asignar"}</span>
          {capabilities.reassign && (
            <BlockedActionButton
              className={waButton({ variant: "ghost", size: "sm" })}
              blocked
              blockedReasonId={blockedId}
            >
              Reasignar
            </BlockedActionButton>
          )}
        </span>
      ),
    notes: (
      <>
        {capabilities.reassign && !canChange && (
          <p id={blockedId} className="m-0 text-[11px] text-wa-muted">
            Reasignar: {CONVERSATION_PENDING_REASON}
          </p>
        )}
        {canChange && agents.kind === "loading" && (
          <p className="m-0 text-[11px] text-wa-muted">Cargando asesoras…</p>
        )}
        {canChange && agents.kind === "error" && (
          <p className="m-0 text-[11px] text-wa-red">{agents.message}</p>
        )}
        {status.kind === "error" && (
          <p role="alert" className="m-0 text-xs font-medium text-wa-red">
            {status.message}
          </p>
        )}
        {assignedToSomeoneElse && capabilities.reply && (
          <p className="m-0 text-[11px] text-wa-muted">
            La asignación no te impide responder: los demás verán tu mensaje en el hilo.
          </p>
        )}
      </>
    ),
  };
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
      className="flex flex-col gap-2 rounded-[10px] bg-wa-red-soft px-3 py-2.5 text-xs text-wa-fg"
    >
      <p className="m-0 flex items-start gap-2 font-medium">
        <TriangleAlert className="mt-px size-4 shrink-0 text-wa-red" aria-hidden="true" />
        <span className="[overflow-wrap:anywhere]">
          No enviado: {lastOutbound.failureReason ?? "motivo sin informar"}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <BlockedActionButton
          className={waButton({ variant: "primary", size: "sm" })}
          blocked={!conversation.orderId}
          blockedReasonId={correctBlockedId}
          onClick={() => conversation.orderId && onOpenOrder(conversation.orderId)}
        >
          <Pencil aria-hidden="true" />
          Corregir en el pedido
        </BlockedActionButton>
        <BlockedActionButton
          className={waButton({ size: "sm" })}
          blocked={retryReason !== null || status.kind === "pending"}
          blockedReasonId={retryBlockedId}
          onClick={runRetry}
        >
          <RotateCw aria-hidden="true" />
          Reintentar
        </BlockedActionButton>
      </div>
      {!conversation.orderId && (
        <p id={correctBlockedId} className="m-0 text-[11px] text-wa-muted">
          {NO_ORDER_REASON}
        </p>
      )}
      {retryReason && (
        <p id={retryBlockedId} className="m-0 text-[11px] text-wa-muted">
          {retryReason}
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="m-0 font-medium text-wa-red">
          {status.message}
        </p>
      )}
      <p className="m-0 text-[11px] text-wa-muted">
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
  const assignment = useAssignmentControl({
    conversation,
    capabilities,
    mutations,
    currentUserId,
    useStoreAgents,
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || messageCount === 0) return;
    element.scrollTop = element.scrollHeight;
  }, [messageCount]);

  const attendReason = !mutations.markAttended ? CONVERSATION_PENDING_REASON : null;
  const showAttend = canMarkAttended(conversation) && capabilities.reply;

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
      <div className="flex shrink-0 flex-col gap-2 border-b border-wa-border px-[18px] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {conversation.attention.pendingReply ? (
            <WaPill tone="err">
              Respondió<span className="sr-only"> · sin atender</span>
            </WaPill>
          ) : conversation.lastOutbound ? (
            <MessageStatusTicks status={conversation.lastOutbound.status} showDetail />
          ) : (
            <span className="text-xs text-wa-muted">Sin aviso saliente</span>
          )}
          <ConversationTags conversation={conversation} />
          {waiting && <WaMini tone={waiting.overdue ? "err" : "warn"}>{waiting.text}</WaMini>}
          {assignment.control}
        </div>
        <WindowBar window={window} />
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-wa-chat-bg px-3 py-3.5"
      >
        <span className="self-center rounded-[7px] bg-wa-bubble px-2.5 py-[3px] text-[11px] uppercase text-wa-muted">
          Conversación del pedido
        </span>
        <FailedNotice
          conversation={conversation}
          canRetry={capabilities.reply}
          retry={mutations.retry}
          onOpenOrder={onOpenOrder}
        />
        <WhatsAppThread
          messages={conversation.messages}
          now={now}
          className="rounded-none bg-transparent p-0"
        />
      </div>

      <div className="flex max-h-[55dvh] shrink-0 flex-col gap-2 overflow-y-auto border-t border-wa-border px-3.5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
        <ConversationComposer
          conversation={conversation}
          window={window}
          templates={templates}
          canReply={capabilities.reply}
          mutations={mutations}
          onDirtyChange={onDirtyChange}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <BlockedActionButton
              className={waButton({ size: "sm" })}
              blocked={!conversation.orderId}
              blockedReasonId={viewOrderBlockedId}
              onClick={() => conversation.orderId && onOpenOrder(conversation.orderId)}
            >
              Ver pedido
            </BlockedActionButton>
            {capabilities.manageOptOuts && !conversation.optedOut && (
              <Button
                type="button"
                className={waButton({ variant: "ghost-danger", size: "sm" })}
                onClick={() => setOptOutOpen(true)}
              >
                Dar de baja
              </Button>
            )}
          </div>
          {showAttend && (
            <BlockedActionButton
              className={waButton({ variant: "primary", size: "sm" })}
              blocked={attendReason !== null || attendStatus.kind === "pending"}
              blockedReasonId={attendBlockedId}
              onClick={markAttended}
            >
              <Check aria-hidden="true" />
              Marcar atendida
            </BlockedActionButton>
          )}
        </div>
        {!conversation.orderId && (
          <p id={viewOrderBlockedId} className="m-0 text-[11px] text-wa-muted">
            {NO_ORDER_REASON}
          </p>
        )}
        {showAttend && attendReason && (
          <p id={attendBlockedId} className="m-0 text-[11px] text-wa-muted">
            Marcar atendida: {attendReason}
          </p>
        )}
        {attendStatus.kind === "error" && (
          <p role="alert" className="m-0 text-xs font-medium text-wa-red">
            {attendStatus.message}
          </p>
        )}
        {canMarkAttended(conversation) && (
          <p className="m-0 text-[11px] text-wa-muted">
            Marcar atendida no indica que el comprador leyó un mensaje.
          </p>
        )}
        {assignment.notes}
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
