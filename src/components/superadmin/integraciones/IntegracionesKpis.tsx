"use client";

import { useQuery } from "@tanstack/react-query";
import { Plug, CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import { getKpisIntegraciones } from "@/services/superadmin/integracionesService";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function IntegracionesKpis() {
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "integraciones", "kpis"],
    queryFn: getKpisIntegraciones,
  });

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
      <KpiCard icon={Plug} color="teal" label="Total integraciones" value={data.total} />
      <KpiCard icon={CheckCircle2} color="green" label="Activas" value={data.activas} />
      <KpiCard icon={AlertTriangle} color="red" label="Con error" value={data.conError} />
      <KpiCard icon={Activity} color="blue" label="Uptime promedio" value={`${data.uptimePromedio}%`} />
    </div>
  );
}
