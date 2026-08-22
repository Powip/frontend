"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { useBusinessOverview } from "@/hooks/superadmin/useDashboard";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SectionHeader, ExportButton } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";
import { BusinessOverviewKpis } from "./BusinessOverviewKpis";
import { MrrClientesCharts } from "./MrrClientesCharts";
import { AlertasImportantesCard } from "./AlertasImportantesCard";

export function BusinessOverviewSection() {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const { data, isLoading } = useBusinessOverview(range?.from?.toISOString(), range?.to?.toISOString());

  const exportRows = data
    ? [
        { Métrica: "MRR", Valor: money(data.mrr), Fuente: "Real" },
        { Métrica: "Clientes activos", Valor: data.clientesActivos, Fuente: "Real" },
        { Métrica: data.nuevosLabel, Valor: data.nuevosPeriodo, Fuente: "Real" },
        { Métrica: "Churn", Valor: `${data.churnPct}%`, Fuente: "Real (estimado)" },
        { Métrica: "Trials activos", Valor: data.trialsActivos, Fuente: data.isTrialsSimulado ? "Simulado" : "Real" },
        { Métrica: "Conversión trial → pago", Valor: `${data.conversionTrialPagoPct}%`, Fuente: data.isTrialsSimulado ? "Simulado" : "Real" },
        { Métrica: "Ingresos hoy", Valor: money(data.ingresosHoy), Fuente: "Real" },
        { Métrica: "Demos hoy", Valor: data.demosHoy, Fuente: data.isDemosSimulado ? "Simulado" : "Real" },
      ]
    : [];

  return (
    <div>
      <SectionHeader
        num={1}
        title="Business Overview"
        sub={range?.from ? "Filtrado por rango de fechas" : "Últimos 30 días por defecto"}
        actions={
          <>
            <DateRangePicker date={range} onDateChange={setRange} className="[&_button]:h-9 [&_button]:w-auto [&_button]:text-xs" />
            <ExportButton filename="business_overview" rows={exportRows} />
          </>
        }
      />

      <BusinessOverviewKpis data={data} isLoading={isLoading} />

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 xl:grid-cols-[2fr_1fr]">
        <MrrClientesCharts />
        <AlertasImportantesCard />
      </div>
    </div>
  );
}
