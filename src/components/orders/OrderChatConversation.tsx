"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, MessagesSquare, ReceiptText, Sparkles, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { crmError, getOrderConversation, listAllMessages } from "@/services/crmService";
import { getReceiptFile, listReceipts } from "@/services/crmOrderPanelService";
import type { Conversation, Message, MessagePage } from "@/types/crm";
import type { PaymentReceipt } from "@/types/crmOrderPanel";
import { CHANNEL_LABEL, contactLabel, formatTime, groupByDay, isInternalNote, messageText } from "@/components/ventas-chat/format";
import { isWhatsAppMedia, WhatsAppMedia } from "@/components/ventas-chat/WhatsAppMedia";

export function bandejaHref(conversationId: string) {
  return `/comercial/ventas-chat/bandeja?c=${encodeURIComponent(conversationId)}`;
}

type Loadable<T> = { data: T | undefined; isLoading: boolean; isError: boolean };

/** Carga async simple (el modal de la venta se abre en pantallas sin QueryClientProvider). */
function useLoad<T>(key: string | null, load: () => Promise<T>): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ data: undefined, isLoading: !!key, isError: false });
  useEffect(() => {
    if (!key) {
      setState({ data: undefined, isLoading: false, isError: false });
      return;
    }
    let alive = true;
    setState({ data: undefined, isLoading: true, isError: false });
    load()
      .then((data) => alive && setState({ data, isLoading: false, isError: false }))
      .catch(() => alive && setState({ data: undefined, isLoading: false, isError: true }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/**
 * Chat del que salió la venta. Sin CRM (403/401) o sin chat se trata igual: no hay conversación,
 * para que una venta normal nunca muestre un error.
 */
export function useOrderConversation(orderId: string | null | undefined, enabled = true) {
  return useLoad(orderId && enabled ? orderId : null, async (): Promise<{ conversation: Conversation | null; denied: boolean }> => {
    try {
      return { conversation: await getOrderConversation(orderId!), denied: false };
    } catch (err) {
      const { status } = crmError(err);
      if (status === 401 || status === 403 || status === 404) return { conversation: null, denied: status !== 404 };
      throw err;
    }
  });
}

/** Quién escribió el mensaje: cliente, Pau, la vendedora o un envío automático. */
export function authorOf(message: Message, customer: string): { label: string; kind: "customer" | "pau" | "agent" | "auto" } {
  if (message.senderKind === "pau") return { label: "Pau", kind: "pau" };
  if (message.direction === "in") return { label: customer, kind: "customer" };
  if (message.senderKind === "system") {
    return { label: message.senderName ? `Automático · ${message.senderName}` : "Automático", kind: "auto" };
  }
  return { label: message.senderName?.trim() || "Vendedora", kind: "agent" };
}

const RECEIPT_STATUS: Record<PaymentReceipt["status"], { label: string; className: string }> = {
  porval: { label: "Por validar", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  aprobado: { label: "Aprobado", className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  rechazado: { label: "Rechazado", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}

function ReadOnlyBubble({ message, customer }: { message: Message; customer: string }) {
  if (isInternalNote(message)) {
    return (
      <div data-testid="order-chat-note" className="mx-auto max-w-[85%] rounded-lg border border-amber-300 bg-crm-note px-3 py-2 text-sm text-crm-note-fg dark:border-amber-700">
        <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium">
          <StickyNote className="h-3 w-3" aria-hidden /> Nota interna
          {message.senderName ? ` · ${message.senderName}` : ""} · {formatTime(message.createdAt)}
        </p>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
      </div>
    );
  }
  if (message.senderKind === "system" && message.type !== "text" && message.type !== "template") {
    return (
      <p className="mx-auto w-fit max-w-[80%] rounded-md bg-background/80 px-2 py-0.5 text-center text-xs text-muted-foreground">
        {messageText(message)}
        <span className="ml-1.5 opacity-70">{formatTime(message.createdAt)}</span>
      </p>
    );
  }
  const author = authorOf(message, customer);
  const out = message.direction === "out";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")} data-testid="order-chat-message" data-author={author.kind}>
      <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-xs text-crm-bubble-fg", out ? "bg-crm-bubble-out" : "bg-crm-bubble-in")}>
        <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium opacity-90">
          {author.kind === "pau" && <Sparkles className="h-3 w-3" aria-hidden />}
          {author.label}
        </p>
        {isWhatsAppMedia(message) ? (
          <div className="space-y-1">
            <WhatsAppMedia message={message} readOnly />
            {message.body?.trim() && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{messageText(message)}</p>
        )}
        <p className="mt-1 text-right text-[11px] opacity-80">{formatTime(message.createdAt)}</p>
      </div>
    </div>
  );
}

function ReceiptRow({ receipt }: { receipt: PaymentReceipt }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const status = RECEIPT_STATUS[receipt.status];
  const open = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const blob = await getReceiptFile(receipt.id);
      setUrl(URL.createObjectURL(blob));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };
  const close = () => {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
  };
  const isPdf = (receipt.mime ?? "").includes("pdf");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm" data-testid="order-chat-receipt">
      <div className="min-w-0">
        <p className="font-medium">
          {receipt.methodLabel} · S/ {receipt.amount.toFixed(2)}
          {receipt.operationNumber ? <span className="text-muted-foreground"> · Op. {receipt.operationNumber}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(receipt.createdAt)}
          {receipt.validatedBy === "pau" ? " · leído por Pau" : receipt.uploadedByName ? ` · subido por ${receipt.uploadedByName}` : ""}
          {receipt.reviewedByName ? ` · revisado por ${receipt.reviewedByName}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.className)}>{status.label}</span>
        {receipt.hasFile && (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={open} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ReceiptText className="h-3 w-3" />} Ver
          </Button>
        )}
        {failed && <span className="text-xs text-destructive">No se pudo abrir</span>}
      </div>
      <Dialog open={!!url} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Comprobante · S/ {receipt.amount.toFixed(2)}</DialogTitle>
          {url && isPdf ? (
            <iframe src={url} title="Comprobante" className="h-[75vh] w-full rounded-md" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Comprobante" className="max-h-[75vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </li>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border p-8 text-center" data-testid="order-chat-empty">
      <MessagesSquare className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/** Pestaña «Conversación» del detalle de la venta (mockup 152): el chat completo con el cliente. */
export type OrderConversationLink = ReturnType<typeof useOrderConversation>;

export default function OrderChatConversation({
  orderId,
  enabled = true,
  link: given,
}: {
  orderId: string;
  enabled?: boolean;
  /** Resultado ya cargado por quien abre la pestaña (evita pedirlo dos veces). */
  link?: OrderConversationLink;
}) {
  const own = useOrderConversation(orderId, enabled && !given);
  const link = given ?? own;
  const conversation = link.data?.conversation ?? null;
  const messages = useLoad<MessagePage>(conversation?.id ?? null, () => listAllMessages(conversation!.id));
  const receipts = useLoad<PaymentReceipt[]>(conversation?.id ?? null, () => listReceipts(conversation!.id));

  if (link.isLoading) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando la conversación…
      </p>
    );
  }
  if (link.isError) {
    return <EmptyState title="No se pudo cargar la conversación" text="Ventas por chat no respondió. Intenta de nuevo en un momento." />;
  }
  if (!conversation) {
    return link.data?.denied ? (
      <EmptyState title="Sin acceso a Ventas por chat" text="Tu usuario no tiene acceso a las conversaciones del CRM." />
    ) : (
      <EmptyState title="Esta venta no vino de un chat" text="Se registró desde la web, un import o a mano." />
    );
  }

  const customer = contactLabel(conversation, true) || "Cliente";
  const items = (messages.data?.items ?? []).filter((m) => !m.hiddenAt || m.direction === "in");
  return (
    <div className="space-y-4" data-testid="order-chat">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {CHANNEL_LABEL[conversation.channel]} · {customer}
          {conversation.assignedUserName ? ` · atiende ${conversation.assignedUserName}` : ""}
        </p>
        <Button asChild size="sm">
          <Link href={bandejaHref(conversation.id)}>
            <ExternalLink className="h-4 w-4" /> Abrir en Ventas por chat
          </Link>
        </Button>
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3" data-testid="order-chat-thread">
        {messages.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando mensajes…
          </p>
        ) : messages.isError ? (
          <p className="text-sm text-destructive">No se pudieron cargar los mensajes.</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">El chat aún no tiene mensajes.</p>
        ) : (
          <>
            {messages.data?.hasMore && (
              <p className="text-center text-xs text-muted-foreground">Se muestran los últimos {items.length} mensajes.</p>
            )}
            {groupByDay(items).map((group) => (
              <div key={group.day} className="space-y-2">
                <p className="mx-auto w-fit rounded-full bg-background px-3 py-0.5 text-xs text-muted-foreground shadow-xs">{group.label}</p>
                {group.messages.map((m) => (
                  <ReadOnlyBubble key={m.id} message={m} customer={customer} />
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {(receipts.data?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <ReceiptText className="h-4 w-4" aria-hidden /> Comprobantes del chat
          </h4>
          <ul className="space-y-2">
            {receipts.data!.map((r) => (
              <ReceiptRow key={r.id} receipt={r} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
