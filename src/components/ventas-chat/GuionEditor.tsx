"use client";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useSaveScript, useSaveScriptOverride, useScript, useSheets } from "@/hooks/useCrmContent";
import type { Script, ScriptStep, ScriptStepOverride, Sheet } from "@/types/crmContent";
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
import { ContentError, ContentLoading, formatDateTime } from "./ContentStatus";

/** Pasos del guion general (de la empresa o de una tienda). Se monta con `key` por versión y tienda. */
function GeneralSteps({ script, storeId }: { script: Script; storeId: string }) {
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
      ...(storeId ? { storeId } : {}),
    });
  };

  return (
    <div className="space-y-3">
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
        Guardar y avisar a las vendedoras
      </Button>

      <ConfirmDialog
        open={confirm}
        title="¿Guardar una nueva versión del guion?"
        description="Las vendedoras verán un aviso «Hay un guion nuevo» y deberán marcarlo como leído. Pau también usará el guion nuevo."
        confirmLabel="Guardar versión"
        onCancel={() => setConfirm(false)}
        onConfirm={doSave}
      />
    </div>
  );
}

type Level = "gen" | "cat" | "prod";

/** Texto que hereda un paso: el de la categoría del producto (si la tiene) o el general. */
function inheritedFor(
  step: ScriptStep,
  i: number,
  level: Level,
  sheet: Sheet | undefined,
  storeId: string,
  overrides: Script["overrides"],
): ScriptStepOverride & { from: string } {
  if (level === "prod" && sheet?.category) {
    const cat = overrides?.[`cat:${sheet.storeId ?? storeId}:${sheet.category}`]?.[String(i)];
    if (cat && (cat.message || cat.question)) {
      return {
        message: cat.message || step.message,
        question: cat.question || step.question,
        from: `Categoría ${sheet.category}`,
      };
    }
  }
  return { message: step.message, question: step.question, from: "General" };
}

/** Pasos propios de una categoría o un producto: lo vacío hereda. */
function OverrideSteps({
  script,
  overrideKey,
  level,
  sheet,
  storeId,
  label,
}: {
  script: Script;
  overrideKey: string;
  level: Level;
  sheet: Sheet | undefined;
  storeId: string;
  label: string;
}) {
  const save = useSaveScriptOverride();
  const saved = script.overrides?.[overrideKey] ?? {};
  const [own, setOwn] = useState<Record<string, ScriptStepOverride>>(saved);
  const [confirm, setConfirm] = useState(false);
  const patch = (i: number, p: Partial<ScriptStepOverride>) =>
    setOwn((o) => ({ ...o, [String(i)]: { ...(o[String(i)] ?? { message: "", question: "" }), ...p } }));
  const clear = (i: number) =>
    setOwn((o) => {
      const next = { ...o };
      delete next[String(i)];
      return next;
    });
  const doSave = () => {
    setConfirm(false);
    save.mutate({
      key: overrideKey,
      steps: script.steps.map((_, i) => ({
        index: i,
        message: own[String(i)]?.message.trim() ?? "",
        question: own[String(i)]?.question.trim() ?? "",
      })),
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Deja vacío lo que quieras heredar. El texto gris es lo que se usa hoy.</p>
      <ol className="space-y-3">
        {script.steps.map((st, i) => {
          const h = inheritedFor(st, i, level, sheet, storeId, script.overrides);
          const mine = own[String(i)];
          const has = !!(mine?.message.trim() || mine?.question.trim());
          return (
            <li key={i} className="space-y-2 rounded-md border p-3" data-testid="guion-override-step">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <b className="text-sm">{st.name}</b>
                {has ? (
                  <>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Personalizado
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => clear(i)}>
                      Volver a heredar
                    </Button>
                  </>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Hereda de {h.from}
                  </span>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`go-msg-${i}`}>Qué dice la vendedora</Label>
                  <Textarea
                    id={`go-msg-${i}`}
                    rows={3}
                    maxLength={SCRIPT_MESSAGE_MAX}
                    placeholder={h.message}
                    value={mine?.message ?? ""}
                    onChange={(e) => patch(i, { message: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`go-q-${i}`}>Pregunta para avanzar</Label>
                  <Textarea
                    id={`go-q-${i}`}
                    rows={3}
                    maxLength={SCRIPT_QUESTION_MAX}
                    placeholder={h.question || "Sin pregunta"}
                    value={mine?.question ?? ""}
                    onChange={(e) => patch(i, { question: e.target.value })}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Button disabled={save.isPending} onClick={() => setConfirm(true)}>
        Guardar y avisar a las vendedoras
      </Button>
      <ConfirmDialog
        open={confirm}
        title={`¿Guardar el guion de ${label}?`}
        description="Las vendedoras verán un aviso «Hay un guion nuevo» y deberán marcarlo como leído. Pau usará estos pasos en los chats de este producto o categoría."
        confirmLabel="Guardar versión"
        onCancel={() => setConfirm(false)}
        onConfirm={doSave}
      />
    </div>
  );
}

const SELECT =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Guion «Venta en 1 minuto» (mockup 152): un guion general por tienda y pasos
 * propios por categoría o producto; lo que no se cambia se hereda.
 */
export default function GuionEditor() {
  const { stores } = useCrmMe();
  const [pickedStore, setStore] = useState<string | null>(null);
  const storeId = pickedStore ?? stores[0]?.id ?? "";
  const [level, setLevel] = useState<Level>("gen");
  const [target, setTarget] = useState("");
  const script = useScript(true, storeId || null);
  const sheets = useSheets("", level !== "gen");
  const mine = useMemo(
    () => (sheets.data ?? []).filter((x) => !storeId || !x.storeId || x.storeId === storeId),
    [sheets.data, storeId],
  );
  const categories = useMemo(
    () => [...new Set(mine.map((x) => x.category?.trim()).filter((x): x is string => !!x))].sort(),
    [mine],
  );
  const options = level === "cat" ? categories.map((c) => [c, c] as const) : mine.map((x) => [x.id, x.name] as const);
  const value = options.some(([v]) => v === target) ? target : (options[0]?.[0] ?? "");
  const sheet = level === "prod" ? mine.find((x) => x.id === value) : undefined;
  const overrideKey = !value ? "" : level === "cat" ? `cat:${storeId}:${value}` : `prod:${value}`;
  const storeName = stores.find((x) => x.id === storeId)?.name ?? "la empresa";
  const s = script.data;

  return (
    <section aria-labelledby="guion-editor" className="space-y-3 rounded-md border bg-card p-4">
      <div>
        <h2 id="guion-editor" className="text-base font-semibold">
          Guion «Venta en 1 minuto»
        </h2>
        <p className="text-sm text-muted-foreground">
          Hay un guion general por tienda. Puedes personalizar pasos por categoría o por producto; lo que no cambies se
          hereda.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pau lee automáticamente este guion, las objeciones activas y las fichas de producto activas, además de su
          «Conocimiento». En el chat, cada paso se carga en la caja de mensaje sin enviarse.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {stores.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="g-store">Tienda</Label>
            <select id="g-store" className={SELECT} value={storeId} onChange={(e) => setStore(e.target.value)}>
              {stores.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="g-level">Aplicar a</Label>
          <select id="g-level" className={SELECT} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            <option value="gen">{stores.length ? "Guion general de la tienda" : "Guion general"}</option>
            <option value="cat">Una categoría</option>
            <option value="prod">Un producto</option>
          </select>
        </div>
        {level !== "gen" && (
          <div className="space-y-1">
            <Label htmlFor="g-target">{level === "cat" ? "Categoría" : "Producto"}</Label>
            <select id="g-target" className={SELECT} value={value} onChange={(e) => setTarget(e.target.value)}>
              {options.map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {script.isLoading && <ContentLoading label="Cargando guion…" />}
      {script.isError && <ContentError error={script.error} onRetry={() => script.refetch()} />}
      {s && (
        <div
          role="note"
          className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm"
          data-testid="guion-version"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            <b>{stores.length ? storeName : "Guion"}</b>
            {" · "}
            {s.version === 0
              ? "aún sin versión guardada"
              : `Versión ${s.version}${s.updatedByName ? ` · ${s.updatedByName}` : ""}${
                  s.updatedAt ? ` · ${formatDateTime(s.updatedAt)}` : ""
                }${s.note ? ` · ${s.note}` : ""}`}
            {s.isMethodology && " · Pasos de la metodología POWIP: edítalos y guarda para hacerlos tuyos."}
            {!s.isMethodology && s.inheritsGeneral && " · Esta tienda usa el guion general de la empresa."}
          </span>
        </div>
      )}

      {s && level === "gen" && <GeneralSteps key={`${storeId}:${s.version}`} script={s} storeId={storeId} />}
      {s && level !== "gen" && sheets.isLoading && <ContentLoading />}
      {s && level !== "gen" && !sheets.isLoading && !overrideKey && (
        <p role="status" className="text-sm text-muted-foreground">
          {level === "cat"
            ? "Aún no hay categorías: asígnalas en las fichas de producto."
            : "Aún no hay fichas de producto en esta tienda."}
        </p>
      )}
      {s && level !== "gen" && overrideKey && (
        <OverrideSteps
          key={`${overrideKey}:${s.version}`}
          script={s}
          overrideKey={overrideKey}
          level={level}
          sheet={sheet}
          storeId={storeId}
          label={level === "cat" ? `la categoría ${value}` : (sheet?.name ?? "este producto")}
        />
      )}
    </section>
  );
}
