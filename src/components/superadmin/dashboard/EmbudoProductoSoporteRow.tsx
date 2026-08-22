"use client";

import { useEmbudoComercial, useProductoKpis, useAdopcionModulos, useSoporteResumen } from "@/hooks/superadmin/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelBars } from "@/components/superadmin/shared/charts/FunnelBars";
import { AdoptionBars } from "@/components/superadmin/shared/charts/AdoptionBars";
import { SimuladoBadge, SIMULADO_CARD_CLASS, EmptyBlock } from "@/components/superadmin/shared";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmbudoProductoSoporteRow() {
  // Real — leads del mes (Supabase) + empresas activas (ms-company). Ver /api/superadmin/conversion-funnel.
  const { data: funnel, isLoading: loadingFunnel } = useEmbudoComercial();
  const { data: producto, isSimulado: productoSimulado } = useProductoKpis();
  const { data: adopcion, isSimulado: adopcionSimulado } = useAdopcionModulos();
  const { data: soporte, isSimulado: soporteSimulado } = useSoporteResumen();

  const embudo = funnel
    ? [
        { etapa: "Leads", count: funnel.leads, pct: 100, color: "#3B82F6" },
        { etapa: "Prospectos", count: funnel.prospects, pct: funnel.leads ? Math.round((funnel.prospects / funnel.leads) * 100) : 0, color: "#8B5CF6" },
        { etapa: "Cerrados", count: funnel.closed, pct: funnel.leads ? Math.round((funnel.closed / funnel.leads) * 100) : 0, color: "#12B886" },
        { etapa: "Empresas activas", count: funnel.active, pct: funnel.leads ? Math.round((funnel.active / funnel.leads) * 100) : 0, color: "#027778" },
      ]
    : null;

  const productoSimuladoFlag = productoSimulado || adopcionSimulado;

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-bold">Embudo comercial</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFunnel && <div className="h-40 animate-pulse rounded-lg bg-muted/50" />}
          {!loadingFunnel && embudo && embudo.every((e) => e.count === 0) && (
            <EmptyBlock icon={Target} title="Sin leads este mes" description="Todavía no hay leads registrados en el período." />
          )}
          {!loadingFunnel && embudo && !embudo.every((e) => e.count === 0) && <FunnelBars data={embudo} />}
        </CardContent>
      </Card>

      <Card className={cn("shadow-sm", productoSimuladoFlag && SIMULADO_CARD_CLASS)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-bold">
            KPIs de producto
            {productoSimuladoFlag && <SimuladoBadge />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {producto.data.map((k) => (
              <div key={k.label} className="rounded-lg bg-muted/50 p-2.5 text-center">
                <div className="text-base font-extrabold">{k.value.toLocaleString()}</div>
                <div className="text-[9.5px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
              </div>
            ))}
          </div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Adopción de módulos</div>
          <AdoptionBars data={adopcion.data} />
        </CardContent>
      </Card>

      <Card className={cn("shadow-sm", soporteSimulado && SIMULADO_CARD_CLASS)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-bold">
            Soporte & Experiencia
            {soporteSimulado && <SimuladoBadge />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <SoporteRow label="Tickets abiertos" value={String(soporte.ticketsAbiertos)} />
          <SoporteRow label="Tiempo resp. promedio" value={`${soporte.tiempoRespuestaPromedioMin} min`} />
          <SoporteRow label="CSAT" value={`${soporte.csat} / 5`} />
        </CardContent>
      </Card>
    </div>
  );
}

function SoporteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-extrabold">{value}</span>
    </div>
  );
}
