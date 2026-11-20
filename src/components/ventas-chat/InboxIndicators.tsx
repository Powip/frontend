"use client";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInboxSummary } from "@/hooks/useCrmChat";
import type { ConversationListParams, InboxSummary } from "@/types/crm";

export type InboxIndicator = "unanswered" | "overSla" | "unassigned" | "pauHelp" | "thinking";

/** Filtro de la lista que activa cada indicador. */
export const INDICATOR_PARAMS: Record<
  InboxIndicator,
  Partial<Pick<ConversationListParams, "unanswered" | "overSla" | "pauHelp" | "thinking" | "assigned">>
> = {
  unanswered: { unanswered: true },
  overSla: { overSla: true },
  unassigned: { assigned: "unassigned" },
  pauHelp: { pauHelp: true },
  thinking: { thinking: true },
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

interface Props {
  active: InboxIndicator | null;
  onChange: (next: InboxIndicator | null) => void;
}

/** Franja de indicadores sobre la Bandeja. Cada uno filtra la lista; otro clic lo quita. */
export default function InboxIndicators({ active, onChange }: Props) {
  const q = useInboxSummary();
  const d: Partial<InboxSummary> | undefined = q.data;
  if (!d) return null;

  const sla = n(d.slaMinutes);
  const items: Array<{ key: InboxIndicator; label: string; count: number; hint?: string; tone: string }> = [
    {
      key: "unanswered",
      label: "Sin responder",
      count: n(d.unanswered),
      hint: n(d.mineUnanswered) > 0 ? `${n(d.mineUnanswered)} tuyas` : undefined,
      tone: "text-red-600 dark:text-red-400",
    },
    {
      key: "overSla",
      label: "Fuera de tiempo",
      count: n(d.overSla),
      hint: sla > 0 ? `más de ${sla} min` : undefined,
      tone: "text-orange-600 dark:text-orange-400",
    },
    { key: "unassigned", label: "Sin asignar", count: n(d.unassigned), tone: "text-foreground" },
    { key: "pauHelp", label: "Pau pidió ayuda", count: n(d.pauHelp), tone: "text-amber-700 dark:text-amber-400" },
    { key: "thinking", label: "Lo están pensando", count: n(d.thinking), tone: "text-sky-700 dark:text-sky-400" },
  ];
  const allZero = items.every((i) => i.count === 0);

  if (allZero && !active) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Todo al día
      </p>
    );
  }

  return (
    <div role="group" aria-label="Indicadores de la bandeja" className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          aria-pressed={active === i.key}
          title={active === i.key ? "Quitar filtro" : "Filtrar la lista"}
          onClick={() => onChange(active === i.key ? null : i.key)}
          className={cn(
            "rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/50",
            active === i.key && "border-primary bg-accent",
          )}
        >
          <span className="block truncate text-xs text-muted-foreground">{i.label}</span>
          <span className={cn("text-xl font-semibold leading-tight", i.count > 0 ? i.tone : "text-muted-foreground")}>
            {i.count}
          </span>
          {i.hint && <span className="ml-2 text-[11px] text-muted-foreground">{i.hint}</span>}
        </button>
      ))}
    </div>
  );
}
