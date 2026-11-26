import { PhoneCall } from "lucide-react";
import type { Message } from "@/types/crm";
import { formatTime } from "./format";

/** El CRM guarda cada llamada en el chat como «Llamada hecha: resultado · duración · notas». */
const CALL_NOTE = /^Llamada (?:hecha|recibida): ([\s\S]+)$/;
const DURATION = /^\d+ (?:min|s)\b/;

export function isCallNote(m: Pick<Message, "senderKind" | "type" | "body">) {
  return m.senderKind === "system" && m.type === "system" && CALL_NOTE.test(m.body ?? "");
}

function parseCallNote(body: string) {
  const [result, ...rest] = (CALL_NOTE.exec(body)?.[1] ?? "").split(" · ");
  const hasDuration = DURATION.test(rest[0] ?? "");
  return { result, duration: hasDuration ? rest[0] : "", notes: rest.slice(hasDuration ? 1 : 0).join(" · ") };
}

/** Burbuja centrada de una llamada (mockup 152). */
export function CallBubble({ message }: { message: Message }) {
  const { result, duration, notes } = parseCallNote(message.body ?? "");
  const title = ["Llamada" + (message.senderName ? ` de ${message.senderName}` : ""), duration, result];
  return (
    <div data-testid="call-bubble" className="mx-auto flex max-w-[88%] gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
      <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
      <div className="min-w-0 break-words">
        <p className="font-semibold">{title.filter(Boolean).join(" · ")}</p>
        {notes && <p className="text-xs text-muted-foreground">{notes}</p>}
        <p className="text-[11px] text-muted-foreground">{formatTime(message.createdAt)}</p>
      </div>
    </div>
  );
}
