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
  /** Tienda elegida; sin valor = todas. */
  storeId?: string;
}

const money = (v: number) =>
  `S/ ${v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Tarjetas KPI sobre la Bandeja. Cada indicador filtra la lista; otro clic lo quita. */
export default function InboxIndicators({ active, onChange, storeId }: Props) {
  const q = useInboxSummary(storeId);
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
    { key: "thinking", label: "Lo están pensando", count: n(d.thinking), tone: "text-amber-700 dark:text-amber-400" },
  ];
  const allZero = items.every((i) => i.count === 0);
  // Cobros de los POWIP Link del chat; solo se muestran si el servidor los envía.
  const hasSales = typeof d.pendingLinks === "number" || typeof d.collectedToday === "number";
  const sales = hasSales ? (
    <div role="group" aria-label="Cobros del chat" className="grid grid-cols-2 gap-2">
      <KpiCard
        label="Links por cobrar"
        value={n(d.pendingLinks)}
        tone={n(d.pendingLinks) > 0 ? "text-primary" : "text-muted-foreground"}
        detail={n(d.pendingLinksAmount) > 0 ? money(n(d.pendingLinksAmount)) : "POWIP Link"}
      />
      <KpiCard
        label="Cobrado hoy"
        value={money(n(d.collectedToday))}
        tone={n(d.collectedToday) > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}
        detail="POWIP Link"
      />
    </div>
  ) : null;

  if (allZero && !active) {
    return (
      <div className={cn("grid gap-2", sales && "lg:grid-cols-[5fr_2fr] lg:items-stretch")}>
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Todo al día
        </p>
        {sales}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2", sales && "lg:grid-cols-[5fr_2fr]")}>
      <div role="group" aria-label="Indicadores de la bandeja" className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            aria-pressed={active === i.key}
            title={active === i.key ? "Quitar filtro" : "Filtrar la lista"}
            onClick={() => onChange(active === i.key ? null : i.key)}
            className={cn(
              "flex min-w-0 flex-col gap-0.5 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50",
              active === i.key && "border-primary bg-accent",
            )}
          >
            <KpiBody label={i.label} value={i.count} tone={i.count > 0 ? i.tone : "text-muted-foreground"} detail={i.hint} />
          </button>
        ))}
      </div>
      {sales}
    </div>
  );
}

/** Contenido de una tarjeta KPI (mockup 152): etiqueta, número grande de color y detalle. */
function KpiBody({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: number | string;
  tone: string;
  detail?: string;
}) {
  return (
    <>
      <span className="block break-words sm:truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("block break-words sm:truncate text-[26px] font-bold leading-tight", tone)}>{value}</span>
      {detail && <span className="block break-words sm:truncate text-xs text-muted-foreground">{detail}</span>}
    </>
  );
}

function KpiCard(props: { label: string; value: number | string; tone: string; detail?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-card px-4 py-3">
      <KpiBody {...props} />
    </div>
  );
}
