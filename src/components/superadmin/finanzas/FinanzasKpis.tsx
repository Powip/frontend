"use client";

import { Receipt, TrendingUp, Repeat, LineChart } from "lucide-react";
import { useResumenMes } from "@/hooks/superadmin/useFinanzas";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function FinanzasKpis() {
  const { data, isLoading, isSimulado } = useResumenMes();

  if (isLoading || !data) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={Receipt} color="teal" label="Facturado este mes" value={money(data.facturadoMes)} simulado={isSimulado} />
      <KpiCard icon={TrendingUp} color="green" label="Proyección de cierre" value={money(data.proyeccionCierre)} simulado={isSimulado} />
      {/* MRR actual es real (saas-metrics.mrr) — nunca simulado, ver docs/superadmin/finanzas-endpoints.md */}
      <KpiCard icon={Repeat} color="blue" label="MRR actual" value={money(data.mrrActual)} />
      <KpiCard icon={LineChart} color="violet" label="MRR proyectado" value={money(data.mrrProyectado)} simulado={isSimulado} />
    </KpiRow>
  );
}
