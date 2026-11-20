import type { Call, CallDays, CallDirection, CallResult } from "@/types/crmCalls";

export const CALL_RESULT_LABEL: Record<CallResult, string> = {
  sold: "Vendido",
  callback: "Volver a llamar",
  no_answer: "No contestó",
  not_interested: "No le interesa",
  other: "Otro",
};

export const CALL_RESULT_ORDER: CallResult[] = [
  "sold",
  "callback",
  "no_answer",
  "not_interested",
  "other",
];

/** Colores de la etiqueta de resultado. */
export const CALL_RESULT_TONE: Record<CallResult, string> = {
  sold: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  callback:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  no_answer:
    "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  not_interested:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300",
  other:
    "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300",
};

export const CALL_DIRECTION_LABEL: Record<CallDirection, string> = {
  out: "Hecha",
  in: "Recibida",
};

export const CALL_DAYS_OPTIONS: Array<{ value: CallDays; label: string }> = [
  { value: 1, label: "Hoy" },
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
];

export const MAX_CALL_SECONDS = 14_400;

/** «2 min 10 s», «45 s» o «—» si no se anotó. */
export function formatCallDuration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/** Minutos y segundos escritos en el formulario → segundos (undefined si ambos vacíos). */
export function toSeconds(minutes: string, seconds: string): number | undefined {
  if (!minutes.trim() && !seconds.trim()) return undefined;
  return (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
}

export function answeredPercent(calls: number, answered: number) {
  return calls > 0 ? Math.round((answered / calls) * 100) : 0;
}

export function callContact(c: Pick<Call, "contactName" | "contactPhone">) {
  return c.contactName?.trim() || c.contactPhone || "Sin contacto";
}
