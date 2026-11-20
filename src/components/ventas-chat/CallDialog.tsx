"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCallMutations } from "@/hooks/useCrmCalls";
import type { Call, CallDirection, CallResult } from "@/types/crmCalls";
import { fromLimaInput } from "./agenda";
import {
  CALL_DIRECTION_LABEL,
  CALL_RESULT_LABEL,
  CALL_RESULT_ORDER,
  MAX_CALL_SECONDS,
  toSeconds,
} from "./calls";
import { NATIVE_SELECT_CLASS } from "./format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chat al que se vincula la llamada (deja una nota en la conversación). */
  conversationId?: string;
  /** Contacto, solo para el texto de ayuda. */
  contact?: string;
  /** Teléfono ya conocido; sin chat se pide y se puede corregir. */
  phone?: string;
  /** Se llama con la llamada guardada (p. ej. para marcar una tarea como hecha). */
  onSaved?: (call: Call) => void;
}

/** Registrar a mano una llamada hecha o recibida con el teléfono del equipo. */
export default function CallDialog({
  open,
  onOpenChange,
  conversationId,
  contact,
  phone: initialPhone,
  onSaved,
}: Props) {
  const m = useCallMutations();
  const [direction, setDirection] = useState<CallDirection>("out");
  const [result, setResult] = useState<CallResult>("no_answer");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [notes, setNotes] = useState("");
  const [callbackAt, setCallbackAt] = useState("");

  const needsPhone = !conversationId;
  const duration = toSeconds(minutes, seconds);
  const durationInvalid =
    duration !== undefined &&
    (duration > MAX_CALL_SECONDS ||
      Number(seconds) > 59 ||
      Number(minutes) < 0 ||
      Number(seconds) < 0);
  const callbackMissing = result === "callback" && !callbackAt;
  const valid =
    (!needsPhone || !!phone.trim()) && !durationInvalid && !callbackMissing && !m.create.isPending;

  const submit = () => {
    if (!valid) return;
    m.create.mutate(
      {
        ...(conversationId ? { conversationId } : { phone: phone.trim() }),
        direction,
        result,
        ...(duration !== undefined ? { durationSeconds: duration } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(result === "callback" ? { callbackAt: fromLimaInput(callbackAt) } : {}),
      },
      {
        onSuccess: (call) => {
          onSaved?.(call);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar llamada</DialogTitle>
          <DialogDescription>
            {contact
              ? `Anota cómo fue la llamada con ${contact}.`
              : "Anota cómo fue una llamada hecha con tu teléfono."}{" "}
            Powip no hace llamadas: esto es solo un registro.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {needsPhone && (
            <div className="space-y-1.5">
              <Label htmlFor="call-phone">Teléfono</Label>
              <Input
                id="call-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+51 999 999 999"
                maxLength={32}
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="call-direction">Tipo de llamada</Label>
              <select
                id="call-direction"
                className={cn(NATIVE_SELECT_CLASS, "h-9 text-sm")}
                value={direction}
                onChange={(e) => setDirection(e.target.value as CallDirection)}
              >
                {(Object.keys(CALL_DIRECTION_LABEL) as CallDirection[]).map((d) => (
                  <option key={d} value={d}>
                    {CALL_DIRECTION_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-result">Resultado</Label>
              <select
                id="call-result"
                className={cn(NATIVE_SELECT_CLASS, "h-9 text-sm")}
                value={result}
                onChange={(e) => setResult(e.target.value as CallResult)}
              >
                {CALL_RESULT_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {CALL_RESULT_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {result === "callback" && (
            <div className="space-y-1.5">
              <Label htmlFor="call-callback">Volver a llamar el (hora de Lima)</Label>
              <Input
                id="call-callback"
                type="datetime-local"
                value={callbackAt}
                onChange={(e) => setCallbackAt(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Se crea una tarea de llamada en tu Agenda.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Duración (opcional)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label="Minutos"
                placeholder="0"
                className="w-24"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">min</span>
              <Input
                type="number"
                min={0}
                max={59}
                inputMode="numeric"
                aria-label="Segundos"
                placeholder="0"
                className="w-24"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">s</span>
            </div>
            {durationInvalid && (
              <p role="alert" className="text-xs text-destructive">
                La duración debe ser de hasta 240 minutos y los segundos de 0 a 59.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="call-notes">Notas (opcional)</Label>
            <Textarea
              id="call-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid}>
              Guardar llamada
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
