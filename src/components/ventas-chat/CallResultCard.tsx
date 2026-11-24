"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CallResult } from "@/types/crmCalls";
import type { CallSession, CallSessionResultInput } from "@/types/crmCallSessions";
import { fromLimaInput, toLimaInput } from "./agenda";
import CallScript from "./CallScript";
import CallShell, { contactOf, formatTimer } from "./CallShell";
import { CALL_LOST_REASONS, closingMessage, sendsClosingByDefault } from "./callClosing";
import { CALL_RESULT_LABEL } from "./calls";
import { firstName } from "./ContentLib";
import { NATIVE_SELECT_CLASS } from "./format";

/** Resultados que ofrece el mockup al colgar. */
const RESULT_OPTIONS: CallResult[] = ["sold", "callback", "no_answer", "not_interested"];

export interface CallOutcome {
  input: CallSessionResultInput;
  /** Mensaje de cierre para el chat; `null` si no se manda. */
  closing: string | null;
  /** Motivo de «No le interesa»: el chat pasa a perdido. */
  lostReason: string | null;
  /** Seguir con el siguiente de la cola. */
  next: boolean;
}

/** Mañana 10:00 en hora de Lima, para «Volver a llamar». */
function tomorrowAtTen() {
  const tomorrow = toLimaInput(new Date(Date.now() + 24 * 3600_000).toISOString()).slice(0, 10);
  return `${tomorrow}T10:00`;
}

function ResultOptions({ value, onChange }: { value: CallResult; onChange: (r: CallResult) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-sm font-medium">¿Cómo terminó la llamada?</legend>
      {RESULT_OPTIONS.map((r) => (
        <label
          key={r}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm",
            value === r && "border-primary bg-primary/5",
          )}
        >
          <input
            type="radio"
            name="wa-call-result"
            value={r}
            checked={value === r}
            onChange={() => onChange(r)}
            className="accent-[#4C2FB5]"
          />
          {CALL_RESULT_LABEL[r]}
        </label>
      ))}
    </fieldset>
  );
}

function CallbackField({
  required,
  value,
  onChange,
}: {
  required: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="wa-call-callback">{required ? "¿Cuándo?" : "Reintentar el"} (hora de Lima)</Label>
      <Input
        id="wa-call-callback"
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-[11px] text-muted-foreground">
        {required
          ? "Se crea una tarea «Volver a llamar» en tu Agenda."
          : "Se crea una tarea para reintentar la llamada en tu Agenda. Déjalo vacío si no quieres tarea."}
      </p>
    </div>
  );
}

function LostReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="wa-call-lost">Motivo</Label>
      <select
        id="wa-call-lost"
        className={NATIVE_SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {CALL_LOST_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
    </div>
  );
}

function ClosingField({
  checked,
  text,
  onToggle,
  onText,
}: {
  checked: boolean;
  text: string;
  onToggle: (v: boolean) => void;
  onText: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-teal-600"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
        />
        Enviar mensaje de cierre por WhatsApp
      </label>
      {checked && (
        <Textarea
          aria-label="Texto del cierre"
          rows={2}
          maxLength={600}
          value={text}
          onChange={(e) => onText(e.target.value)}
        />
      )}
    </div>
  );
}

/** Al colgar: cómo terminó, qué sigue y el mensaje de cierre. */
export default function CallResultCard({
  session,
  saving,
  queueMode,
  doneSteps,
  onSave,
  onClose,
}: {
  session: CallSession;
  saving: boolean;
  queueMode: boolean;
  /** Pasos del guion que la vendedora marcó en la llamada. */
  doneSteps: number[];
  onSave: (outcome: CallOutcome) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<CallResult>(session.answeredAt ? "sold" : "no_answer");
  const [notes, setNotes] = useState("");
  const [callbackAt, setCallbackAt] = useState(tomorrowAtTen);
  const [lostReason, setLostReason] = useState(CALL_LOST_REASONS[0]);
  // null = lo que propone el resultado; con valor = lo que eligió la vendedora.
  const [closingOn, setClosingOn] = useState<boolean | null>(null);
  const [closingText, setClosingText] = useState<string | null>(null);

  const isLost = result === "not_interested";
  // «No contestó» también deja una tarea para reintentar (fecha editable).
  const needsDate = result === "callback" || result === "no_answer";
  const missingDate = result === "callback" && !callbackAt;
  const sendClosing = !!session.conversationId && (closingOn ?? sendsClosingByDefault(result));
  const closing = closingText ?? closingMessage(result, firstName(session));

  const chooseResult = (r: CallResult) => {
    setResult(r);
    setClosingOn(null);
    setClosingText(null);
  };

  const save = (next: boolean) => {
    if (missingDate || saving) return;
    const summary = [isLost ? `Motivo: ${lostReason}` : "", notes.trim()].filter(Boolean).join(" · ");
    onSave({
      input: {
        result,
        ...(summary ? { notes: summary } : {}),
        ...(needsDate && callbackAt ? { callbackAt: fromLimaInput(callbackAt) } : {}),
      },
      closing: sendClosing ? closing.trim() || null : null,
      lostReason: isLost ? lostReason : null,
      next,
    });
  };

  return (
    <CallShell title={contactOf(session)} onClose={onClose} label="Resultado de la llamada">
      <p className="text-sm text-muted-foreground">
        Llamada terminada
        {session.durationSeconds != null ? ` · ${formatTimer(session.durationSeconds)}` : ""}
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save(queueMode);
        }}
      >
        <ResultOptions value={result} onChange={chooseResult} />
        {needsDate && (
          <CallbackField required={result === "callback"} value={callbackAt} onChange={setCallbackAt} />
        )}
        {isLost && <LostReasonField value={lostReason} onChange={setLostReason} />}
        <div className="space-y-1.5">
          <Label htmlFor="wa-call-notes">Resumen (opcional)</Label>
          <Textarea
            id="wa-call-notes"
            value={notes}
            maxLength={900}
            rows={3}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="¿Qué se habló?"
          />
        </div>
        {session.conversationId && (
          <ClosingField checked={sendClosing} text={closing} onToggle={setClosingOn} onText={setClosingText} />
        )}
        <Button type="submit" className="w-full" disabled={saving || missingDate}>
          {saving && <Loader2 className="animate-spin" />}
          {queueMode ? "Guardar y llamar al siguiente" : "Guardar"}
        </Button>
        {queueMode && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={saving || missingDate}
            onClick={() => save(false)}
          >
            Guardar y salir del modo llamadas
          </Button>
        )}
      </form>
      <CallScript title="Lo que se cumplió del guion" done={doneSteps} />
      {session.direction === "out" && session.durationSeconds != null && (
        <p className="text-[11px] text-muted-foreground">
          Llamada hecha por la vendedora: Meta la cobra por duración.
        </p>
      )}
    </CallShell>
  );
}
