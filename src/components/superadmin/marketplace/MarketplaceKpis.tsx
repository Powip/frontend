"use client";

import { useQuery } from "@tanstack/react-query";
import { Store, CheckCircle2, Clock, Download } from "lucide-react";
import { getKpisMarketplace } from "@/services/superadmin/marketplaceService";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function MarketplaceKpis() {
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "marketplace", "kpis"],
    queryFn: getKpisMarketplace,
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
      <KpiCard icon={Store} color="teal" label="Total apps" value={data.total} />
      <KpiCard icon={CheckCircle2} color="green" label="Publicadas" value={data.publicadas} />
      <KpiCard icon={Clock} color="amber" label="Pendientes de aprobación" value={data.pendientes} />
      <KpiCard icon={Download} color="blue" label="Instalaciones totales" value={data.instalacionesTotales} />
    </div>
  );
}
