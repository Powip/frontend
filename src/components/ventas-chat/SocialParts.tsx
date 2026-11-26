"use client";
import { useState } from "react";
import { FileText, ImagePlus, Loader2, MessageSquareReply, Smile, Sticker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useReact, useReplyComment, useSendAttachment, useTranscribe } from "@/hooks/useCrmSocial";
import type { Conversation, Message } from "@/types/crm";

/** Canales con mensajes sociales de Meta (stickers, reacciones, comentarios). */
export function isSocialChannel(c: Pick<Conversation, "channel">) {
  return c.channel === "messenger" || c.channel === "instagram";
}

export const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮"];

/** Reacciones por mensaje: externalId del mensaje → emojis actuales (último estado por emoji). */
export function reactionsByTarget(messages: Message[]): Map<string, { emoji: string; mine: boolean }[]> {
  const out = new Map<string, { emoji: string; mine: boolean }[]>();
  for (const m of messages) {
    if (m.type !== "reaction" || !m.contextExternalId) continue;
    const list = out.get(m.contextExternalId) ?? [];
    const idx = list.findIndex((r) => r.mine === (m.direction === "out"));
    const removed = !m.body?.trim();
    if (idx >= 0) list.splice(idx, 1);
    if (!removed) list.push({ emoji: m.body as string, mine: m.direction === "out" });
    out.set(m.contextExternalId, list);
  }
  return out;
}

/** Contenido especial de una burbuja: sticker, imagen, audio con transcripción o comentario. */
export function SocialContent({
  message,
  conversation,
}: {
  message: Message;
  conversation: Pick<Conversation, "id" | "channel">;
}) {
  const transcribe = useTranscribe(conversation.id);
  const reply = useReplyComment(conversation.id);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  if (message.type === "sticker") {
    return message.mediaUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={message.mediaUrl} alt="Sticker" className="h-28 w-28 object-contain" data-testid="sticker" />
    ) : (
      <p className="flex items-center gap-1" data-testid="sticker">
        <Sticker className="h-4 w-4" aria-hidden /> Sticker{message.mediaId ? ` · ${message.mediaId}` : ""}
      </p>
    );
  }
  if (message.type === "image" && message.mediaUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={message.mediaUrl} alt="Imagen" className="max-h-60 rounded-md" data-testid="media-image" />
    );
  }
  if (message.type === "audio") {
    return (
      <div className="space-y-1" data-testid="audio-message">
        {message.mediaUrl ? (
          <audio controls src={message.mediaUrl} className="max-w-full" />
        ) : (
          <p className="text-xs opacity-80">Audio sin archivo disponible</p>
        )}
        {message.transcript ? (
          <p className="whitespace-pre-wrap break-words text-xs italic" data-testid="transcript">
            «{message.transcript}»
          </p>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={transcribe.isPending}
            onClick={() => transcribe.mutate(message.id)}
          >
            {transcribe.isPending ? <Loader2 className="animate-spin" /> : <FileText />} Transcribir
          </Button>
        )}
      </div>
    );
  }
  if (message.type === "comment") {
    return (
      <div className="space-y-1" data-testid="comment-message">
        <p className="text-[11px] font-medium opacity-80">
          Comentario en {conversation.channel === "instagram" ? "Instagram" : "Facebook"}
          {message.hiddenAt && (
            <span
              className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
              title="Tenía un teléfono o un insulto. Se ocultó para el público, no se borró."
            >
              Oculto al público
            </span>
          )}
        </p>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.direction === "in" &&
          (replying ? (
            <div className="flex items-end gap-2">
              <Textarea
                aria-label="Responder comentario"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                className="min-h-0 w-56 resize-none bg-background text-foreground"
              />
              <Button
                type="button"
                size="sm"
                disabled={!replyText.trim() || reply.isPending}
                onClick={() =>
                  reply.mutate(
                    { messageId: message.id, body: replyText.trim() },
                    {
                      onSuccess: () => {
                        setReplyText("");
                        setReplying(false);
                      },
                    },
                  )
                }
              >
                Responder
              </Button>
            </div>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setReplying(true)}>
              <MessageSquareReply /> Responder comentario
            </Button>
          ))}
      </div>
    );
  }
  return null;
}

/** Insignias de reacción bajo una burbuja. */
export function ReactionBadges({ reactions }: { reactions: { emoji: string; mine: boolean }[] | undefined }) {
  if (!reactions?.length) return null;
  return (
    <div className="mt-1 flex gap-1" data-testid="reactions">
      {reactions.map((r, i) => (
        <span
          key={`${r.emoji}-${i}`}
          title={r.mine ? "Tu reacción" : "Reacción del cliente"}
          className="rounded-full border bg-background px-1.5 text-xs text-foreground"
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

/** Botón para reaccionar a un mensaje del cliente. */
export function ReactButton({
  conversationId,
  message,
  current,
}: {
  conversationId: string;
  message: Message;
  current: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const react = useReact(conversationId);
  return (
    <span className="relative">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Reaccionar"
        onClick={() => setOpen((v) => !v)}
        className="h-6 w-6"
      >
        <Smile />
      </Button>
      {open && (
        <span role="menu" className="absolute bottom-7 left-0 z-10 flex gap-1 rounded-md border bg-popover p-1 shadow">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              className="rounded px-1 text-base hover:bg-muted"
              onClick={() => {
                react.mutate({ messageId: message.id, emoji, react: current !== emoji });
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** Enviar sticker (id) o adjunto (URL pública) por Messenger/Instagram. */
export function SocialComposer({ conversationId, disabled }: { conversationId: string; disabled: boolean }) {
  const send = useSendAttachment(conversationId);
  const [mode, setMode] = useState<"sticker" | "image" | null>(null);
  const [value, setValue] = useState("");
  const submit = () => {
    const v = value.trim();
    if (!v || !mode) return;
    send.mutate(mode === "sticker" ? { kind: "sticker", stickerId: v } : { kind: "image", url: v }, {
      onSuccess: () => {
        setValue("");
        setMode(null);
      },
    });
  };
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2" data-testid="social-composer">
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setMode(mode === "sticker" ? null : "sticker")}>
        <Sticker /> Sticker
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setMode(mode === "image" ? null : "image")}>
        <ImagePlus /> Imagen
      </Button>
      {mode && (
        <>
          <Input
            aria-label={mode === "sticker" ? "ID del sticker" : "URL de la imagen"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === "sticker" ? "ID del sticker" : "https://… (URL pública)"}
            className="h-8 w-56"
          />
          <Button type="button" size="sm" disabled={!value.trim() || send.isPending} onClick={submit}>
            Enviar
          </Button>
        </>
      )}
    </div>
  );
}
