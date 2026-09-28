"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { GlosarioId } from "@/features/panel-control/shared/config/glosario.config";
import type { Delta } from "@/features/panel-control/shared/models/comparison.model";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import type { EvaluacionMeta } from "@/features/panel-control/shared/models/goal.model";
import { cn } from "@/lib/utils";
import { DataOriginBadge } from "./DataOriginBadge";
import { DeltaBadge } from "./DeltaBadge";
import { GoalIndicator } from "./GoalIndicator";
import { InfoTip } from "./InfoTip";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  glosario?: GlosarioId;
  delta?: Delta;
  meta?: EvaluacionMeta;
  metaDemo?: boolean;
  origin?: DataOrigin;
  onDrill?: () => void;
  drillLabel?: string;
  loading?: boolean;
  destacado?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  sub,
  glosario,
  delta,
  meta,
  metaDemo,
  origin,
  onDrill,
  drillLabel = "Ver pedidos",
  loading = false,
  destacado = false,
  className,
}: KpiCardProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "relative flex min-w-0 flex-col rounded-2xl border border-pc-border bg-pc-card p-4 shadow-[0_1px_2px_rgba(16,32,42,0.04)] transition-colors",
        onDrill && "hover:border-pc-primary",
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <h3 className="flex min-w-[5.5rem] flex-1 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-pc-text-muted">
          <span className="break-words">{label}</span>
          {glosario && <InfoTip termino={glosario} />}
        </h3>
        {origin && <DataOriginBadge origin={origin} />}
        {delta && <DeltaBadge delta={delta} />}
      </div>
      {loading ? (
        <div
          className="mt-2 space-y-2"
          role="status"
          aria-busy="true"
          aria-label={`Cargando ${label}`}
        >
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      ) : (
        <>
          <p
            className={cn(
              "mt-1.5 truncate font-bold tabular-nums tracking-tight text-pc-text",
              destacado ? "text-3xl" : "text-2xl",
            )}
          >
            {value}
          </p>
          {sub && <div className="mt-0.5 text-xs leading-relaxed text-pc-text-muted">{sub}</div>}
          {meta && (
            <div className="mt-1">
              <GoalIndicator evaluacion={meta} demo={metaDemo} />
            </div>
          )}
        </>
      )}
      {onDrill && !loading && (
        <button
          type="button"
          onClick={onDrill}
          className="mt-2 self-start rounded text-xs font-semibold text-pc-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-pc-primary"
        >
          {drillLabel} →
        </button>
      )}
    </section>
  );
}
