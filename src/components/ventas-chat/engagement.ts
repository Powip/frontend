import type {
  Audience,
  Broadcast,
  BroadcastStatus,
  FollowupRule,
  FollowupRuleInput,
  RuleObjective,
  RuleTrigger,
  RunResult,
  Stage,
  Template,
  TemplateCategory,
} from "@/types/crm";

export const MIN_WAIT_MINUTES = 5;
export const MAX_WAIT_MINUTES = 86_400;

export const OBJECTIVE_LABEL: Record<RuleObjective, string> = {
  sale: "Venta",
  collection: "Cobranza",
  aftersale: "Postventa",
};
export const OBJECTIVES: RuleObjective[] = ["sale", "collection", "aftersale"];

export const TRIGGER_LABEL: Record<RuleTrigger, string> = {
  customer_silent: "El cliente no responde",
  agent_silent: "El equipo no responde",
  stage_idle: "El trato lleva tiempo en una etapa",
};
export const TRIGGER_HELP: Record<RuleTrigger, string> = {
  customer_silent:
    "El cliente no contesta desde el último mensaje de una persona del equipo.",
  agent_silent: "El cliente escribió y nadie del equipo le respondió.",
  stage_idle: "La conversación lleva ese tiempo en la etapa que elijas.",
};

export type Tone = "ok" | "info" | "warn" | "danger" | "muted";

export const RESULT_INFO: Record<RunResult, { label: string; tone: Tone }> = {
  pending: { label: "En cola", tone: "muted" },
  sent: { label: "Enviado (gratis)", tone: "ok" },
  sent_template: { label: "Enviado con plantilla", tone: "info" },
  task: { label: "Tarea creada", tone: "info" },
  skipped_window: { label: "Omitido: ventana de 24 h cerrada", tone: "warn" },
  skipped_limit: { label: "Omitido: llegó al límite", tone: "warn" },
  skipped_opt_out: { label: "Omitido: pidió no recibir promociones", tone: "warn" },
  skipped_unassigned: { label: "Omitido: sin vendedora asignada", tone: "warn" },
  failed: { label: "Falló", tone: "danger" },
};

export const TONE_CLASS: Record<Tone, string> = {
  ok: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  info: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  warn: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  danger: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  muted: "border-transparent bg-muted text-muted-foreground",
};

// --- Espera ---

export type WaitUnit = "minutes" | "hours" | "days";
export const WAIT_UNIT_LABEL: Record<WaitUnit, string> = {
  minutes: "minutos",
  hours: "horas",
  days: "días",
};
const UNIT_MINUTES: Record<WaitUnit, number> = { minutes: 1, hours: 60, days: 1440 };

export function waitToMinutes(value: number, unit: WaitUnit): number {
  return Math.round(value * UNIT_MINUTES[unit]);
}

/** Minutos → número + la unidad más grande que lo divide exacto (120 → 2 horas). */
export function minutesToWait(minutes: number): { value: number; unit: WaitUnit } {
  if (minutes >= 1440 && minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes >= 60 && minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}

/** Texto corto: «30 min», «2 h», «3 días». */
export function formatWait(minutes: number): string {
  const { value, unit } = minutesToWait(minutes);
  if (unit === "minutes") return `${value} min`;
  if (unit === "hours") return `${value} h`;
  return value === 1 ? "1 día" : `${value} días`;
}

export function isValidWait(minutes: number): boolean {
  return (
    Number.isInteger(minutes) && minutes >= MIN_WAIT_MINUTES && minutes <= MAX_WAIT_MINUTES
  );
}

// --- Resumen de reglas ---

type SummaryRule = Pick<
  FollowupRule,
  "trigger" | "stageId" | "waitMinutes" | "target" | "templateName"
>;

/**
 * Frase legible de una regla, p. ej.
 * «Si el cliente no responde en 2 h → WhatsApp al cliente · plantilla X fuera de 24 h».
 */
export function summarizeRule(rule: SummaryRule, stageName?: string | null): string {
  const wait = formatWait(rule.waitMinutes);
  const when =
    rule.trigger === "customer_silent"
      ? `Si el cliente no responde en ${wait}`
      : rule.trigger === "agent_silent"
        ? `Si nadie del equipo responde en ${wait}`
        : `Si el trato lleva ${wait} en ${stageName ? `«${stageName}»` : "la etapa"}`;
  const what =
    rule.target === "agent"
      ? "tarea en la Agenda de la vendedora"
      : rule.templateName
        ? `WhatsApp al cliente · plantilla ${rule.templateName} fuera de 24 h`
        : "WhatsApp al cliente · solo dentro de 24 h";
  return `${when} → ${what}`;
}

export function stageNameOf(stages: Stage[], stageId: string | null): string | null {
  if (!stageId) return null;
  return stages.find((s) => s.id === stageId)?.name ?? null;
}

export interface RuleDraft {
  name: string;
  objective: RuleObjective;
  trigger: RuleTrigger;
  stageId: string;
  waitValue: string;
  waitUnit: WaitUnit;
  target: "customer" | "agent";
  message: string;
  templateName: string;
  templateLanguage: string;
  templateVariables: string[];
  active: boolean;
}

export function emptyRuleDraft(): RuleDraft {
  return {
    name: "",
    objective: "sale",
    trigger: "customer_silent",
    stageId: "",
    waitValue: "2",
    waitUnit: "hours",
    target: "customer",
    message: "",
    templateName: "",
    templateLanguage: "",
    templateVariables: [],
    active: false,
  };
}

export function draftFromRule(rule: FollowupRule): RuleDraft {
  const w = minutesToWait(rule.waitMinutes);
  return {
    name: rule.name,
    objective: rule.objective,
    trigger: rule.trigger,
    stageId: rule.stageId ?? "",
    waitValue: String(w.value),
    waitUnit: w.unit,
    target: rule.target,
    message: rule.message,
    templateName: rule.templateName ?? "",
    templateLanguage: rule.templateLanguage ?? "",
    templateVariables: rule.templateVariables,
    active: rule.active,
  };
}

/** Errores por campo; vacío = se puede guardar. */
export function validateRuleDraft(d: RuleDraft): Partial<Record<"name" | "stage" | "wait" | "message", string>> {
  const errors: Partial<Record<"name" | "stage" | "wait" | "message", string>> = {};
  if (!d.name.trim()) errors.name = "Ponle un nombre a la regla.";
  if (d.trigger === "stage_idle" && !d.stageId) {
    errors.stage = "Elige la etapa: este disparador la necesita.";
  }
  const minutes = waitToMinutes(Number(d.waitValue), d.waitUnit);
  if (!isValidWait(minutes)) {
    errors.wait = "La espera va de 5 minutos a 60 días.";
  }
  if (!d.message.trim()) errors.message = "Escribe el mensaje.";
  return errors;
}

export function draftToInput(d: RuleDraft): FollowupRuleInput {
  const useTemplate = d.target === "customer" && !!d.templateName;
  return {
    name: d.name.trim(),
    objective: d.objective,
    trigger: d.trigger,
    stageId: d.trigger === "stage_idle" ? d.stageId : d.stageId || null,
    waitMinutes: waitToMinutes(Number(d.waitValue), d.waitUnit),
    target: d.target,
    message: d.message.trim(),
    templateName: useTemplate ? d.templateName : null,
    templateLanguage: useTemplate ? d.templateLanguage : null,
    templateVariables: useTemplate ? d.templateVariables : [],
    active: d.active,
  };
}

/** Copia de una regla para «Duplicar»: queda pausada y con nombre nuevo. */
export function duplicateRuleInput(rule: FollowupRule): FollowupRuleInput {
  return {
    name: `${rule.name} (copia)`,
    objective: rule.objective,
    trigger: rule.trigger,
    stageId: rule.stageId,
    waitMinutes: rule.waitMinutes,
    target: rule.target,
    message: rule.message,
    templateName: rule.templateName,
    templateLanguage: rule.templateLanguage,
    templateVariables: rule.templateVariables,
    active: false,
  };
}

// --- Variables y vista previa de plantillas ---

export const MESSAGE_TOKENS = [
  { token: "{nombre}", label: "Nombre del cliente" },
  { token: "{vendedora}", label: "Vendedora" },
] as const;

/** Reemplaza {{1}}, {{2}}… con los valores dados (los vacíos quedan como {{n}}). */
export function fillTemplateBody(body: string, variables: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (all, n: string) => {
    const v = variables[Number(n) - 1];
    return v && v.trim() ? v : all;
  });
}

/** Vista previa con datos de ejemplo para {nombre} y {vendedora}. */
export function withSampleNames(text: string): string {
  return text.replace(/\{nombre\}/g, "Ana").replace(/\{vendedora\}/g, "Marta");
}

export function templateKey(t: Pick<Template, "name" | "language">): string {
  return `${t.name}|${t.language}`;
}

export function approvedTemplates(templates: Template[] | undefined): Template[] {
  return (templates ?? []).filter((t) => t.status === "APPROVED");
}

export function findTemplate(
  templates: Template[] | undefined,
  name: string,
  language: string,
): Template | undefined {
  return templates?.find((t) => t.name === name && t.language === language);
}

/** Lista de variables con el largo justo (recorta o rellena con vacíos). */
export function resizeVariables(current: string[], count: number): string[] {
  return Array.from({ length: count }, (_, i) => current[i] ?? "");
}

// --- Secuencias rápidas ---

export interface PresetStep {
  name: string;
  trigger: RuleTrigger;
  waitMinutes: number;
  target: "customer" | "agent";
  message: string;
  /** Usa la plantilla elegida para cuando la ventana de 24 h esté cerrada. */
  useTemplate: boolean;
}

export interface Preset {
  key: string;
  objective: RuleObjective;
  name: string;
  description: string;
  steps: PresetStep[];
  /** El disparador es «etapa» y se usa la primera etapa de tipo Ganado. */
  needsWonStage?: boolean;
  pickTemplate?: boolean;
}

const D = 1440;

export const PRESETS: Preset[] = [
  {
    key: "venta-6-dias",
    objective: "sale",
    name: "Seguimiento de venta de 6 días",
    description: "+2 h y +20 h con texto libre · días 2, 4 y 6 con plantilla.",
    pickTemplate: true,
    steps: [
      { name: "+2 h · recordatorio", trigger: "customer_silent", waitMinutes: 120, target: "customer", useTemplate: false, message: "{nombre}, ¿te ayudo a separarla? 🙌" },
      { name: "+20 h · beneficio", trigger: "customer_silent", waitMinutes: 1200, target: "customer", useTemplate: false, message: "{nombre}, la despachamos HOY si confirmas antes de las 3 pm." },
      { name: "Día 2 · plantilla", trigger: "customer_silent", waitMinutes: 2 * D, target: "customer", useTemplate: true, message: "Hola {nombre}, seguimos con tu consulta." },
      { name: "Día 4 · plantilla", trigger: "customer_silent", waitMinutes: 4 * D, target: "customer", useTemplate: true, message: "{nombre}, tu producto sigue disponible." },
      { name: "Día 6 · último aviso", trigger: "customer_silent", waitMinutes: 6 * D, target: "customer", useTemplate: true, message: "{nombre}, es nuestro último mensaje sobre tu consulta." },
    ],
  },
  {
    key: "equipo-sin-respuesta",
    objective: "sale",
    name: "Sin respuesta del equipo",
    description: "A los 15 min y a la hora crea una tarea para la vendedora asignada.",
    steps: [
      { name: "Equipo · 15 min", trigger: "agent_silent", waitMinutes: 15, target: "agent", useTemplate: false, message: "{nombre} escribió y nadie le responde. Contéstale ya." },
      { name: "Equipo · 1 h", trigger: "agent_silent", waitMinutes: 60, target: "agent", useTemplate: false, message: "{nombre} sigue sin respuesta después de 1 hora. {vendedora}, atiéndelo." },
    ],
  },
  {
    key: "cobranza-saldo",
    objective: "collection",
    name: "Cobranza de saldo",
    description: "Avisos al día 1 y 3 al cliente · al día 5 tarea para la vendedora.",
    pickTemplate: true,
    steps: [
      { name: "Saldo · aviso amable", trigger: "customer_silent", waitMinutes: D, target: "customer", useTemplate: true, message: "{nombre}, ¿nos confirmas cuándo pagas el saldo de tu pedido? 🙌" },
      { name: "Saldo · último aviso", trigger: "customer_silent", waitMinutes: 3 * D, target: "customer", useTemplate: true, message: "{nombre}, ¿pagas, reprogramamos o lo cancelamos sin problema?" },
      { name: "Saldo · pasa a la vendedora", trigger: "customer_silent", waitMinutes: 5 * D, target: "agent", useTemplate: false, message: "{vendedora}, {nombre} no respondió a los avisos de saldo. Llámalo." },
    ],
  },
  {
    key: "postventa",
    objective: "aftersale",
    name: "Testimonio y recompra",
    description: "Día 1: ¿te llegó bien? · día 20: novedades. Usa la primera etapa Ganado.",
    pickTemplate: true,
    needsWonStage: true,
    steps: [
      { name: "¿Te llegó bien?", trigger: "stage_idle", waitMinutes: D, target: "customer", useTemplate: false, message: "¿Qué tal te quedó tu pedido, {nombre}? Si te gustó, nos encantaría una foto 💜" },
      { name: "Novedades · día 20", trigger: "stage_idle", waitMinutes: 20 * D, target: "customer", useTemplate: true, message: "Hola {nombre}, llegó lo nuevo." },
    ],
  },
];

/** Reglas (todas inactivas) a crear a partir de un preset. */
export function presetToInputs(
  preset: Preset,
  opts: { stageId: string | null; template: Template | null },
): FollowupRuleInput[] {
  return preset.steps.map((s) => {
    const useTpl = s.useTemplate && s.target === "customer" && !!opts.template;
    return {
      name: s.name,
      objective: preset.objective,
      trigger: s.trigger,
      stageId: s.trigger === "stage_idle" ? opts.stageId : null,
      waitMinutes: s.waitMinutes,
      target: s.target,
      message: s.message,
      templateName: useTpl ? opts.template!.name : null,
      templateLanguage: useTpl ? opts.template!.language : null,
      templateVariables: useTpl
        ? Array.from({ length: opts.template!.variableCount }, () => "{nombre}")
        : [],
      active: false,
    };
  });
}

export function firstWonStage(
  pipelines: Array<{ isDefault: boolean; stages: Stage[] }> | undefined,
): Stage | null {
  if (!pipelines) return null;
  const ordered = [...pipelines].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  for (const p of ordered) {
    const s = p.stages.find((x) => x.kind === "won");
    if (s) return s;
  }
  return null;
}

// --- Difusiones ---

export const BROADCAST_STATUS: Record<BroadcastStatus, { label: string; tone: Tone }> = {
  draft: { label: "Borrador", tone: "muted" },
  scheduled: { label: "Programada", tone: "info" },
  sending: { label: "Enviando", tone: "info" },
  paused: { label: "Pausada", tone: "warn" },
  sent: { label: "Enviada", tone: "ok" },
  cancelled: { label: "Cancelada", tone: "danger" },
};

/** Costo aproximado por mensaje (lo cobra Meta). null = sin estimación. */
export const COST_PER_MESSAGE: Partial<Record<TemplateCategory, number>> = {
  MARKETING: 0.3,
  UTILITY: 0.05,
};

export function estimateCost(category: TemplateCategory | undefined, count: number): number | null {
  if (!category) return null;
  const unit = COST_PER_MESSAGE[category];
  return unit === undefined ? null : Math.round(unit * count * 100) / 100;
}

export const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidad",
  AUTHENTICATION: "Autenticación",
  SERVICE: "Servicio",
};

export function audienceLabel(a: Audience, stageName?: string | null): string {
  if (a.type === "all") return "Todos los contactos";
  if (a.type === "stage") return `Etapa «${stageName ?? "…"}»`;
  return `Sin escribir hace ${a.inactiveDays ?? "?"} días`;
}

export function broadcastProgress(b: Pick<Broadcast, "total" | "sentCount" | "failedCount">): number {
  if (!b.total) return 0;
  return Math.min(100, Math.round(((b.sentCount + b.failedCount) / b.total) * 100));
}

export type BroadcastAction = "edit" | "send" | "delete" | "pause" | "resume" | "cancel";

export function broadcastActions(status: BroadcastStatus): BroadcastAction[] {
  switch (status) {
    case "draft":
      return ["edit", "send", "delete"];
    case "scheduled":
    case "sending":
      return ["pause", "cancel"];
    case "paused":
      return ["resume", "cancel"];
    case "cancelled":
      return ["delete"];
    default:
      return [];
  }
}
