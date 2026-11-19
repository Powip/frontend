"use client";
import { useMemo, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useFollowupRuleMutations } from "@/hooks/useCrmEngagement";
import type { FollowupRule, Stage, Template } from "@/types/crm";
import {
  MESSAGE_TOKENS,
  OBJECTIVES,
  OBJECTIVE_LABEL,
  TRIGGER_HELP,
  TRIGGER_LABEL,
  WAIT_UNIT_LABEL,
  approvedTemplates,
  draftFromRule,
  draftToInput,
  emptyRuleDraft,
  fillTemplateBody,
  findTemplate,
  resizeVariables,
  templateKey,
  validateRuleDraft,
  withSampleNames,
  type RuleDraft,
  type WaitUnit,
} from "./engagement";
import { NATIVE_SELECT_CLASS } from "./format";

const SELECT = cn(NATIVE_SELECT_CLASS, "h-9 text-sm");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Regla a editar; sin ella se crea una nueva. */
  rule?: FollowupRule;
  stages: Stage[];
  templates: Template[] | undefined;
  templatesError?: string | null;
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-xs font-medium text-destructive">
      {children}
    </p>
  );
}

/** Crear o editar una regla de seguimiento. */
export default function RuleDialog({
  open,
  onOpenChange,
  rule,
  stages,
  templates,
  templatesError,
}: Props) {
  const m = useFollowupRuleMutations();
  const [d, setD] = useState<RuleDraft>(() => (rule ? draftFromRule(rule) : emptyRuleDraft()));
  const [tried, setTried] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const errors = validateRuleDraft(d);
  const valid = Object.keys(errors).length === 0;
  const pending = m.create.isPending || m.update.isPending;
  const set = <K extends keyof RuleDraft>(k: K, v: RuleDraft[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  const options = useMemo(() => {
    const list = approvedTemplates(templates);
    const current = d.templateName
      ? findTemplate(templates, d.templateName, d.templateLanguage)
      : undefined;
    if (d.templateName && !list.some((t) => t.name === d.templateName && t.language === d.templateLanguage)) {
      return [
        ...list,
        current ?? {
          name: d.templateName,
          language: d.templateLanguage,
          category: "UTILITY" as const,
          status: "DISABLED" as const,
          bodyText: null,
          variableCount: d.templateVariables.length,
        },
      ];
    }
    return list;
  }, [templates, d.templateName, d.templateLanguage, d.templateVariables.length]);

  const selected = d.templateName
    ? findTemplate(templates, d.templateName, d.templateLanguage)
    : undefined;
  const selectedUnavailable = !!d.templateName && selected?.status !== "APPROVED";

  const pickTemplate = (key: string) => {
    if (!key) {
      setD((p) => ({ ...p, templateName: "", templateLanguage: "", templateVariables: [] }));
      return;
    }
    const t = options.find((x) => templateKey(x) === key);
    if (!t) return;
    setD((p) => ({
      ...p,
      templateName: t.name,
      templateLanguage: t.language,
      templateVariables: resizeVariables(p.templateVariables, t.variableCount),
    }));
  };

  const insertToken = (token: string) => {
    const el = messageRef.current;
    const start = el?.selectionStart ?? d.message.length;
    const end = el?.selectionEnd ?? d.message.length;
    const next = d.message.slice(0, start) + token + d.message.slice(end);
    set("message", next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const submit = () => {
    setTried(true);
    if (!valid || pending) return;
    const input = draftToInput(d);
    const done = { onSuccess: () => onOpenChange(false) };
    if (rule) m.update.mutate({ id: rule.id, input }, done);
    else m.create.mutate(input, done);
  };

  const serverError = m.create.error ?? m.update.error;
  const showErr = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regla" : "Nueva regla"}</DialogTitle>
          <DialogDescription>
            Define cuándo actúa la regla y qué hace. La hora de envío es de Lima, entre 07:00 y 20:00.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Nombre</Label>
            <Input
              id="rule-name"
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ej.: +2 h · recordatorio"
              maxLength={120}
              autoFocus
            />
            <FieldError>{showErr("name")}</FieldError>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-objective">Objetivo</Label>
              <select
                id="rule-objective"
                className={SELECT}
                value={d.objective}
                onChange={(e) => set("objective", e.target.value as RuleDraft["objective"])}
              >
                {OBJECTIVES.map((o) => (
                  <option key={o} value={o}>
                    {OBJECTIVE_LABEL[o]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-trigger">Cuándo se activa</Label>
              <select
                id="rule-trigger"
                className={SELECT}
                value={d.trigger}
                onChange={(e) => set("trigger", e.target.value as RuleDraft["trigger"])}
              >
                {(Object.keys(TRIGGER_LABEL) as Array<keyof typeof TRIGGER_LABEL>).map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">{TRIGGER_HELP[d.trigger]}</p>

          <div className="space-y-1.5">
            <Label htmlFor="rule-stage">
              Etapa{d.trigger === "stage_idle" ? " (obligatoria)" : " (opcional)"}
            </Label>
            <select
              id="rule-stage"
              className={SELECT}
              value={d.stageId}
              onChange={(e) => set("stageId", e.target.value)}
            >
              <option value="">
                {d.trigger === "stage_idle" ? "Elige una etapa…" : "Todas las etapas abiertas"}
              </option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <FieldError>{showErr("stage")}</FieldError>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-wait">Esperar</Label>
            <div className="flex gap-2">
              <Input
                id="rule-wait"
                type="number"
                min={1}
                className="w-28"
                value={d.waitValue}
                onChange={(e) => set("waitValue", e.target.value)}
              />
              <select
                aria-label="Unidad de espera"
                className={cn(SELECT, "w-36")}
                value={d.waitUnit}
                onChange={(e) => set("waitUnit", e.target.value as WaitUnit)}
              >
                {(Object.keys(WAIT_UNIT_LABEL) as WaitUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {WAIT_UNIT_LABEL[u]}
                  </option>
                ))}
              </select>
            </div>
            <FieldError>{showErr("wait")}</FieldError>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-target">Qué hace</Label>
            <select
              id="rule-target"
              className={SELECT}
              value={d.target}
              onChange={(e) => set("target", e.target.value as RuleDraft["target"])}
            >
              <option value="customer">Enviar WhatsApp al cliente</option>
              <option value="agent">Crear tarea para la vendedora</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-message">
              {d.target === "customer" ? "Mensaje (dentro de 24 h)" : "Nota de la tarea"}
            </Label>
            <Textarea
              id="rule-message"
              ref={messageRef}
              rows={3}
              maxLength={1000}
              value={d.message}
              onChange={(e) => set("message", e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Insertar:</span>
              {MESSAGE_TOKENS.map((t) => (
                <Button
                  key={t.token}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  title={t.label}
                  onClick={() => insertToken(t.token)}
                >
                  {t.token}
                </Button>
              ))}
            </div>
            <FieldError>{showErr("message")}</FieldError>
          </div>

          {d.target === "customer" && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="rule-template">Plantilla para cuando pasaron 24 h (opcional)</Label>
                <select
                  id="rule-template"
                  className={SELECT}
                  value={d.templateName ? templateKey({ name: d.templateName, language: d.templateLanguage }) : ""}
                  onChange={(e) => pickTemplate(e.target.value)}
                >
                  <option value="">Sin plantilla (se omite fuera de 24 h)</option>
                  {options.map((t) => (
                    <option key={templateKey(t)} value={templateKey(t)}>
                      {t.name} · {t.language}
                      {t.status !== "APPROVED" ? " (no aprobada)" : ""}
                    </option>
                  ))}
                </select>
                {templatesError && (
                  <p role="alert" className="text-xs text-destructive">
                    No se pudieron cargar las plantillas: {templatesError}
                  </p>
                )}
                {!templatesError && templates && approvedTemplates(templates).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Aún no tienes plantillas aprobadas por Meta. Sin plantilla, la regla solo envía
                    dentro de las 24 h.
                  </p>
                )}
                {selectedUnavailable && (
                  <p role="alert" className="text-xs text-destructive">
                    Esta plantilla ya no está aprobada: fuera de 24 h el envío fallará. Elige otra.
                  </p>
                )}
              </div>
              {d.templateName && (
                <>
                  {selected?.bodyText && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Vista previa (con datos de ejemplo)</p>
                      <p
                        data-testid="template-preview"
                        className="whitespace-pre-wrap rounded-md bg-muted p-2 text-sm"
                      >
                        {withSampleNames(fillTemplateBody(selected.bodyText, d.templateVariables))}
                      </p>
                    </div>
                  )}
                  {d.templateVariables.map((v, i) => (
                    <div key={i} className="space-y-1">
                      <Label htmlFor={`rule-var-${i}`} className="text-xs">
                        Valor de {`{{${i + 1}}}`}
                      </Label>
                      <Input
                        id={`rule-var-${i}`}
                        value={v}
                        placeholder="Ej.: {nombre}"
                        onChange={(e) =>
                          set(
                            "templateVariables",
                            d.templateVariables.map((x, j) => (j === i ? e.target.value : x)),
                          )
                        }
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label htmlFor="rule-active">Activa</Label>
              <p className="text-xs text-muted-foreground">
                Si queda pausada, la regla no hace nada hasta que la actives.
              </p>
            </div>
            <Switch
              id="rule-active"
              checked={d.active}
              onCheckedChange={(v) => set("active", v)}
            />
          </div>

          {serverError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {crmError(serverError).message}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {rule ? "Guardar cambios" : "Crear regla"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
