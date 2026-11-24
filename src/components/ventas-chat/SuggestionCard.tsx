"use client";
import { useState } from "react";
import { AlertCircle, ImageIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatSuggestion } from "@/hooks/useChatSuggestion";
import ConfirmDialog from "./ConfirmDialog";
import { materialText } from "./ContentLib";
import SuggestionFacts from "./SuggestionFacts";
import SuggestionSourceBadge from "./SuggestionSourceBadge";

interface Props {
  conversationId: string;
  suggestion: ChatSuggestion;
  /** Texto actual de la caja de mensaje. */
  text: string;
  /** Pone el texto en la caja SIN enviarlo. */
  onFill: (text: string) => void;
  onEdit: (text: string) => void;
  onInsert: (text: string) => void;
}

/**
 * Tarjeta «Sugerencia · paso N de M»: responde la objeción detectada en el
 * último mensaje del cliente o, si no hay, propone el texto del paso actual.
 */
export default function SuggestionCard({ conversationId, suggestion, text, onFill, onEdit, onInsert }: Props) {
  const [confirming, setConfirming] = useState(false);
  const { objection, material } = suggestion;
  const fill = () => {
    setConfirming(false);
    onFill(suggestion.text);
    suggestion.use();
  };

  return (
    <div
      role="region"
      aria-label="Sugerencia"
      data-testid="suggestion-card"
      className="mb-2 flex flex-col gap-1.5 rounded-xl border border-primary/35 bg-primary/5 px-3 py-2.5 text-[13px]"
    >
      <span className="flex items-center gap-2 text-xs font-semibold text-primary">
        <Sparkles className="h-[15px] w-[15px]" aria-hidden />
        {suggestion.stepCount ? `Sugerencia · paso ${suggestion.step + 1} de ${suggestion.stepCount}` : "Sugerencia"}
        <span className="font-normal text-muted-foreground">
          {objection
            ? "Responde la objeción del cliente"
            : suggestion.source === "llm"
              ? "Redactada con lo que sabe tu negocio"
              : `Guion · ${suggestion.stepName}`}
        </span>
        <span className="ml-auto">
          {/* «IA» solo si la IA redactó el texto; respuesta cargada o paso del guion son reglas. */}
          <SuggestionSourceBadge source={suggestion.source} />
        </span>
      </span>
      {objection && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[11.5px] font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-3 w-3" aria-hidden /> Objeción: {objection.label}
        </span>
      )}
      <span className="whitespace-pre-wrap">{suggestion.text}</span>
      <SuggestionFacts conversationId={conversationId} />
      {material && (
        <span className="flex flex-wrap items-center gap-1.5 text-xs">
          <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Enviar también:
          <Button size="sm" variant="outline" className="h-7" onClick={() => onInsert(materialText(material))}>
            {material.title}
          </Button>
        </span>
      )}
      <span className="flex gap-1.5">
        <Button size="sm" onClick={() => (text.trim() ? setConfirming(true) : fill())}>
          Usar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onEdit(suggestion.text);
            suggestion.use();
          }}
        >
          Editar
        </Button>
        <Button size="sm" variant="ghost" onClick={suggestion.drop}>
          Descartar
        </Button>
      </span>
      <ConfirmDialog
        open={confirming}
        title="¿Reemplazar lo que escribiste?"
        description="La caja ya tiene texto. La sugerencia lo reemplazará. No se envía nada: podrás revisarla antes."
        confirmLabel="Reemplazar"
        onCancel={() => setConfirming(false)}
        onConfirm={fill}
      />
    </div>
  );
}
