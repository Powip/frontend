"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useAudienceCount, useBroadcastMutations } from "@/hooks/useCrmEngagement";
import type { Audience, AudienceType, Broadcast, BroadcastInput, Stage, Template } from "@/types/crm";
import ConfirmDialog from "./ConfirmDialog";
import { fromLimaInput, toLimaInput } from "./agenda";
import {
  CATEGORY_LABEL,
  COST_PER_MESSAGE,
  approvedTemplates,
  audienceLabel,
  estimateCost,
  fillTemplateBody,
  resizeVariables,
  templateKey,
  withSampleNames,
} from "./engagement";
import { NATIVE_SELECT_CLASS } from "./format";

const SELECT = cn(NATIVE_SELECT_CLASS, "h-9 text-sm");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Borrador a editar; sin él se crea uno nuevo. */
  broadcast?: Broadcast;
  stages: Stage[];
  templates: Template[] | undefined;
  templatesLoading?: boolean;
  templatesError?: string | null;
}

function defaultSchedule() {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  return toLimaInput(d.toISOString());
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={`Paso ${n}: ${title}`} className="space-y-2 rounded-md border p-3">
      <h3 className="text-sm font-semibold">
        {n}. {title}
      </h3>
      {children}
    </section>
  );
}

/** Crear o editar un borrador de difusión: nombre, plantilla, público y envío. */
export default function BroadcastDialog({
  open,
  onOpenChange,
  broadcast,
  stages,
  templates,
  templatesLoading,
  templatesError,
}: Props) {
  const m = useBroadcastMutations();
  const [name, setName] = useState(broadcast?.name ?? "");
  const [tplKey, setTplKey] = useState(
    broadcast ? templateKey({ name: broadcast.templateName, language: broadcast.templateLanguage }) : "",
  );
  const [vars, setVars] = useState<string[]>(broadcast?.templateVariables ?? []);
  const [audType, setAudType] = useState<AudienceType>(broadcast?.audience.type ?? "all");
  const [stageId, setStageId] = useState(broadcast?.audience.stageId ?? "");
  const [days, setDays] = useState(String(broadcast?.audience.inactiveDays ?? 30));
  const [schedule, setSchedule] = useState(false);
  const [when, setWhen] = useState(defaultSchedule);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approved = useMemo(() => approvedTemplates(templates), [templates]);
  const template = approved.find((t) => templateKey(t) === tplKey);
  const noApproved = !templatesLoading && !templatesError && approved.length === 0;

  const audience: Audience | null = useMemo(() => {
    if (audType === "all") return { type: "all" };
    if (audType === "stage") return stageId ? { type: "stage", stageId } : null;
    const n = Number(days);
    return Number.isInteger(n) && n >= 1 && n <= 365
      ? { type: "inactive", inactiveDays: n }
      : null;
  }, [audType, stageId, days]);
  const count = useAudienceCount(audience);

  const pickTemplate = (key: string) => {
    setTplKey(key);
    const t = approved.find((x) => templateKey(x) === key);
    setVars((v) => resizeVariables(v, t?.variableCount ?? 0));
  };

  const varsOk = vars.every((v) => v.trim());
  const draftOk = !!name.trim() && !!template && varsOk && !!audience;
  const whenIso = schedule && when ? fromLimaInput(when) : undefined;
  const whenOk = !schedule || (!!whenIso && new Date(whenIso).getTime() > Date.now());
  const people = count.data;
  const canSend = draftOk && whenOk && typeof people === "number" && people > 0;
  const cost = template ? estimateCost(template.category, people ?? 0) : null;

  const payload = (): BroadcastInput => ({
    name: name.trim(),
    templateName: template!.name,
    templateLanguage: template!.language,
    templateVariables: vars.map((v) => v.trim()),
    audience: audience!,
  });

  const save = async (): Promise<Broadcast> =>
    broadcast
      ? m.update.mutateAsync({ id: broadcast.id, input: payload() })
      : m.create.mutateAsync(payload());

  const saveDraft = async () => {
    if (!draftOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      await save();
      onOpenChange(false);
    } catch (e) {
      setError(crmError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const sendNow = async () => {
    setConfirm(false);
    if (!canSend || busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await save();
      await m.send.mutateAsync({ id: saved.id, scheduledAt: whenIso });
      onOpenChange(false);
    } catch (e) {
      setError(crmError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const whenText = schedule
    ? `el ${new Date(whenIso ?? Date.now()).toLocaleString("es-PE", {
        timeZone: "America/Lima",
        dateStyle: "long",
        timeStyle: "short",
      })} (hora de Lima)`
    : "ahora";
  const confirmText = `Se enviará «${name.trim()}» a ${people ?? 0} ${
    people === 1 ? "persona" : "personas"
  } ${whenText}. El envío va por lotes y solo entre las 07:00 y las 20:00 (hora de Lima). Una vez enviados, los mensajes no se pueden recuperar.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{broadcast ? "Editar difusión" : "Nueva difusión"}</DialogTitle>
          <DialogDescription>
            Manda una plantilla aprobada por Meta a un grupo de contactos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Section n={1} title="Nombre">
            <Label htmlFor="bc-name" className="sr-only">
              Nombre de la difusión
            </Label>
            <Input
              id="bc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej.: Nueva colección de noviembre"
              maxLength={120}
              autoFocus
            />
          </Section>

          <Section n={2} title="Plantilla">
            {templatesLoading && (
              <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando plantillas…
              </p>
            )}
            {templatesError && (
              <p role="alert" className="text-sm text-destructive">
                No se pudieron cargar las plantillas: {templatesError}
              </p>
            )}
            {noApproved && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Necesitas una plantilla aprobada por Meta para hacer una difusión. Crea una en tu
                cuenta de WhatsApp Business y espera su aprobación.
              </p>
            )}
            <Label htmlFor="bc-template" className="sr-only">
              Plantilla
            </Label>
            <select
              id="bc-template"
              className={SELECT}
              value={tplKey}
              disabled={approved.length === 0}
              onChange={(e) => pickTemplate(e.target.value)}
            >
              <option value="">Elige una plantilla…</option>
              {approved.map((t) => (
                <option key={templateKey(t)} value={templateKey(t)}>
                  {t.name} · {t.language} · {CATEGORY_LABEL[t.category]}
                </option>
              ))}
            </select>
            {broadcast && !template && !templatesLoading && (
              <p className="text-xs text-muted-foreground">
                La plantilla guardada ({broadcast.templateName}) ya no está aprobada. Elige otra.
              </p>
            )}
            {template?.bodyText && (
              <p
                data-testid="template-preview"
                className="whitespace-pre-wrap rounded-md bg-muted p-2 text-sm"
              >
                {withSampleNames(fillTemplateBody(template.bodyText, vars))}
              </p>
            )}
            {vars.map((v, i) => (
              <div key={i} className="space-y-1">
                <Label htmlFor={`bc-var-${i}`} className="text-xs">
                  Valor de {`{{${i + 1}}}`}
                </Label>
                <Input
                  id={`bc-var-${i}`}
                  value={v}
                  placeholder="Ej.: {nombre}"
                  onChange={(e) => setVars((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </div>
            ))}
            {vars.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Puedes usar {"{nombre}"} para el nombre del contacto.
              </p>
            )}
          </Section>

          <Section n={3} title="Público">
            <Label htmlFor="bc-audience" className="sr-only">
              Tipo de público
            </Label>
            <select
              id="bc-audience"
              className={SELECT}
              value={audType}
              onChange={(e) => setAudType(e.target.value as AudienceType)}
            >
              <option value="all">Todos los contactos</option>
              <option value="stage">Los de una etapa del embudo</option>
              <option value="inactive">Los que no escriben hace unos días</option>
            </select>
            {audType === "stage" && (
              <select
                aria-label="Etapa del público"
                className={SELECT}
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
              >
                <option value="">Elige una etapa…</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {audType === "inactive" && (
              <div className="flex items-center gap-2">
                <Label htmlFor="bc-days" className="text-xs">
                  Sin escribir hace
                </Label>
                <Input
                  id="bc-days"
                  type="number"
                  min={1}
                  max={365}
                  className="w-24"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
                <span className="text-xs">días</span>
              </div>
            )}
            <p role="status" data-testid="audience-count" className="text-sm font-medium">
              {!audience
                ? "Completa el público para ver cuántos son."
                : count.isLoading
                  ? "Contando…"
                  : count.isError
                    ? `No se pudo contar: ${crmError(count.error).message}`
                    : `Llegará a ${people} ${people === 1 ? "persona" : "personas"}`}
            </p>
            <p className="text-xs text-muted-foreground">
              No incluye a quienes pidieron no recibir promociones.
            </p>
          </Section>

          <Section n={4} title="Resumen y envío">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Plantilla</dt>
                <dd>{template ? template.name : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Público</dt>
                <dd>
                  {audience
                    ? audienceLabel(audience, stages.find((s) => s.id === stageId)?.name)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Personas</dt>
                <dd>{typeof people === "number" ? people : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Costo estimado</dt>
                <dd data-testid="cost-estimate">
                  {cost === null ? "—" : `≈ S/ ${cost.toFixed(2)}`}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Es un cálculo aproximado (Marketing ≈ S/ {COST_PER_MESSAGE.MARKETING?.toFixed(2)} y
              Utilidad ≈ S/ {COST_PER_MESSAGE.UTILITY?.toFixed(2)} por mensaje). El cobro real lo
              hace Meta en tu cuenta de WhatsApp Business.
            </p>
            <div className="flex items-center gap-2">
              <input
                id="bc-schedule"
                type="checkbox"
                checked={schedule}
                onChange={(e) => setSchedule(e.target.checked)}
              />
              <Label htmlFor="bc-schedule">Programar para otra fecha y hora</Label>
            </div>
            {schedule && (
              <div className="space-y-1">
                <Label htmlFor="bc-when" className="text-xs">
                  Fecha y hora (Lima)
                </Label>
                <Input
                  id="bc-when"
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
                {!whenOk && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    Elige una fecha y hora futura.
                  </p>
                )}
              </div>
            )}
          </Section>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" disabled={!draftOk || busy} onClick={saveDraft}>
            Guardar borrador
          </Button>
          <Button type="button" disabled={!canSend || busy} onClick={() => setConfirm(true)}>
            {schedule ? "Programar" : "Enviar ahora"}
          </Button>
        </DialogFooter>
        <ConfirmDialog
          open={confirm}
          title={schedule ? "Confirmar programación" : "Confirmar envío"}
          description={confirmText}
          confirmLabel={schedule ? "Sí, programar" : "Sí, enviar"}
          onCancel={() => setConfirm(false)}
          onConfirm={sendNow}
        />
      </DialogContent>
    </Dialog>
  );
}

