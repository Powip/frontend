"use client";
import { useMessages } from "@/hooks/useCrmChat";
import type { Conversation, Message } from "@/types/crm";
import { formatTime } from "./format";

const MAX_EVENTS = 6;

/** Hechos del chat (pasó de etapa, link creado, comprobante, tomado…): los mensajes de sistema, el más nuevo arriba. */
export function historyEvents(messages: Message[] | undefined, max = MAX_EVENTS): Message[] {
  return (messages ?? [])
    .filter((m) => m.type === "system" && m.body?.trim())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, max);
}

/** «Historial» del panel Seguimiento (mockup 152). Usa los mensajes que el chat ya cargó. */
export function ChatHistorySection({ conversation }: { conversation: Conversation }) {
  const { data } = useMessages(conversation.id);
  const events = historyEvents(data?.items);
  return (
    <section className="space-y-2" aria-label="Historial">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial</h3>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aún no hay movimientos en este chat.</p>
      ) : (
        <ol className="space-y-1.5">
          {events.map((m) => (
            <li key={m.id} className="flex items-start gap-2 text-xs">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden />
              <span className="grow">{m.body}</span>
              <time className="shrink-0 text-[11px] text-muted-foreground" dateTime={m.createdAt}>
                {formatTime(m.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
