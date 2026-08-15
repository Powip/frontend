"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiCard, KpiGrid, ProgressRow, SectionCard } from "./shared";
import {
  mockGeoDepartamentos,
  mockGeoKpis,
  mockGeoPendientes,
  mockPagosDetalle,
  mockRetencion,
} from "./mock-data";

export function GeoTab() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <KpiGrid cols={5}>
        {mockGeoKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <div className="grid grid-cols-2 gap-3.5">
        <SectionCard title="Impacto por departamento" subtitle="Facturación">
          <div className="flex flex-col gap-2.5">
            {mockGeoDepartamentos.map((geo) => (
              <ProgressRow
                key={geo.name}
                label={geo.name}
                pct={geo.pct}
                labelWidth="min-w-[100px]"
                color="bg-violet-500"
                right={<span className="text-xs font-semibold text-muted-foreground w-10 text-right">{geo.pct}%</span>}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-3.5 pt-3 border-t border-border">
            {mockGeoPendientes.map((p) => (
              <div key={p.label} className={cn("rounded-lg p-2.5 text-center", p.className)}>
                <div className="text-lg font-extrabold">{p.value}</div>
                <div className="text-[10px]">{p.label}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Preferencia de pago">
          <div className="flex flex-col">
            {mockPagosDetalle.map((p) => (
              <div key={p.name} className="flex items-center gap-2.5 py-2 border-b border-border/60 last:border-0">
                <span className={cn("h-3 w-3 rounded-full shrink-0", p.color)} />
                <span className="flex-1 text-sm font-medium text-foreground">{p.name}</span>
                <span className={cn("text-sm font-extrabold", p.textColor)}>{p.pct}</span>
              </div>
            ))}
          </div>
          <div className="mt-3.5 pt-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground mb-2">RETENCIÓN DE CLIENTES</p>
            <div className="grid grid-cols-3 gap-2.5">
              {mockRetencion.map((r) => (
                <div key={r.label} className={cn("rounded-lg p-2.5 text-center", r.className)}>
                  <div className="text-lg font-extrabold">{r.value}</div>
                  <div className="text-[10px]">{r.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-2.5 py-2 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Recompra muy baja. Meta: 35%. Oportunidad: secuencia post-entrega.
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
