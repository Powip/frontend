"use client";
import { useState } from "react";
import { Loader2, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { telHref } from "@/lib/crmPhone";
import { crmError } from "@/services/crmService";
import { useCalls } from "@/hooks/useCrmCalls";
import { useCrmMe } from "@/hooks/useCrmMe";
import type { Conversation } from "@/types/crm";
import CallDialog from "./CallDialog";
import { CALL_DIRECTION_LABEL, CALL_RESULT_LABEL, CALL_RESULT_TONE, formatCallDuration } from "./calls";
import { contactLabel, phoneForCustomer } from "./format";

/** Botones «Llamar» y «Registrar llamada» de la cabecera del chat. */
export function ChatCallButtons({ conversation }: { conversation: Conversation }) {
  const { phoneMasked } = useCrmMe();
  const [open, setOpen] = useState(false);
  const href = telHref(phoneForCustomer(conversation));
  return (
    <>
      {href ? (
        <Button asChild size="sm" variant="outline">
          <a href={href}>
            <PhoneCall /> Llamar
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled
          title="Guarda el teléfono del cliente para poder llamar"
        >
          <PhoneCall /> Llamar
        </Button>
      )}
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Registrar llamada
      </Button>
      {open && (
        <CallDialog
          open
          onOpenChange={(o) => !o && setOpen(false)}
          conversationId={conversation.id}
          contact={contactLabel(conversation, phoneMasked)}
        />
      )}
    </>
  );
}

/** Últimas 3 llamadas registradas en esta conversación (30 días). */
export default function ChatCallsSection({ conversation }: { conversation: Conversation }) {
  const calls = useCalls({ days: 30, mine: false, conversationId: conversation.id });
  const last = (calls.data ?? []).slice(0, 3);
  return (
    <section className="space-y-2" aria-label="Llamadas">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Llamadas</h3>
      {calls.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando llamadas…
        </p>
      )}
      {calls.isError && (
        <p role="alert" className="text-xs text-destructive">
          {crmError(calls.error).message}
        </p>
      )}
      {calls.data && last.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin llamadas registradas en los últimos 30 días.</p>
      )}
      <ul className="space-y-1.5">
        {last.map((c) => (
          <li key={c.id} data-testid="chat-call-row" className="space-y-0.5 rounded-md border p-2 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn(CALL_RESULT_TONE[c.result])}>
                {CALL_RESULT_LABEL[c.result]}
              </Badge>
              <span className="ml-auto text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString("es-PE", {
                  timeZone: "America/Lima",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            </div>
            <p className="text-muted-foreground">
              {CALL_DIRECTION_LABEL[c.direction]} · {formatCallDuration(c.durationSeconds)}
              {c.userName ? ` · ${c.userName}` : ""}
            </p>
            {c.notes && <p className="whitespace-pre-wrap">{c.notes}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
