"use client";

import { DollarSign, Users, UserPlus, TrendingDown, FlaskConical, Percent, Wallet, Video } from "lucide-react";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";
import type { BusinessOverviewData } from "@/hooks/superadmin/useDashboard";

export function BusinessOverviewKpis({ data, isLoading }: { data: BusinessOverviewData | null; isLoading: boolean }) {
  if (isLoading || !data) {
    return (
      <KpiRow>
        {Array.from({ length: 8 }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </KpiRow>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={DollarSign} color="teal" label="MRR" value={money(data.mrr)} deltaPct={data.mrrDeltaPct} sub="Ingreso recurrente mensual" />
      <KpiCard
        icon={Users}
        color="blue"
        label="Clientes activos"
        value={data.clientesActivos}
        deltaPct={data.clientesActivosDeltaPct}
        sub={`de ${data.totalCompanies} negocios totales`}
      />
      <KpiCard icon={UserPlus} color="green" label={data.nuevosLabel} value={data.nuevosPeriodo} sub="Altas confirmadas" />
      <KpiCard icon={TrendingDown} color="red" label="Churn" value={`${data.churnPct}%`} sub="Estimado — cancelaciones del período" />
      <KpiCard icon={FlaskConical} color="amber" label="Trials activos" value={data.trialsActivos} sub="En periodo de prueba" simulado={data.isTrialsSimulado} />
      <KpiCard
        icon={Percent}
        color="violet"
        label="Conversión trial → pago"
        value={`${data.conversionTrialPagoPct}%`}
        sub="Últimos 90 días"
        simulado={data.isTrialsSimulado}
      />
      <KpiCard icon={Wallet} color="teal" label="Ingresos hoy" value={money(data.ingresosHoy)} sub="Cobrado en el día — no cambia con el rango" />
      <KpiCard icon={Video} color="blue" label="Demos hoy" value={data.demosHoy} sub="Agendadas para hoy" simulado={data.isDemosSimulado} />
    </div>
  );
}
