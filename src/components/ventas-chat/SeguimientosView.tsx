"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Info, Loader2, Pencil, Plus, Send, Sparkles, Trash2 } from "lucide-react";
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
import { useCrmMe } from "@/hooks/useCrmMe";
import { useCrmSettings } from "@/hooks/useCrmTeam";
import type { FollowupMonthStats, FollowupRule, FollowupRun, FollowupStats, Stage, Template } from "@/types/crm";
import { CRM_UNREACHABLE } from "./ConversationList";
import ConfirmDialog from "./ConfirmDialog";
import { FollowupLimitsCard } from "./AjustesCards";
import RuleDialog from "./RuleDialog";
import {
  OBJECTIVES,
  OBJECTIVE_LABEL,
  CATEGORY_LABEL,
  COST_PER_MESSAGE,
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
import { CHANNEL_LABEL, NATIVE_SELECT_CLASS, bandejaUrl, contactLabel, formatMoney, relativeTime } from "./format";
import { PDF_PRESETS, presetStage } from "./seguimientosPresets";
import { useUpcomingFollowups, useUpcomingMutations } from "./seguimientosUpcoming";

/** Secuencias del PDF + «Sin respuesta del equipo» (recordatorio interno). */
const SEQUENCES: Preset[] = [...PDF_PRESETS, ...PRESETS.filter((p) => p.key === "equipo-sin-respuesta")];

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-3" data-testid="stat-card">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MonthSection({ month }: { month: FollowupMonthStats }) {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <section aria-label="Seguimientos de este mes" className="space-y-2">
      <h2 className="text-sm font-semibold">Seguimientos de este mes</h2>
      <div className="rounded-md border bg-card p-3" data-testid="month-card">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-muted/40 p-2 text-center">
            <p className="text-2xl font-semibold tabular-nums">{month.sent}</p>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2 text-center">
            <p className="text-2xl font-semibold tabular-nums text-primary">{month.sentFree}</p>
            <p className="text-xs text-muted-foreground">Gratis en ventana</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2 text-center">
            <p className="text-2xl font-semibold tabular-nums">{month.sentTemplate}</p>
            <p className="text-xs text-muted-foreground">Con plantilla</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground" data-testid="month-summary">
          {month.sentTemplate > 0
            ? `${plural(month.sentTemplate, "plantilla costó", "plantillas costaron")} aprox. ${formatMoney(month.templateCost)}, cobrados directo en tu cuenta de Meta. `
            : "Este mes no se usaron plantillas: todos los envíos fueron gratis. "}
          {month.recoveredSales > 0
            ? `Los seguimientos recuperaron ${plural(month.recoveredSales, "venta", "ventas")} por ${formatMoney(month.recoveredAmount)}.`
            : "Aún no hay ventas pagadas después de un seguimiento."}
        </p>
      </div>
    </section>
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
        <li>Los seguimientos con plantilla solo aplican a chats de WhatsApp; Messenger e Instagram quedan fuera.</li>
        <li>
          Solo se escribe dentro del horario de envío de «Límites» (por defecto de 07:00 a 20:00, hora
          de Lima).
        </li>
        <li>
          Cada cliente recibe como máximo los mensajes automáticos por semana que fija «Límites»
          (por defecto 3), sumando todas las reglas. Si el cliente responde, se cancela solo.
        </li>
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

/** Solo administrador: los ajustes del CRM son suyos. */
function LimitsSection() {
  const { data } = useCrmSettings();
  return data ? <FollowupLimitsCard settings={data} /> : null;
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

/** Costo por envío, como la columna «Costo» del mockup 152. */
function ruleCost(rule: FollowupRule, templates: Template[] | undefined): { label: string; tone: "ok" | "warn" | "info" } {
  if (rule.target === "agent") return { label: "Interno · gratis", tone: "info" };
  if (!rule.templateName) return { label: "Gratis", tone: "ok" };
  const tpl = templates?.find((t) => t.name === rule.templateName);
  const unit = tpl ? COST_PER_MESSAGE[tpl.category] : undefined;
  return {
    label: `Gratis en ventana · plantilla${unit !== undefined ? ` (S/ ${unit.toFixed(2)})` : ""}`,
    tone: "warn",
  };
}

const PILL: Record<"ok" | "warn" | "info", string> = {
  ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  warn: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  info: "bg-[#4C2FB5]/10 text-[#4C2FB5] dark:text-violet-300",
};

function Pill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", PILL[tone])}>
      {children}
    </span>
  );
}

function Card({
  title,
  description,
  action,
  children,
  label,
  testId,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  label?: string;
  testId?: string;
}) {
  return (
    <section aria-label={label ?? title} data-testid={testId} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RuleRow({
  rule,
  stages,
  templates,
  isAdmin,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  rule: FollowupRule;
  stages: Stage[];
  templates: Template[] | undefined;
  isAdmin: boolean;
  onToggle: (r: FollowupRule, active: boolean) => void;
  onEdit: (r: FollowupRule) => void;
  onDuplicate: (r: FollowupRule) => void;
  onDelete: (r: FollowupRule) => void;
}) {
  const cost = ruleCost(rule, templates);
  return (
    <tr data-testid="rule-row" className={cn("border-t align-top", !rule.active && "opacity-80")}>
      <td className="px-3 py-2">
        <span className="font-medium">{rule.name}</span>
        <span className="block text-[11px] text-muted-foreground">
          {summarizeRule(rule, stageNameOf(stages, rule.stageId))}
        </span>
      </td>
      <td className="px-3 py-2 text-xs">{stageNameOf(stages, rule.stageId) ?? "Etapas abiertas"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-xs">
        {rule.trigger === "stage_idle" ? "en etapa " : "sin respuesta "}
        {formatWait(rule.waitMinutes)}
      </td>
      <td className="px-3 py-2 text-xs">
        <Pill tone={rule.target === "agent" ? "info" : "ok"}>
          {rule.target === "agent" ? "Vendedora" : "Cliente"}
        </Pill>
      </td>
      <td className="max-w-[340px] px-3 py-2 text-xs">
        <span className="line-clamp-2 whitespace-pre-wrap">{rule.message}</span>
      </td>
      <td className="px-3 py-2">
        <Pill tone={cost.tone}>{cost.label}</Pill>
      </td>
      <td className="px-3 py-2">
        {isAdmin ? (
          <Switch
            checked={rule.active}
            aria-label={`Activar ${rule.name}`}
            onCheckedChange={(v) => onToggle(rule, v)}
          />
        ) : (
          <Badge variant="outline">{rule.active ? "Activa" : "Pausada"}</Badge>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        {isAdmin ? (
          <div className="flex justify-end gap-1">
            <Button type="button" size="sm" variant="outline" onClick={() => onEdit(rule)}>
              <Pencil /> Editar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Duplicar ${rule.name}`}
              onClick={() => onDuplicate(rule)}
            >
              <Copy />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Eliminar regla ${rule.name}`}
              onClick={() => onDelete(rule)}
            >
              <Trash2 />
            </Button>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">Solo el administrador</span>
        )}
      </td>
    </tr>
  );
}

const RULE_HEAD = ["Regla", "Etapa", "Cuándo", "A quién", "Mensaje", "Costo", "Activa", ""];

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
            const info = RESULT_INFO[r.result] ?? { label: r.result, tone: "muted" as const };
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

const STATUS_PILL: Record<string, { label: string; tone: keyof typeof PILL }> = {
  APPROVED: { label: "Aprobada", tone: "ok" },
  PENDING: { label: "En revisión", tone: "warn" },
  REJECTED: { label: "Rechazada", tone: "warn" },
  PAUSED: { label: "Pausada", tone: "warn" },
  DISABLED: { label: "Desactivada", tone: "warn" },
};

/** Biblioteca de plantillas de WhatsApp (la misma de Notificaciones). Solo lectura. */
function TemplatesSection({
  templates,
  rules,
  error,
}: {
  templates: Template[] | undefined;
  rules: FollowupRule[];
  error: string | null;
}) {
  return (
    <Card
      title="Plantillas de WhatsApp"
      description="Es la misma biblioteca del módulo de Notificaciones. Las de venta y las de envío viven juntas, con su aprobación de Meta."
      action={
        <Button asChild size="sm" variant="outline">
          <Link href="/comercial/notificaciones">
            <ExternalLink /> Gestionar en Notificaciones
          </Link>
        </Button>
      }
    >
      {error && <p className="text-xs text-muted-foreground">No se pudieron cargar las plantillas: {error}</p>}
      {templates && templates.length === 0 && (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Aún no hay plantillas. Créalas en Notificaciones y espera la aprobación de Meta.
        </p>
      )}
      {templates && templates.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Plantilla</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="px-3 py-2 font-medium">Estado en Meta</th>
                <th className="px-3 py-2 text-right font-medium">Costo aprox.</th>
                <th className="px-3 py-2 font-medium">Dónde se usa</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => {
                const st = STATUS_PILL[t.status] ?? { label: t.status, tone: "warn" as const };
                const unit = COST_PER_MESSAGE[t.category];
                const usedBy = rules.filter((r) => r.templateName === t.name).map((r) => r.name);
                return (
                  <tr key={templateKey(t)} data-testid="template-row" className="border-t align-top">
                    <td className="px-3 py-2">
                      <span className="font-medium">{t.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{t.language}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{CATEGORY_LABEL[t.category] ?? t.category}</td>
                    <td className="px-3 py-2">
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">
                      {unit !== undefined ? `S/ ${unit.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {usedBy.length ? usedBy.join(", ") : "Sin reglas"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function UpcomingSection({ isAdmin, templates }: { isAdmin: boolean; templates: Template[] | undefined }) {
  const q = useUpcomingFollowups();
  const { sendNow, cancel } = useUpcomingMutations();
  const items = q.data ?? [];
  const hour = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });
  return (
    <Card
      title="Programados para hoy"
      description="Puedes adelantarlos o cancelarlos uno por uno."
      testId="upcoming"
      action={<Pill tone="info">{items.length} pendientes</Pill>}
    >
      {q.isError && (
        <p role="alert" className="text-xs text-destructive">
          {crmError(q.error).message}
        </p>
      )}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Hora</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Regla</th>
              <th className="px-3 py-2 font-medium">Canal</th>
              <th className="px-3 py-2 font-medium">Costo</th>
              <th className="px-3 py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center">
                  <p className="text-sm font-medium">No hay envíos programados para hoy</p>
                  <p className="text-xs text-muted-foreground">
                    Cuando un cliente lea y no responda, aparecerá aquí.
                  </p>
                </td>
              </tr>
            )}
            {items.map((u) => {
              const tpl = u.templateName ? templates?.find((t) => t.name === u.templateName) : undefined;
              const unit = tpl ? COST_PER_MESSAGE[tpl.category] : undefined;
              return (
                <tr key={`${u.ruleId}:${u.conversationId}`} data-testid="upcoming-row" className="border-t">
                  <td className="px-3 py-2 font-semibold tabular-nums">{hour(u.dueAt)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={bandejaUrl(u.conversationId)}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {u.contactName ?? "Contacto"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{u.ruleName}</td>
                  <td className="px-3 py-2 text-xs">
                    {CHANNEL_LABEL[u.channel as keyof typeof CHANNEL_LABEL] ?? u.channel}
                  </td>
                  <td className="px-3 py-2">
                    {u.target === "agent" ? (
                      <Pill tone="info">Interno</Pill>
                    ) : u.viaTemplate ? (
                      <Pill tone="warn">{unit !== undefined ? `S/ ${unit.toFixed(2)}` : "Plantilla"}</Pill>
                    ) : (
                      <Pill tone="ok">Gratis</Pill>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {isAdmin ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={sendNow.isPending}
                          aria-label={`Enviar ahora a ${u.contactName ?? "contacto"}`}
                          onClick={() =>
                            sendNow.mutate(u, {
                              onSuccess: (r) =>
                                toast.success(r.detail ? `Listo: ${r.detail}` : "Seguimiento enviado."),
                            })
                          }
                        >
                          <Send /> Enviar ahora
                        </Button>{" "}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={cancel.isPending}
                          aria-label={`Cancelar envío a ${u.contactName ?? "contacto"}`}
                          onClick={() =>
                            cancel.mutate(u, { onSuccess: () => toast.success("Envío cancelado.") })
                          }
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Solo el administrador</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type RuleDialogState = { rule?: FollowupRule } | null;

/** Pestaña Seguimientos (mockup 152): mes, límites, reglas, secuencias, plantillas y programados. */
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
  const { isAdmin } = useCrmMe();

  const stages = useMemo(() => pipelines.data?.flatMap((p) => p.stages) ?? [], [pipelines.data]);
  const wonStage = useMemo(() => firstWonStage(pipelines.data), [pipelines.data]);
  const rules = rulesQ.data ?? [];
  const err = rulesQ.isError ? crmError(rulesQ.error) : null;
  const tplError = templates.isError ? crmError(templates.error).message : null;

  return (
    <div className="space-y-4">
      <HowItWorks />

      <div className="grid gap-4 lg:grid-cols-2">
        {statsQ.data?.month ? (
          <MonthSection month={statsQ.data.month} />
        ) : (
          <StatsSection
            stats={statsQ.data}
            loading={statsQ.isLoading}
            error={statsQ.isError ? crmError(statsQ.error).message : null}
          />
        )}
        {isAdmin ? (
          <LimitsSection />
        ) : (
          <Card
            title="Límites para no cansar al cliente"
            description="Los define el administrador. Se aplican a todas las reglas."
            testId="limits-readonly"
          >
            <p className="text-xs text-muted-foreground">
              Si el cliente responde, paga o pide baja, el seguimiento pendiente se cancela y tú retomas la
              conversación.
            </p>
          </Card>
        )}
      </div>

      {statsQ.data?.month && (
        <StatsSection stats={statsQ.data} loading={false} error={null} />
      )}

      <Card
        title="Reglas de seguimiento"
        description="Rompe-vistos al cliente y recordatorios internos para la vendedora, por etapa del embudo."
        label="Reglas"
        action={
          isAdmin ? (
            <Button type="button" size="sm" onClick={() => setDialog({})}>
              <Plus /> Nueva regla
            </Button>
          ) : (
            <Pill tone="info">Solo el administrador crea o cambia reglas</Pill>
          )
        }
      >
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
            Aún no hay reglas.{isAdmin ? " Crea una o usa una secuencia rápida." : ""}
          </p>
        )}
        {rulesQ.data && rules.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  {RULE_HEAD.map((h, i) => (
                    <th key={i} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              {OBJECTIVES.map((o) => {
                const list = rules
                  .filter((r) => r.objective === o)
                  .sort((a, b) => a.waitMinutes - b.waitMinutes);
                if (list.length === 0) return null;
                return (
                  <tbody key={o} role="group" aria-label={OBJECTIVE_LABEL[o]}>
                    <tr className="border-t bg-muted/30">
                      <td colSpan={RULE_HEAD.length} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {OBJECTIVE_LABEL[o]} · {list.length}
                      </td>
                    </tr>
                    {list.map((r) => (
                      <RuleRow
                        key={r.id}
                        rule={r}
                        stages={stages}
                        templates={templates.data}
                        isAdmin={isAdmin}
                        onToggle={(rule, active) =>
                          m.update.mutate(
                            { id: rule.id, input: { active } },
                            { onSuccess: () => toast.success(`${rule.name} ${active ? "activada" : "pausada"}`) },
                          )
                        }
                        onEdit={(rule) => setDialog({ rule })}
                        onDuplicate={(rule) => {
                          m.create.mutate(duplicateRuleInput(rule), {
                            onSuccess: () => toast.success("Copia creada, pausada."),
                          });
                        }}
                        onDelete={setDeleting}
                      />
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Secuencias rápidas"
        description="Tiempos de la Metodología de Venta por Impulso. Crean varias reglas de una vez; quedan pausadas hasta que las actives."
        label="Secuencias rápidas"
        action={<Sparkles className="h-4 w-4 text-[#4C2FB5]" />}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {SEQUENCES.map((p) => {
            const stage = presetStage(p.key, stages, wonStage);
            const blocked = p.needsWonStage && !stage;
            return (
              <div key={p.key} className="flex flex-col gap-1.5 rounded-md border bg-background p-3">
                <Badge variant="secondary" className="w-fit">
                  {OBJECTIVE_LABEL[p.objective]}
                </Badge>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="flex-1 text-xs text-muted-foreground">{p.description}</p>
                {blocked && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Necesitas una etapa de tipo Ganado en el Embudo.
                  </p>
                )}
                {isAdmin && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={blocked}
                    aria-label={`Crear secuencia ${p.name}`}
                    onClick={() => setPreset(p)}
                  >
                    <Plus /> Usar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <TemplatesSection templates={templates.data} rules={rules} error={tplError} />

      <UpcomingSection isAdmin={isAdmin} templates={templates.data} />

      <Card title="Actividad reciente" description="Lo último que hicieron las reglas.">
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
      </Card>

      {isAdmin && dialog && (
        <RuleDialog
          open
          rule={dialog.rule}
          stages={stages}
          templates={templates.data}
          templatesError={tplError}
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
      <PresetConfirm
        key={preset?.key ?? "none"}
        preset={preset}
        wonStage={preset ? presetStage(preset.key, stages, wonStage) : wonStage}
        onClose={() => setPreset(null)}
      />
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
