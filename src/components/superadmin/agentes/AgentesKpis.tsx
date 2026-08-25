"use client";

import { Bot, Zap, MessageSquare, Target } from "lucide-react";
import { useKpisAgentesIa } from "@/hooks/superadmin/useAgentesIa";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function AgentesKpis() {
  const { data, isLoading, isSimulado } = useKpisAgentesIa();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={Bot} color="teal" label="Total agentes" value={data.total} simulado={isSimulado} />
      <KpiCard icon={Zap} color="green" label="Activos" value={data.activos} simulado={isSimulado} />
      <KpiCard
        icon={MessageSquare}
        color="blue"
        label="Interacciones del mes"
        value={data.interaccionesTotales.toLocaleString("es-PE")}
        simulado={isSimulado}
      />
      <KpiCard icon={Target} color="violet" label="Cierres asistidos" value={data.cierresAsistidos} simulado={isSimulado} />
    </div>
  );
}
