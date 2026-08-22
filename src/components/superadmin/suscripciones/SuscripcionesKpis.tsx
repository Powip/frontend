"use client";

import { useQuery } from "@tanstack/react-query";
import { Repeat, CheckCircle2, Sparkles, TrendingDown, Percent, Landmark } from "lucide-react";
import { getKpisSuscripciones } from "@/services/superadmin/suscripcionesService";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function SuscripcionesKpis() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "suscripciones", "kpis"], queryFn: getKpisSuscripciones });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <KpiCard icon={Repeat} color="teal" label="MRR total" value={money(data.mrrTotal)} />
      <KpiCard icon={CheckCircle2} color="green" label="Activas" value={data.activas} />
      <KpiCard icon={Sparkles} color="blue" label="Nuevas (30d)" value={data.nuevas30d} />
      <KpiCard icon={TrendingDown} color="red" label="Canceladas" value={data.canceladas} />
      <KpiCard icon={Percent} color="amber" label="Tasa de churn" value={`${data.tasaChurnPct}%`} />
      <KpiCard icon={Landmark} color="violet" label="ARR" value={money(data.arr)} />
    </div>
  );
}
