"use client";

import { Inbox, Flame, Timer, Smile } from "lucide-react";
import { useKpisSoporte } from "@/hooks/superadmin/useSoporte";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";

export function SoporteKpis() {
  const { data, isLoading, isSimulado } = useKpisSoporte();

  if (isLoading || !data) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={Inbox} color="blue" label="Abiertos" value={data.abiertos} simulado={isSimulado} />
      <KpiCard icon={Flame} color="red" label="Críticos" value={data.criticos} sub="Prioridad alta" simulado={isSimulado} />
      <KpiCard icon={Timer} color="amber" label="Tiempo de respuesta" value={`${data.tiempoRespuestaPromedioMin} min`} sub="Promedio" simulado={isSimulado} />
      <KpiCard icon={Smile} color="green" label="CSAT" value={`${data.csat}/5`} sub="Satisfacción" simulado={isSimulado} />
    </KpiRow>
  );
}
