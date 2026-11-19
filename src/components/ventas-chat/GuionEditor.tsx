"use client";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSaveScript } from "@/hooks/useCrmContent";
import type { Script, ScriptStep } from "@/types/crmContent";
import ConfirmDialog from "./ConfirmDialog";
import {
  SCRIPT_MAX_STEPS,
  SCRIPT_MESSAGE_MAX,
  SCRIPT_NAME_MAX,
  SCRIPT_NOTE_MAX,
  SCRIPT_QUESTION_MAX,
  emptyStep,
  moveItem,
} from "./ContentLib";
import { formatDateTime } from "./ContentStatus";

/** Editor de los pasos del guion. Se monta con `key={script.version}` para reiniciarse al guardar. */
export default function GuionEditor({ script }: { script: Script }) {
  const save = useSaveScript();
  const [steps, setSteps] = useState<ScriptStep[]>(script.steps.length ? script.steps : [emptyStep()]);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const areas = useRef<Array<HTMLTextAreaElement | null>>([]);

  const patch = (i: number, p: Partial<ScriptStep>) =>
    setSteps((list) => list.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  const insertName = (i: number) => {
    const el = areas.current[i];
    const cur = steps[i].message;
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    patch(i, { message: `${cur.slice(0, start)}{nombre}${cur.slice(end)}`.slice(0, SCRIPT_MESSAGE_MAX) });
  };

  const valid = steps.length >= 1 && steps.every((s) => s.name.trim() && s.message.trim());
  const doSave = () => {
    setConfirm(false);
    save.mutate({
      steps: steps.map((s) => ({ name: s.name.trim(), message: s.message.trim(), question: s.question.trim() })),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <section aria-labelledby="guion-editor" className="space-y-3 rounded-md border bg-card p-4">
      <div>
        <h2 id="guion-editor" className="text-base font-semibold">
          Guion de venta
        </h2>
        <p className="text-sm text-muted-foreground" data-testid="guion-version">
          {script.version === 0
            ? "Aún no hay guion. Arma los pasos y guarda la primera versión."
            : `Versión ${script.version}${script.updatedByName ? ` · ${script.updatedByName}` : ""}${
                script.updatedAt ? ` · ${formatDateTime(script.updatedAt)}` : ""
              }`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pau lee automáticamente este guion, las objeciones activas y las fichas de producto activas, además de su
          «Conocimiento». En el chat, cada paso se carga en la caja de mensaje sin enviarse.
        </p>
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="space-y-2 rounded-md border p-3" data-testid="guion-step">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Paso {i + 1}</span>
              <div className="ml-auto flex gap-1">
                <Button size="icon-sm" variant="ghost" aria-label={`Subir paso ${i + 1}`} disabled={i === 0} onClick={() => setSteps((l) => moveItem(l, i, i - 1))}>
                  <ArrowUp />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Bajar paso ${i + 1}`} disabled={i === steps.length - 1} onClick={() => setSteps((l) => moveItem(l, i, i + 1))}>
                  <ArrowDown />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Quitar paso ${i + 1}`} disabled={steps.length === 1} onClick={() => setSteps((l) => l.filter((_, idx) => idx !== i))}>
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`gs-name-${i}`}>Nombre del paso</Label>
              <Input id={`gs-name-${i}`} maxLength={SCRIPT_NAME_MAX} value={s.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Ej.: Saludo" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`gs-msg-${i}`}>Mensaje</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => insertName(i)} aria-label={`Insertar nombre en el paso ${i + 1}`}>
                  Insertar {"{nombre}"}
                </Button>
              </div>
              <Textarea
                id={`gs-msg-${i}`}
                ref={(el) => {
                  areas.current[i] = el;
                }}
                rows={3}
                maxLength={SCRIPT_MESSAGE_MAX}
                value={s.message}
                onChange={(e) => patch(i, { message: e.target.value })}
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {s.message.length}/{SCRIPT_MESSAGE_MAX}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`gs-q-${i}`}>Pregunta (opcional)</Label>
              <Input id={`gs-q-${i}`} maxLength={SCRIPT_QUESTION_MAX} value={s.question} onChange={(e) => patch(i, { question: e.target.value })} />
            </div>
          </li>
        ))}
      </ol>

      <Button variant="outline" size="sm" disabled={steps.length >= SCRIPT_MAX_STEPS} onClick={() => setSteps((l) => [...l, emptyStep()])}>
        <Plus /> Añadir paso
      </Button>

      <div className="space-y-1">
        <Label htmlFor="guion-note">¿Qué cambió? (opcional)</Label>
        <Input id="guion-note" maxLength={SCRIPT_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: Nuevo paso de cierre" />
      </div>

      <Button disabled={!valid || save.isPending} onClick={() => setConfirm(true)}>
        Guardar nueva versión
      </Button>

      <ConfirmDialog
        open={confirm}
        title="¿Guardar una nueva versión del guion?"
        description="Las vendedoras verán un aviso «Hay un guion nuevo» y deberán marcarlo como leído. Pau también usará el guion nuevo."
        confirmLabel="Guardar versión"
        onCancel={() => setConfirm(false)}
        onConfirm={doSave}
      />
    </section>
  );
}
