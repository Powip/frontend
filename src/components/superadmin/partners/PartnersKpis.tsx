"use client";

import { useQuery } from "@tanstack/react-query";
import { Users2, Wallet, HandCoins, Percent } from "lucide-react";
import { getKpisPartners } from "@/services/superadmin/partnersService";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function PartnersKpis() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "partners", "kpis"], queryFn: getKpisPartners });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={Users2} color="violet" label="Partners activos" value={data.partnersActivos} sub={`${data.partnersTotal} en total`} />
      <KpiCard icon={Wallet} color="green" label="MRR referido" value={money(data.mrrReferido)} />
      <KpiCard icon={HandCoins} color="amber" label="Comisiones del mes" value={money(data.comisionesMes)} />
      <KpiCard icon={Percent} color="teal" label="Conversión de referidos" value={`${data.conversionPct}%`} sub={`${data.referidosActivos}/${data.referidosTotal} activos`} />
    </div>
  );
}
