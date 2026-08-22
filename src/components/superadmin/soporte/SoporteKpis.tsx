"use client";

import { useQuery } from "@tanstack/react-query";
import { Inbox, Flame, Timer, Smile } from "lucide-react";
import { getKpisSoporte } from "@/services/superadmin/soporteService";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";

export function SoporteKpis() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "soporte", "kpis"], queryFn: getKpisSoporte });

  if (isLoading || !data) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={Inbox} color="blue" label="Abiertos" value={data.abiertos} />
      <KpiCard icon={Flame} color="red" label="Críticos" value={data.criticos} sub="Prioridad alta" />
      <KpiCard icon={Timer} color="amber" label="Tiempo de respuesta" value={data.tiempoRespuestaProm} sub="Promedio" />
      <KpiCard icon={Smile} color="green" label="CSAT" value={data.csat} sub="Satisfacción" />
    </KpiRow>
  );
}
