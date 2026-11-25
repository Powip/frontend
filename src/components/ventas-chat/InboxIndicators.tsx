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
  // Las 4 tarjetas del mockup 152; las dos primeras filtran la lista.
  const cards: Array<{ key: InboxIndicator; label: string; count: number; hint: string; tone: string }> = [
    {
      key: "unanswered",
      label: "Sin responder",
      count: n(d.unanswered),
      hint: n(d.mineUnanswered) > 0 ? `${n(d.mineUnanswered)} tuyas` : "Clientes esperando a una vendedora",
      tone: "text-red-600 dark:text-red-400",
    },
    {
      key: "overSla",
      label: "Fuera de tiempo",
      count: n(d.overSla),
      hint: sla > 0 ? `Esperan más de ${sla} min` : "Esperan más de lo acordado",
      tone: "text-orange-600 dark:text-orange-400",
    },
  ];
  // Filtros que el mockup deja en la lista y no en tarjetas.
  const chips: Array<{ key: InboxIndicator; label: string; count: number }> = [
    { key: "unassigned", label: "Sin asignar", count: n(d.unassigned) },
    { key: "pauHelp", label: "Pau pidió ayuda", count: n(d.pauHelp) },
    { key: "thinking", label: "Lo están pensando", count: n(d.thinking) },
  ];
  const links = n(d.pendingLinks);
  const linksAmount = n(d.pendingLinksAmount);
  const collected = n(d.collectedToday);

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Indicadores de la bandeja" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {cards.map((i) => (
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
        <KpiCard
          label="Links por pagar"
          value={links}
          tone={links > 0 ? "text-teal-700 dark:text-teal-400" : "text-muted-foreground"}
          detail={`${money(linksAmount)} en carritos abiertos`}
        />
        <KpiCard
          label="Cobrado hoy por chat"
          value={money(collected)}
          tone={collected > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}
          detail="Pedidos pagados por link"
        />
      </div>
      <div role="group" aria-label="Más filtros" className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={active === c.key}
            onClick={() => onChange(active === c.key ? null : c.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-accent/50",
              active === c.key && "border-primary bg-accent text-foreground",
            )}
          >
            <b className={cn(c.count > 0 && "text-amber-700 dark:text-amber-400")}>{c.count}</b> {c.label}
          </button>
        ))}
        {cards.every((c) => c.count === 0) && chips.every((c) => c.count === 0) && (
          <span role="status" className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Todo al día
          </span>
        )}
      </div>
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
