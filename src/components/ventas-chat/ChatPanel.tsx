"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  PanelRight,
  Send,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useCrmSettings } from "@/hooks/useCrmTeam";
import { crmError } from "@/services/crmService";
import {
  useAutoLinkClient,
  useConversation,
  useConversationClient,
  useLoadOlder,
  useMarkRead,
  useMessages,
  useSendMessage,
  useSendNote,
  useUpdateConversation,
} from "@/hooks/useCrmChat";
import type { Conversation, Message } from "@/types/crm";
import { CRM_UNREACHABLE } from "./ConversationList";
import ChannelBadge from "./ChannelBadge";
import { ChatCallButtons } from "./ChatCallsSection";
import { LostChatButton } from "./ChatPlanningSections";
import ClientOrderPanel from "./ClientOrderPanel";
import { appendLine } from "./quotes";
import ContentChatBar from "./ContentChatBar";
import PauChatBar from "./PauChatBar";
import TemplateDialog from "./TemplateDialog";
import ThinkingDialog from "./ThinkingDialog";
import {
  ReactButton,
  ReactionBadges,
  SocialComposer,
  SocialContent,
  isSocialChannel,
  reactionsByTarget,
} from "./SocialParts";
import {
  STATUS_LABEL,
  contactLabel,
  formatResumeAt,
  formatTime,
  isInternalNote,
  groupByDay,
  isMetaChannel,
  isWindowOpen,
  messageText,
  phoneForCustomer,
  showPhone,
  windowClosedNotice,
} from "./format";

function StatusMark({ message }: { message: Message }) {
  if (message.direction !== "out") return null;
  const label = STATUS_LABEL[message.status];
  return (
    <span className="inline-flex items-center gap-0.5" title={label}>
      {message.status === "sending" && <Loader2 className="h-3 w-3 animate-spin" />}
      {message.status === "sent" && <Check className="h-3 w-3" />}
      {message.status === "delivered" && <CheckCheck className="h-3 w-3" />}
      {message.status === "read" && <CheckCheck className="h-3 w-3 text-sky-500" />}
      {message.status === "failed" && <AlertCircle className="h-3 w-3 text-destructive" />}
      <span>{label}</span>
    </span>
  );
}

/** Mensaje real enviado al cliente por un seguimiento o una difusión. */
function isAutomatic(m: Message) {
  return m.senderKind === "system" && (m.type === "text" || m.type === "template");
}

const SOCIAL_TYPES = new Set(["sticker", "image", "audio", "comment"]);

function Bubble({
  message,
  conversation,
  reactions,
}: {
  message: Message;
  conversation?: Conversation;
  reactions?: { emoji: string; mine: boolean }[];
}) {
  if (isInternalNote(message)) {
    return (
      <div
        data-testid="internal-note"
        className="mx-auto max-w-[85%] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium">
          <StickyNote className="h-3 w-3" aria-hidden /> Nota interna
          {message.senderName ? ` · ${message.senderName}` : ""} · {formatTime(message.createdAt)}
        </p>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
      </div>
    );
  }
  if (message.senderKind === "system" && !isAutomatic(message)) {
    return (
      <p
        data-testid="system-message"
        className="mx-auto max-w-[80%] text-center text-xs text-muted-foreground"
      >
        {messageText(message)}
        <span className="ml-1.5 opacity-70">{formatTime(message.createdAt)}</span>
      </p>
    );
  }
  const out = message.direction === "out";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-xs",
          out ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {message.senderKind === "pau" ? (
          <p data-testid="pau-label" className="mb-0.5 flex items-center gap-1 text-[11px] font-medium opacity-90">
            <Sparkles className="h-3 w-3" aria-hidden /> Pau
          </p>
        ) : isAutomatic(message) ? (
          <p className="mb-0.5 text-[11px] opacity-80">
            {message.senderName ? `Automático · ${message.senderName}` : "Automático"}
          </p>
        ) : (
          out &&
          message.senderName && <p className="mb-0.5 text-[11px] opacity-80">{message.senderName}</p>
        )}
        {conversation && isSocialChannel(conversation) && SOCIAL_TYPES.has(message.type) && (message.type !== "image" || message.mediaUrl) ? (
          <SocialContent message={message} conversation={conversation} />
        ) : (
          <p className="whitespace-pre-wrap break-words">{messageText(message)}</p>
        )}
        <ReactionBadges reactions={reactions} />
        <div className="mt-1 flex items-center justify-end gap-2 text-[11px] opacity-80">
          {conversation && isSocialChannel(conversation) && message.direction === "in" && message.externalId && message.type !== "comment" && (
            <ReactButton
              conversationId={conversation.id}
              message={message}
              current={reactions?.find((r) => r.mine)?.emoji}
            />
          )}
          <span>{formatTime(message.createdAt)}</span>
          <StatusMark message={message} />
        </div>
        {message.status === "failed" && message.errorMessage && (
          <p className="mt-1 text-[11px] font-medium text-red-200 dark:text-red-300">
            {message.errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}

interface Props {
  conversationId: string;
  onBack: () => void;
}

export default function ChatPanel({ conversationId, onBack }: Props) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const [panelOpen, setPanelOpen] = useState(false);
  const { isAdmin, phoneMasked } = useCrmMe();
  const adminSettings = useCrmSettings(isAdmin);
  const me = {
    id: auth?.user.id,
    name: [auth?.user.name, auth?.user.surname].filter(Boolean).join(" ") || undefined,
  };
  const convQuery = useConversation(conversationId);
  const msgsQuery = useMessages(conversationId);
  const send = useSendMessage(conversationId, me);
  const sendNote = useSendNote(conversationId);
  const update = useUpdateConversation(conversationId);
  const markRead = useMarkRead();
  const older = useLoadOlder(conversationId);

  const [text, setText] = useState("");
  const [mode, setMode] = useState<"message" | "note">("message");
  const [noteText, setNoteText] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** Deja un texto en la caja (en línea nueva si ya hay algo) sin enviarlo. */
  const insertInMessage = (t: string) => {
    setMode("message");
    setText((cur) => appendLine(cur, t));
  };
  const conversation = convQuery.data;
  const items = msgsQuery.data?.items;
  const lastId = items?.[items.length - 1]?.id;
  const prevLastId = useRef<string | undefined>(undefined);
  const unread = conversation?.unreadCount ?? 0;
  const markReadMutate = markRead.mutate;
  const clientQuery = useConversationClient(
    companyId,
    conversation ? (phoneForCustomer(conversation) ?? undefined) : undefined,
  );
  useAutoLinkClient(conversation, clientQuery.data?.id);

  // Al abrir (o llegar mensajes mientras está abierta) con no leídos → marcar leída.
  useEffect(() => {
    if (unread > 0) markReadMutate(conversationId);
  }, [unread, conversationId, markReadMutate]);

  // Scroll al final al cargar y cuando llega un mensaje nuevo (no al cargar anteriores).
  useLayoutEffect(() => {
    if (lastId && lastId !== prevLastId.current) {
      bottomRef.current?.scrollIntoView?.({ block: "end" });
    }
    prevLastId.current = lastId;
  }, [lastId]);

  const fatal = convQuery.isError ? crmError(convQuery.error) : null;
  if (fatal) {
    return (
      <div role="alert" className="flex h-full flex-col items-start gap-2 p-4 text-sm">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack}>
          <ArrowLeft /> Volver
        </Button>
        <p className="font-medium text-destructive">
          {fatal.unreachable ? CRM_UNREACHABLE : fatal.message}
        </p>
        <Button size="sm" variant="outline" onClick={() => convQuery.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!conversation) {
    return (
      <p role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando conversación…
      </p>
    );
  }

  const mine = !!me.id && conversation.assignedUserId === me.id;
  const windowOpen = isWindowOpen(conversation);
  const closed = conversation.status === "closed";

  const submit = () => {
    const body = text.trim();
    if (!body || !windowOpen || send.isPending) return;
    setText("");
    send.mutate({ body, tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  };

  const submitNote = () => {
    const body = noteText.trim();
    if (!body || sendNote.isPending) return;
    sendNote.mutate(body, { onSuccess: () => setNoteText("") });
  };

  const groups = groupByDay(items ?? []);
  const reactions = reactionsByTarget(items ?? []);
  const isNote = mode === "note";
  const canTemplate = !windowOpen && !isMetaChannel(conversation);

  return (
    <div className="flex h-full min-h-0">
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b p-3">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label="Volver a la lista">
          <ArrowLeft />
        </Button>
        <div className="min-w-[11rem] flex-1">
          <h2 className="flex items-center gap-2 truncate text-sm font-semibold">
            <span className="truncate">{contactLabel(conversation, phoneMasked)}</span>
            <ChannelBadge channel={conversation.channel} />
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {isMetaChannel(conversation)
              ? (showPhone(conversation.customerPhone, phoneMasked) ?? "Sin teléfono")
              : showPhone(conversation.contactPhone, phoneMasked)}
            {isAdmin && adminSettings.data?.maskPhone ? " · Las vendedoras ven el número oculto" : ""}
            {conversation.assignedUserName ? ` · Asignada a ${conversation.assignedUserName}` : " · Sin asignar"}
          </p>
        </div>
        <ChatCallButtons conversation={conversation} />
        <Button
          size="icon-sm"
          variant="outline"
          className="xl:hidden"
          aria-label="Cliente y pedido"
          onClick={() => setPanelOpen(true)}
        >
          <PanelRight />
        </Button>
        {!closed && !conversation.resumeAt && (
          <Button size="sm" variant="outline" onClick={() => setThinkingOpen(true)}>
            <Clock /> Lo está pensando
          </Button>
        )}
        {!closed && <LostChatButton conversation={conversation} />}
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending || !me.id}
          onClick={() => update.mutate({ assignedUserId: mine ? null : (me.id ?? null) })}
        >
          {mine ? "Soltar" : "Tomar"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => update.mutate({ status: closed ? "open" : "closed" })}
        >
          {closed ? "Reabrir" : "Cerrar"}
        </Button>
      </header>

      {conversation.resumeAt && (
        <div
          role="status"
          data-testid="thinking-banner"
          className="flex flex-wrap items-center gap-2 border-b border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100"
        >
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="font-medium">
              Lo está pensando · retomar el {formatResumeAt(conversation.resumeAt)}
            </span>
            {conversation.resumeNote && <span className="block text-xs">{conversation.resumeNote}</span>}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending}
            onClick={() => update.mutate({ resumeAt: null })}
          >
            Retomar ahora
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" data-testid="messages">
        {msgsQuery.isLoading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando mensajes…
          </p>
        )}
        {msgsQuery.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {crmError(msgsQuery.error).unreachable ? CRM_UNREACHABLE : crmError(msgsQuery.error).message}
          </p>
        )}
        {msgsQuery.data?.hasMore && (
          <div className="flex justify-center">
            <Button size="sm" variant="ghost" onClick={older.load} disabled={older.loading}>
              {older.loading ? "Cargando…" : "Cargar anteriores"}
            </Button>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.day} className="space-y-2">
            <p className="text-center text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5">{g.label}</span>
            </p>
            {g.messages
              .filter((m) => m.type !== "reaction")
              .map((m) => (
                <Bubble
                  key={m.id}
                  message={m}
                  conversation={conversation}
                  reactions={m.externalId ? reactions.get(m.externalId) : undefined}
                />
              ))}
          </section>
        ))}
        {msgsQuery.data && items?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Aún no hay mensajes.</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={cn("border-t p-3", isNote && "bg-amber-50/60 dark:bg-amber-950/20")}>
        <div role="group" aria-label="Tipo de escritura" className="mb-2 flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={isNote ? "outline" : "default"}
            aria-pressed={!isNote}
            onClick={() => setMode("message")}
          >
            Mensaje
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isNote ? "default" : "outline"}
            aria-pressed={isNote}
            onClick={() => setMode("note")}
          >
            <StickyNote /> Nota interna
          </Button>
        </div>
        {!isNote && !windowOpen && (
          <div role="status" className="mb-2 space-y-2 rounded-md border bg-muted p-2 text-xs text-muted-foreground">
            <p>{windowClosedNotice(conversation)}</p>
            {canTemplate && (
              <Button type="button" size="sm" onClick={() => setTemplateOpen(true)}>
                Enviar plantilla
              </Button>
            )}
          </div>
        )}
        {isNote ? (
          <>
            <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-300">
              Solo la ve tu equipo. No se envía al cliente.
            </p>
            <div className="flex items-end gap-2">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submitNote();
                  }
                }}
                maxLength={2000}
                rows={2}
                placeholder="Escribe una nota para tu equipo (Enter guarda, Shift+Enter salto de línea)"
                aria-label="Nota interna"
                className="min-h-0 resize-none border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
              />
              <Button
                onClick={submitNote}
                disabled={!noteText.trim() || sendNote.isPending}
                aria-label="Guardar nota"
              >
                <Send />
              </Button>
            </div>
          </>
        ) : (
        <>
        {isSocialChannel(conversation) && <SocialComposer conversationId={conversation.id} disabled={!windowOpen} />}
        <ContentChatBar conversation={conversation} text={text} onFill={setText} windowOpen={windowOpen} />
        <PauChatBar conversation={conversation} text={text} onFill={setText} windowOpen={windowOpen} />
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={!windowOpen}
            rows={2}
            placeholder={windowOpen ? "Escribe un mensaje (Enter envía, Shift+Enter salto de línea)" : "Respuesta bloqueada"}
            aria-label="Mensaje"
            className="min-h-0 resize-none"
          />
          <Button onClick={submit} disabled={!windowOpen || !text.trim()} aria-label="Enviar mensaje">
            <Send />
          </Button>
        </div>
        </>
        )}
      </div>
    </div>
    <aside
      aria-label="Cliente y pedido"
      className="hidden w-80 shrink-0 border-l xl:block"
    >
      <ClientOrderPanel
        conversation={conversation}
        companyId={companyId}
        client={clientQuery}
        onInsertMessage={insertInMessage}
      />
    </aside>
    {templateOpen && <TemplateDialog conversation={conversation} onClose={() => setTemplateOpen(false)} />}
    {thinkingOpen && <ThinkingDialog conversation={conversation} onClose={() => setThinkingOpen(false)} />}
    <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
      <SheetContent side="right" className="w-full max-w-sm p-0 xl:hidden">
        <SheetHeader className="border-b p-3">
          <SheetTitle className="text-base">Cliente y pedido</SheetTitle>
          <SheetDescription className="sr-only">
            Datos del cliente y pedidos de esta conversación
          </SheetDescription>
        </SheetHeader>
        <ClientOrderPanel
          conversation={conversation}
          companyId={companyId}
          client={clientQuery}
          onInsertMessage={(t) => {
            insertInMessage(t);
            setPanelOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
    </div>
  );
}
