"use client";

import { AlertOctagon, CalendarClock, CalendarCheck, CheckCircle2 } from "lucide-react";
import { useKpisSeguimiento } from "@/hooks/superadmin/useSeguimiento";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function SeguimientoKpis() {
  const { data, isLoading, completadosHoySimulado } = useKpisSeguimiento();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={AlertOctagon} color="red" label="Vencidos" value={data.vencidos} />
      <KpiCard icon={CalendarClock} color="amber" label="Hoy" value={data.hoy} />
      <KpiCard icon={CalendarCheck} color="blue" label="Próximos" value={data.proximos} />
      <KpiCard icon={CheckCircle2} color="green" label="Completados hoy" value={data.completadosHoy} simulado={completadosHoySimulado} />
    </div>
  );
}
