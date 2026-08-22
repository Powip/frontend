"use client";

import { useQuery } from "@tanstack/react-query";
import { Radio, Send, MailOpen, Target } from "lucide-react";
import { getKpisCampanas } from "@/services/superadmin/campanasService";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function CampanasKpis() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "campanas", "kpis"], queryFn: getKpisCampanas });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={Radio} color="teal" label="Activas" value={data.activas} />
      <KpiCard icon={Send} color="blue" label="Enviados" value={data.enviados.toLocaleString("es-PE")} />
      <KpiCard icon={MailOpen} color="green" label="Apertura promedio" value={`${data.aperturaProm}%`} />
      <KpiCard icon={Target} color="violet" label="Conversión promedio" value={`${data.conversionProm}%`} />
    </div>
  );
}
