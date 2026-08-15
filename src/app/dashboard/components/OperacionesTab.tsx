"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard } from "./shared";
import { mockEstadoPedidos, mockOperacionesKpis, mockVelocidadEtapas } from "./mock-data";

const ACCENT_BORDER: Record<string, string> = {
  amber: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-500/5",
  emerald: "border-l-emerald-500",
  red: "border-l-red-500",
};

const ACCENT_TEXT: Record<string, string> = {
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  red: "text-red-600 dark:text-red-400",
};

const estadoTotal = mockEstadoPedidos.reduce((acc, e) => acc + e.value, 0);

export function OperacionesTab() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="grid grid-cols-4 gap-3.5">
        {mockOperacionesKpis.map((kpi) => (
          <div
            key={kpi.label}
            className={cn("rounded-xl border border-border border-l-4 bg-card p-4", ACCENT_BORDER[kpi.accent])}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{kpi.label}</p>
            <p className={cn("text-3xl font-extrabold tracking-tight", ACCENT_TEXT[kpi.accent])}>{kpi.value}</p>
            <p className="text-[11px] font-medium text-muted-foreground mt-1.5">{kpi.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <SectionCard
          title="Estado actual de todos los pedidos"
          right={
            <span className="rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 text-[10px] font-bold px-2 py-1">
              {estadoTotal} total
            </span>
          }
        >
          <div className="flex flex-col gap-2.5">
            {mockEstadoPedidos.map((e) => (
              <div key={e.label} className="flex items-center gap-2.5">
                <div className={cn("min-w-[90px] text-xs", e.bold ? "font-bold" : "text-muted-foreground", e.bold && e.className)}>
                  {e.label}
                </div>
                <div className="flex-1 h-3.5 rounded bg-muted overflow-hidden">
                  <div className={cn("h-full rounded", e.color)} style={{ width: `${e.pct}%` }} />
                </div>
                <div className={cn("min-w-[70px] text-right text-xs font-bold", e.className)}>
                  {e.value} · {e.pct}%
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-violet-50 dark:bg-violet-500/10 px-3 py-2 mt-3.5">
            <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-400">Total verificado</span>
            <span className="text-xs font-extrabold text-violet-700 dark:text-violet-400">
              {mockEstadoPedidos.map((e) => e.value).join("+")} = {estadoTotal} ✓
            </span>
          </div>
        </SectionCard>

        <SectionCard title="Velocidad por etapa (días prom.)">
          <div className="flex flex-col">
            {mockVelocidadEtapas.map((etapa) => (
              <div key={etapa.label} className="flex items-center justify-between py-3 border-b border-border/60 last:border-0">
                <span className="text-xs text-muted-foreground">{etapa.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-base font-extrabold", etapa.className)}>{etapa.value}</span>
                  {etapa.warn && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                  {etapa.ok && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-3 mt-2.5">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                Ciclo total (ingreso → entrega)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">5.8d</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
          </div>

          <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-amber-300/70 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Speed to Call fuera de meta</p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                45 min promedio vs. meta de &lt;30 min. Afecta la efectividad COD. Revisar flujo de asignación de leads.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
