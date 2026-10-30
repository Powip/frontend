"use client";

import { Ban, Clock, Lock, Send, StickyNote } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WaCallout } from "@/components/whatsapp/ui/WaCallout";
import { waButton, waSelectTrigger, waTextarea } from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  CONVERSATION_LIMITS,
  WHATSAPP_QUICK_REPLIES,
} from "@/features/whatsapp/constants/whatsapp-conversation-catalog";
import type { WhatsAppConversationDetail } from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import {
  getSendableTemplates,
  isQuickReplyAvailable,
  resolveQuickReplyText,
  validateNoteText,
  validateReplyText,
} from "@/features/whatsapp/utils/conversation-composer.util";
import type { ReplyWindowStatus } from "@/features/whatsapp/utils/reply-window.util";
import { cn } from "@/lib/utils";
import { TemplateSegmentedChoice } from "../plantillas/TemplateSegmentedChoice";
import {
  type ActionStatus,
  CONVERSATION_PENDING_REASON,
  type ConversationMutations,
  IDLE,
  toActionError,
} from "./conversation-types";

type ComposerMode = "reply" | "note";

const MODE_OPTIONS = [
  { value: "reply" as const, label: "Responder al comprador" },
  { value: "note" as const, label: "Nota interna" },
];

const UNKNOWN_WINDOW_REASON =
  "No se puede enviar: POWIP no confirmó si la ventana de 24 h está abierta. Tu texto se conserva.";
const OPTED_OUT_REASON =
  "El comprador se dio de baja: no se le pueden enviar mensajes ni plantillas.";
const NO_TRACKING_REASON = "Este pedido no tiene link de rastreo disponible.";

interface ConversationComposerProps {
  conversation: WhatsAppConversationDetail;
  window: ReplyWindowStatus;
  templates: ResourceState<WhatsAppTemplate[]>;
  canReply: boolean;
  mutations: ConversationMutations;
  onDirtyChange: (dirty: boolean) => void;
}

function StatusMessage({ status, suffix }: { status: ActionStatus; suffix?: string }) {
  if (status.kind === "pending") {
    return (
      <p role="status" className="m-0 text-xs text-wa-muted">
        Enviando…
      </p>
    );
  }
  if (status.kind === "error") {
    return (
      <p role="alert" className="m-0 text-xs font-medium text-wa-red">
        {status.message}
        {suffix && ` ${suffix}`}
      </p>
    );
  }
  return null;
}

function CharacterCount({ value, max }: { value: string; max: number }) {
  return (
    <span className="wa-num text-[11px] text-wa-muted">
      {value.length.toLocaleString("es-PE")}/{max.toLocaleString("es-PE")}
    </span>
  );
}

export function ConversationComposer({
  conversation,
  window,
  templates,
  canReply,
  mutations,
  onDirtyChange,
}: ConversationComposerProps) {
  const replyId = useId();
  const noteId = useId();
  const replyBlockedId = useId();
  const templateBlockedId = useId();
  const noteBlockedId = useId();
  const quickReplyBlockedId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<ComposerMode>("reply");
  const [replyDraft, setReplyDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [replyStatus, setReplyStatus] = useState<ActionStatus>(IDLE);
  const [templateStatus, setTemplateStatus] = useState<ActionStatus>(IDLE);
  const [noteStatus, setNoteStatus] = useState<ActionStatus>(IDLE);

  const dirty = replyDraft.trim().length > 0 || noteDraft.trim().length > 0 || templateId !== "";

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  if (!canReply) {
    return (
      <p className="m-0 flex items-start gap-2 rounded-xl border border-wa-border bg-wa-surface-2 px-3.5 py-3 text-[13px] text-wa-muted">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        No tienes permiso para responder ni dejar notas en esta conversación.
      </p>
    );
  }

  const optedOut = conversation.optedOut;
  const windowOpen = window.state === "open";
  const quickReplyContext = {
    customerName: conversation.customerName,
    trackingUrl: conversation.trackingUrl,
  };

  const replyBlockedReason = optedOut
    ? OPTED_OUT_REASON
    : window.state === "unknown"
      ? UNKNOWN_WINDOW_REASON
      : !mutations.sendReply
        ? CONVERSATION_PENDING_REASON
        : null;
  const replyBlocked = replyBlockedReason !== null || replyStatus.kind === "pending";

  const templateBlockedReason = optedOut
    ? OPTED_OUT_REASON
    : window.state === "unknown"
      ? UNKNOWN_WINDOW_REASON
      : !mutations.sendTemplate
        ? CONVERSATION_PENDING_REASON
        : null;

  const noteBlockedReason = mutations.addNote ? null : CONVERSATION_PENDING_REASON;

  const applyQuickReply = (text: string) => {
    const next = replyDraft.trim().length === 0 ? text : `${replyDraft.trimEnd()} ${text}`;
    setReplyDraft(next);
    setReplyError(null);
    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(next.length, next.length);
    });
  };

  const submitReply = async () => {
    if (replyBlocked || !mutations.sendReply) return;
    const error = validateReplyText(replyDraft);
    setReplyError(error);
    if (error) return;
    setReplyStatus({ kind: "pending" });
    try {
      await mutations.sendReply({
        conversationId: conversation.id,
        text: replyDraft,
        version: conversation.version,
      });
      setReplyDraft("");
      setReplyStatus(IDLE);
    } catch (caught) {
      setReplyStatus(toActionError(caught, "No se pudo enviar el mensaje."));
    }
  };

  const submitTemplate = async () => {
    if (templateBlockedReason || !mutations.sendTemplate || templateStatus.kind === "pending") {
      return;
    }
    if (!templateId) {
      setTemplateStatus({ kind: "error", message: "Elige una plantilla aprobada." });
      return;
    }
    setTemplateStatus({ kind: "pending" });
    try {
      await mutations.sendTemplate({
        conversationId: conversation.id,
        templateId,
        version: conversation.version,
      });
      setTemplateId("");
      setTemplateStatus(IDLE);
    } catch (caught) {
      setTemplateStatus(toActionError(caught, "No se pudo enviar la plantilla."));
    }
  };

  const submitNote = async () => {
    if (noteBlockedReason || !mutations.addNote || noteStatus.kind === "pending") return;
    const error = validateNoteText(noteDraft);
    setNoteError(error);
    if (error) return;
    setNoteStatus({ kind: "pending" });
    try {
      await mutations.addNote({ conversationId: conversation.id, text: noteDraft });
      setNoteDraft("");
      setNoteStatus(IDLE);
    } catch (caught) {
      setNoteStatus(toActionError(caught, "No se pudo guardar la nota."));
    }
  };

  const showTemplatePicker = !optedOut && window.state !== "open";

  return (
    <div className="flex flex-col gap-2">
      <TemplateSegmentedChoice
        legend="Qué quieres escribir"
        name={`composer-mode-${conversation.id}`}
        value={mode}
        options={MODE_OPTIONS}
        onValueChange={setMode}
        className="[&>div]:w-fit [&>legend]:sr-only [&_label]:px-2.5 [&_label]:py-1 [&_label]:text-xs"
      />

      {mode === "reply" && (
        <div className="flex flex-col gap-2">
          {optedOut && (
            <WaCallout tone="red" icon={Ban} compact>
              {OPTED_OUT_REASON}
            </WaCallout>
          )}

          {!optedOut && window.state === "closed" && replyDraft.trim().length > 0 && (
            <div role="status">
              <WaCallout tone="amber" icon={Clock} compact>
                La ventana de 24 h se cerró. Tu texto se conserva, pero ya no se puede enviar como
                texto libre: envía una plantilla aprobada.
              </WaCallout>
            </div>
          )}

          {!optedOut && windowOpen && (
            <div className="flex flex-col gap-1">
              <p className="sr-only">Respuestas rápidas</p>
              <div className="flex flex-wrap gap-1.5">
                {WHATSAPP_QUICK_REPLIES.map((reply) => {
                  const available = isQuickReplyAvailable(reply, quickReplyContext);
                  return (
                    <BlockedActionButton
                      key={reply.id}
                      className="h-auto rounded-full border border-wa-border bg-wa-surface-2 px-2.5 py-[5px] text-xs font-normal text-wa-fg shadow-none hover:border-wa-teal hover:bg-wa-surface-2 hover:text-wa-teal focus-visible:border-wa-border focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary"
                      blocked={!available}
                      blockedReasonId={quickReplyBlockedId}
                      onClick={() => {
                        const text = resolveQuickReplyText(reply, quickReplyContext);
                        if (text) applyQuickReply(text);
                      }}
                    >
                      {reply.label}
                    </BlockedActionButton>
                  );
                })}
              </div>
              <p className="m-0 text-[11px] text-wa-muted">
                Completan el cuadro de texto; no envían nada ni cambian el pedido.
              </p>
              {!conversation.trackingUrl && (
                <p id={quickReplyBlockedId} className="m-0 text-[11px] text-wa-muted">
                  {NO_TRACKING_REASON}
                </p>
              )}
            </div>
          )}

          {(windowOpen || window.state === "unknown" || replyDraft.length > 0) && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={replyId} className="sr-only">
                  Mensaje al comprador
                </label>
                <CharacterCount value={replyDraft} max={CONVERSATION_LIMITS.replyMaxLength} />
              </div>
              <div className="flex items-end gap-2.5">
                <Textarea
                  id={replyId}
                  ref={textareaRef}
                  value={replyDraft}
                  readOnly={optedOut || window.state === "closed"}
                  onChange={(event) => {
                    setReplyDraft(event.target.value);
                    if (replyError) setReplyError(null);
                  }}
                  rows={1}
                  className={cn(waTextarea, "h-11 max-h-40 min-h-11 flex-1")}
                  placeholder="Escribe una respuesta…"
                  aria-invalid={replyError ? true : undefined}
                  aria-describedby={replyError ? `${replyId}-error` : undefined}
                />
                {window.state !== "closed" && (
                  <BlockedActionButton
                    aria-label="Enviar"
                    className={waButton({ variant: "whatsapp", size: "icon-lg" })}
                    blocked={replyBlocked}
                    blockedReasonId={replyBlockedId}
                    onClick={submitReply}
                  >
                    <Send aria-hidden="true" />
                  </BlockedActionButton>
                )}
              </div>
              {replyError && (
                <p id={`${replyId}-error`} className="m-0 text-xs font-medium text-wa-red">
                  {replyError}
                </p>
              )}
              <StatusMessage status={replyStatus} suffix="Tu texto se conserva." />
              {window.state === "closed" && replyDraft.length > 0 && (
                <Button
                  type="button"
                  className={cn(waButton({ variant: "ghost", size: "sm" }), "self-end")}
                  onClick={() => setReplyDraft("")}
                >
                  Descartar texto
                </Button>
              )}
              {replyBlockedReason && window.state !== "closed" && (
                <p id={replyBlockedId} className="m-0 text-xs text-wa-muted">
                  {replyBlockedReason}
                </p>
              )}
            </div>
          )}

          {showTemplatePicker && (
            <div className="flex flex-col gap-2">
              <WhatsAppResourceState
                state={templates}
                pendingTitle="Plantillas pendientes de integración"
                pendingDescription="Cuando el servicio esté disponible verás aquí las plantillas aprobadas por Meta para esta tienda."
                loadingLabel="Cargando plantillas aprobadas"
                errorTitle="No se pudieron cargar las plantillas"
              >
                {(data) => {
                  const sendable = getSendableTemplates(data, conversation.storeId);
                  if (sendable.length === 0) {
                    return (
                      <p className="m-0 text-[13px] text-wa-muted">
                        No hay plantillas aprobadas para esta tienda.
                      </p>
                    );
                  }
                  const selected = sendable.find((template) => template.id === templateId);
                  const selectedBody = selected?.approvedVersion?.body ?? selected?.body ?? null;
                  return (
                    <div className="flex flex-col gap-2">
                      <Select
                        value={templateId || undefined}
                        onValueChange={(value) => {
                          if (!value || value === templateId) return;
                          setTemplateId(value);
                          if (templateStatus.kind === "error") setTemplateStatus(IDLE);
                        }}
                      >
                        <SelectTrigger className={waSelectTrigger} aria-label="Plantilla aprobada">
                          <SelectValue placeholder="Elige una plantilla" />
                        </SelectTrigger>
                        <SelectContent>
                          {sendable.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedBody && (
                        <p className="m-0 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-wa-surface-2 px-2.5 py-2 text-xs [overflow-wrap:anywhere]">
                          {selectedBody}
                        </p>
                      )}
                    </div>
                  );
                }}
              </WhatsAppResourceState>
              <StatusMessage status={templateStatus} />
              <BlockedActionButton
                className={cn(waButton({ variant: "whatsapp" }), "self-end")}
                blocked={templateBlockedReason !== null || templateStatus.kind === "pending"}
                blockedReasonId={templateBlockedId}
                onClick={submitTemplate}
              >
                <Send aria-hidden="true" />
                Enviar plantilla
              </BlockedActionButton>
              {templateBlockedReason && (
                <p id={templateBlockedId} className="m-0 text-xs text-wa-muted">
                  {templateBlockedReason}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {mode === "note" && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={noteId} className="flex items-center gap-1.5 text-[13px] font-medium">
              <StickyNote className="size-4 text-wa-amber" aria-hidden="true" />
              Nota interna
            </label>
            <CharacterCount value={noteDraft} max={CONVERSATION_LIMITS.noteMaxLength} />
          </div>
          <Textarea
            id={noteId}
            value={noteDraft}
            onChange={(event) => {
              setNoteDraft(event.target.value);
              if (noteError) setNoteError(null);
            }}
            rows={2}
            className={cn(waTextarea, "max-h-40 min-h-16 bg-wa-amber-soft/40")}
            placeholder="Solo la ve tu equipo"
            aria-invalid={noteError ? true : undefined}
            aria-describedby={`${noteId}-hint${noteError ? ` ${noteId}-error` : ""}`}
          />
          <p id={`${noteId}-hint`} className="m-0 text-[11px] text-wa-muted">
            No se envía al comprador y no cambia el pedido.
          </p>
          {noteError && (
            <p id={`${noteId}-error`} className="m-0 text-xs font-medium text-wa-red">
              {noteError}
            </p>
          )}
          <StatusMessage status={noteStatus} suffix="Tu nota se conserva." />
          <BlockedActionButton
            className={cn(waButton({ size: "sm" }), "self-end")}
            blocked={noteBlockedReason !== null || noteStatus.kind === "pending"}
            blockedReasonId={noteBlockedId}
            onClick={submitNote}
          >
            Guardar nota
          </BlockedActionButton>
          {noteBlockedReason && (
            <p id={noteBlockedId} className="m-0 text-xs text-wa-muted">
              {noteBlockedReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
