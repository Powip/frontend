"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, Zap, MessageSquare, Target } from "lucide-react";
import { getKpisAgentes } from "@/services/superadmin/agentesService";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function AgentesKpis() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "agentes", "kpis"], queryFn: getKpisAgentes });

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
      <KpiCard icon={Bot} color="teal" label="Total agentes" value={data.total} />
      <KpiCard icon={Zap} color="green" label="Activos" value={data.activos} />
      <KpiCard
        icon={MessageSquare}
        color="blue"
        label="Interacciones del mes"
        value={data.interaccionesTotales.toLocaleString("es-PE")}
      />
      <KpiCard icon={Target} color="violet" label="Cierres asistidos" value={data.cierresAsistidos} />
    </div>
  );
}
