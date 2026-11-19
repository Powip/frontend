"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Info, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import {
  useFollowupRuleMutations,
  useFollowupRules,
  useFollowupRuns,
  useFollowupStats,
  useTemplates,
} from "@/hooks/useCrmEngagement";
import { usePipelines } from "@/hooks/useCrmPlanning";
import type { FollowupRule, FollowupRun, FollowupStats, Stage } from "@/types/crm";
import { CRM_UNREACHABLE } from "./ConversationList";
import ConfirmDialog from "./ConfirmDialog";
import RuleDialog from "./RuleDialog";
import {
  OBJECTIVES,
  OBJECTIVE_LABEL,
  PRESETS,
  RESULT_INFO,
  TONE_CLASS,
  approvedTemplates,
  duplicateRuleInput,
  firstWonStage,
  formatWait,
  presetToInputs,
  stageNameOf,
  summarizeRule,
  templateKey,
  type Preset,
} from "./engagement";
import { NATIVE_SELECT_CLASS, bandejaUrl, contactLabel, relativeTime } from "./format";

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-3" data-testid="stat-card">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatsSection({
  stats,
  loading,
  error,
}: {
  stats?: FollowupStats;
  loading: boolean;
  error: string | null;
}) {
  const days = stats?.days ?? 30;
  return (
    <section aria-label="Resumen" className="space-y-2">
      <h2 className="text-sm font-semibold">Últimos {days} días</h2>
      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando resumen…
        </p>
      )}
      {error && <p className="text-sm text-muted-foreground">No se pudo cargar el resumen: {error}</p>}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <StatCard label="Enviados gratis" value={stats.sentFree} hint="Dentro de las 24 h" />
            <StatCard label="Con plantilla" value={stats.sentTemplate} hint="Fuera de las 24 h" />
            <StatCard label="Tareas creadas" value={stats.tasks} hint="Para la vendedora" />
            <StatCard label="Omitidos" value={stats.skipped} hint="No cumplían las condiciones" />
            <StatCard label="Fallidos" value={stats.failed} />
          </div>
          <p className="text-xs text-muted-foreground" data-testid="limits">
            Máximo de mensajes automáticos por conversación en 30 días:{" "}
            {OBJECTIVES.map((o) => `${OBJECTIVE_LABEL[o]} ${stats.limits[o]}`).join(" · ")}.
          </p>
        </>
      )}
    </section>
  );
}

function HowItWorks() {
  return (
    <details className="rounded-md border bg-muted/30 p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <Info className="h-4 w-4" /> Cómo funcionan los seguimientos
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Cada regla vigila las conversaciones y actúa una sola vez por cada silencio.</li>
        <li>
          «El cliente no responde»: pasó el tiempo desde el último mensaje de una persona del equipo.
          «El equipo no responde»: el cliente escribió y nadie contestó. «Tiempo en etapa»: la
          conversación lleva ese tiempo en la etapa elegida.
        </li>
        <li>
          Al cliente se le escribe por WhatsApp: con tu texto si pasaron menos de 24 h desde su último
          mensaje; si pasaron más, solo con la plantilla de la regla (sin plantilla, no se envía).
        </li>
        <li>Solo se escribe entre las 07:00 y las 20:00 (hora de Lima).</li>
        <li>
          Si el destino es la vendedora, se crea una tarea en su Agenda. Si la conversación no tiene
          vendedora asignada, se omite.
        </li>
        <li>
          Hay un máximo de mensajes por conversación en 30 días. Quien pidió no recibir promociones no
          recibe seguimientos de venta ni de postventa.
        </li>
        <li>Sin etapa elegida, la regla solo aplica a tratos en etapas abiertas.</li>
      </ul>
    </details>
  );
}

interface PresetProps {
  preset: Preset | null;
  wonStage: Stage | null;
  onClose: () => void;
}

function PresetConfirm({ preset, wonStage, onClose }: PresetProps) {
  const templates = useTemplates(!!preset?.pickTemplate);
  const m = useFollowupRuleMutations();
  const [key, setKey] = useState("");
  if (!preset) return null;
  const approved = approvedTemplates(templates.data);
  const template = approved.find((t) => templateKey(t) === key) ?? null;
  const templateSteps = preset.steps.filter((s) => s.useTemplate && s.target === "customer").length;

  const create = () => {
    m.createMany.mutate(
      presetToInputs(preset, { stageId: wonStage?.id ?? null, template }),
      {
        onSuccess: (rules) => {
          toast.success(
            `${rules.length} reglas creadas, pausadas. Actívalas cuando estés lista.`,
          );
          onClose();
        },
      },
    );
  };
  const m2 = m.createMany;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{preset.name}</DialogTitle>
          <DialogDescription>
            Se crean {preset.steps.length} reglas <b>pausadas</b>. No envían nada hasta que las
            actives una por una.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 text-sm">
          {preset.steps.map((s) => (
            <li key={s.name} className="flex justify-between gap-2 rounded-md border px-2 py-1">
              <span>{s.name}</span>
              <span className="text-xs text-muted-foreground">
                {s.target === "agent" ? "Tarea · " : ""}
                {formatWait(s.waitMinutes)}
              </span>
            </li>
          ))}
        </ul>
        {preset.pickTemplate && templateSteps > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="preset-template">
              Plantilla para los {templateSteps} pasos que van fuera de 24 h
            </Label>
            <select
              id="preset-template"
              className={cn(NATIVE_SELECT_CLASS, "h-9 text-sm")}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            >
              <option value="">Elegir después (esos pasos se omiten fuera de 24 h)</option>
              {approved.map((t) => (
                <option key={templateKey(t)} value={templateKey(t)}>
                  {t.name} · {t.language}
                </option>
              ))}
            </select>
            {templates.isError && (
              <p role="alert" className="text-xs text-destructive">
                No se pudieron cargar las plantillas: {crmError(templates.error).message}
              </p>
            )}
            {template && template.variableCount > 0 && (
              <p className="text-xs text-muted-foreground">
                La plantilla tiene {template.variableCount} variable(s); se rellenan con {"{nombre}"}.
                Revísalas después en cada regla.
              </p>
            )}
          </div>
        )}
        {preset.needsWonStage && (
          <p className="text-xs text-muted-foreground">
            Etapa usada: {wonStage ? `«${wonStage.name}»` : "ninguna"}.
          </p>
        )}
        {m2.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {crmError(m2.error).message}. Puede que algunas reglas ya se hayan creado: revisa la lista.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={m2.isPending} onClick={create}>
            Crear {preset.steps.length} reglas pausadas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleCard({
  rule,
  stages,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  rule: FollowupRule;
  stages: Stage[];
  onToggle: (r: FollowupRule, active: boolean) => void;
  onEdit: (r: FollowupRule) => void;
  onDuplicate: (r: FollowupRule) => void;
  onDelete: (r: FollowupRule) => void;
}) {
  return (
    <li
      data-testid="rule-row"
      className={cn("space-y-1.5 rounded-md border bg-card p-3 text-sm", !rule.active && "opacity-80")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{rule.name}</span>
        <Badge variant="outline">{rule.active ? "Activa" : "Pausada"}</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Switch
            checked={rule.active}
            aria-label={`Activar ${rule.name}`}
            onCheckedChange={(v) => onToggle(rule, v)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {summarizeRule(rule, stageNameOf(stages, rule.stageId))}
      </p>
      <p className="line-clamp-2 whitespace-pre-wrap text-xs">{rule.message}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" onClick={() => onEdit(rule)}>
          <Pencil /> Editar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(rule)}>
          <Copy /> Duplicar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Eliminar regla ${rule.name}`}
          onClick={() => onDelete(rule)}
        >
          <Trash2 /> Eliminar
        </Button>
      </div>
    </li>
  );
}

function RunsTable({ runs }: { runs: FollowupRun[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Regla</th>
            <th className="px-3 py-2 font-medium">Contacto</th>
            <th className="px-3 py-2 font-medium">Resultado</th>
            <th className="px-3 py-2 font-medium">Detalle</th>
            <th className="px-3 py-2 font-medium">Cuándo</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const info = RESULT_INFO[r.result];
            const rel = relativeTime(r.createdAt);
            return (
              <tr key={r.id} data-testid="run-row" className="border-t align-top">
                <td className="px-3 py-2">
                  <span className="font-medium">{r.ruleName}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {OBJECTIVE_LABEL[r.objective]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={bandejaUrl(r.conversationId)}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {contactLabel(r)}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Badge className={TONE_CLASS[info.tone]}>{info.label}</Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.detail ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {rel === "ahora" || rel.includes("/") ? rel : `hace ${rel}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type RuleDialogState = { rule?: FollowupRule } | null;

/** Pestaña Seguimientos: reglas automáticas, secuencias rápidas y actividad reciente. */
export default function SeguimientosView() {
  const rulesQ = useFollowupRules();
  const statsQ = useFollowupStats();
  const runsQ = useFollowupRuns();
  const pipelines = usePipelines();
  const templates = useTemplates();
  const m = useFollowupRuleMutations();
  const [dialog, setDialog] = useState<RuleDialogState>(null);
  const [deleting, setDeleting] = useState<FollowupRule | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);

  const stages = useMemo(() => pipelines.data?.flatMap((p) => p.stages) ?? [], [pipelines.data]);
  const wonStage = useMemo(() => firstWonStage(pipelines.data), [pipelines.data]);
  const rules = rulesQ.data ?? [];
  const err = rulesQ.isError ? crmError(rulesQ.error) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Mensajes y tareas automáticas cuando una conversación se enfría.
        </p>
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          onClick={() => setDialog({})}
        >
          <Plus /> Nueva regla
        </Button>
      </div>

      <HowItWorks />

      <StatsSection
        stats={statsQ.data}
        loading={statsQ.isLoading}
        error={statsQ.isError ? crmError(statsQ.error).message : null}
      />

      <section aria-label="Secuencias rápidas" className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4" /> Secuencias rápidas
        </h2>
        <p className="text-xs text-muted-foreground">
          Crean varias reglas de una vez. Quedan pausadas hasta que las actives.
        </p>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => {
            const blocked = p.needsWonStage && !wonStage;
            return (
              <div key={p.key} className="flex flex-col gap-1.5 rounded-md border bg-card p-3">
                <Badge variant="secondary">{OBJECTIVE_LABEL[p.objective]}</Badge>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="flex-1 text-xs text-muted-foreground">{p.description}</p>
                {blocked && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Necesitas una etapa de tipo Ganado en el Embudo.
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={blocked}
                  aria-label={`Crear secuencia ${p.name}`}
                  onClick={() => setPreset(p)}
                >
                  <Plus /> Crear reglas
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Reglas" className="space-y-3">
        <h2 className="text-sm font-semibold">Reglas</h2>
        {rulesQ.isLoading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando reglas…
          </p>
        )}
        {err && (
          <div role="alert" className="space-y-2 text-sm">
            <p className="font-medium text-destructive">
              {err.unreachable ? CRM_UNREACHABLE : err.message}
            </p>
            <Button size="sm" variant="outline" onClick={() => rulesQ.refetch()}>
              Reintentar
            </Button>
          </div>
        )}
        {rulesQ.data && rules.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Aún no hay reglas. Crea una o usa una secuencia rápida.
          </p>
        )}
        {rulesQ.data &&
          OBJECTIVES.map((o) => {
            const list = rules
              .filter((r) => r.objective === o)
              .sort((a, b) => a.waitMinutes - b.waitMinutes);
            if (list.length === 0) return null;
            return (
              <div key={o} role="group" aria-label={OBJECTIVE_LABEL[o]} className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {OBJECTIVE_LABEL[o]}
                  <Badge variant="secondary">{list.length}</Badge>
                </h3>
                <ul className="grid gap-2 lg:grid-cols-2">
                  {list.map((r) => (
                    <RuleCard
                      key={r.id}
                      rule={r}
                      stages={stages}
                      onToggle={(rule, active) => m.update.mutate({ id: rule.id, input: { active } })}
                      onEdit={(rule) => setDialog({ rule })}
                      onDuplicate={(rule) => {
                        m.create.mutate(duplicateRuleInput(rule), {
                          onSuccess: () => toast.success("Copia creada, pausada."),
                        });
                      }}
                      onDelete={setDeleting}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
      </section>

      <section aria-label="Actividad reciente" className="space-y-2">
        <h2 className="text-sm font-semibold">Actividad reciente</h2>
        {runsQ.isLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            Cargando actividad…
          </p>
        )}
        {runsQ.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {crmError(runsQ.error).message}
          </p>
        )}
        {runsQ.data && runsQ.data.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Todavía no se ejecutó ninguna regla.
          </p>
        )}
        {runsQ.data && runsQ.data.length > 0 && <RunsTable runs={runsQ.data} />}
      </section>

      {dialog && (
        <RuleDialog
          open
          rule={dialog.rule}
          stages={stages}
          templates={templates.data}
          templatesError={templates.isError ? crmError(templates.error).message : null}
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
      <PresetConfirm key={preset?.key ?? "none"} preset={preset} wonStage={wonStage} onClose={() => setPreset(null)} />
      <ConfirmDialog
        open={!!deleting}
        title="Eliminar regla"
        description={deleting ? `Se eliminará «${deleting.name}». No se puede deshacer.` : ""}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) m.remove.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
