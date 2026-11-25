"use client";
import { useRef, useState } from "react";
import { HelpCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSuggestPauReply, usePauSettings } from "@/hooks/useCrmPau";
import { storeMode } from "./pau";
import { useMessages, useUpdateConversation } from "@/hooks/useCrmChat";
import type { Conversation } from "@/types/crm";
import ConfirmDialog from "./ConfirmDialog";
import TeachPauDialog from "./TeachPauDialog";
import { lastCustomerText } from "./format";

interface Props {
  conversation: Conversation;
  /** Texto actual de la caja de mensaje. */
  text: string;
  /** Pone el texto en la caja SIN enviarlo. */
  onFill: (text: string) => void;
  /** La ventana de 24 h está cerrada: la caja está bloqueada. */
  windowOpen: boolean;
}

type Confirm = { kind: "before" } | { kind: "held"; text: string } | null;

/** Barra de Pau sobre la caja de mensaje. No se pinta con Pau apagado o sin leer su modo. */
export default function PauChatBar({ conversation, text, onFill, windowOpen }: Props) {
  const settings = usePauSettings();
  const update = useUpdateConversation(conversation.id);
  const suggest = useSuggestPauReply(conversation.id);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [teaching, setTeaching] = useState(false);
  const messages = useMessages(conversation.id);
  const textRef = useRef(text);
  textRef.current = text;

  // Modo de la tienda de este chat; sin modo propio, el general.
  const mode = settings.data ? storeMode(settings.data, conversation.storeId) : undefined;
  const showBar = !!mode && mode !== "off";
  // Con Pau apagado solo se pinta si pidió ayuda: ahí aún sirve enseñarle la respuesta.
  if (!showBar && !conversation.pauHelpReason) return null;

  const auto = mode === "auto";
  const active = conversation.pauEnabled;

  const run = () => {
    const startedWith = textRef.current.trim();
    suggest.mutate(undefined, {
      onSuccess: ({ text: draft }) => {
        const now = textRef.current.trim();
        // Si la vendedora escribió algo mientras Pau pensaba, no se pisa sin preguntar.
        if (now && now !== startedWith) setConfirm({ kind: "held", text: draft });
        else onFill(draft);
      },
    });
  };
  const ask = () => {
    if (suggest.isPending) return;
    if (text.trim()) setConfirm({ kind: "before" });
    else run();
  };

  return (
    <div role="region" aria-label="Pau" className="mb-2 space-y-2" data-testid="pau-bar">
      {conversation.pauHelpReason && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Pau pidió ayuda: {conversation.pauHelpReason}</span>
        </p>
      )}
      {!showBar && (
        <Button size="sm" variant="outline" onClick={() => setTeaching(true)}>
          Enseñarle la respuesta
        </Button>
      )}
      {showBar && (
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 text-xs font-medium" data-testid="pau-status">
          {suggest.isPending
            ? "Pau está escribiendo…"
            : !auto
              ? "Pau en modo copiloto · sugiere, tú envías"
              : active
                ? "Pau responde este chat"
                : "Pau en pausa · atiendes tú"}
        </span>
        {suggest.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {auto && (
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending}
            onClick={() => update.mutate({ pauEnabled: !active })}
          >
            {active ? "Tomar" : "Devolver a Pau"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={suggest.isPending || !windowOpen}
          title={windowOpen ? undefined : "La ventana de respuesta está cerrada: no se puede responder"}
          onClick={ask}
        >
          Sugerir respuesta
        </Button>
        <Button size="sm" variant="outline" onClick={() => setTeaching(true)}>
          Enseñarle la respuesta
        </Button>
      </div>
      )}
      {teaching && (
        <TeachPauDialog
          initialQuestion={lastCustomerText(messages.data?.items)}
          onClose={() => setTeaching(false)}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        title="¿Reemplazar lo que escribiste?"
        description={
          confirm?.kind === "held"
            ? "Pau terminó su sugerencia, pero ya habías escrito otro texto. Si la usas, se reemplaza lo que hay en la caja."
            : "La caja ya tiene texto. La sugerencia de Pau lo reemplazará. No se envía nada: podrás revisarla antes."
        }
        confirmLabel={confirm?.kind === "held" ? "Usar sugerencia" : "Reemplazar y sugerir"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (c?.kind === "held") onFill(c.text);
          else if (c) run();
        }}
      />
    </div>
  );
}
