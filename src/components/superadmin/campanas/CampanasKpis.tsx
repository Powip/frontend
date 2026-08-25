"use client";

import { Radio, Send, MailOpen, Target } from "lucide-react";
import { useKpisCampanas } from "@/hooks/superadmin/useCampanas";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function CampanasKpis() {
  const { data, isLoading, isSimulado } = useKpisCampanas();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={Radio} color="teal" label="Activas" value={data.activas} simulado={isSimulado} />
      <KpiCard icon={Send} color="blue" label="Enviados" value={data.enviados.toLocaleString("es-PE")} simulado={isSimulado} />
      <KpiCard icon={MailOpen} color="green" label="Apertura promedio" value={`${data.aperturaProm}%`} simulado={isSimulado} />
      <KpiCard icon={Target} color="violet" label="Conversión promedio" value={`${data.conversionProm}%`} simulado={isSimulado} />
    </div>
  );
}
