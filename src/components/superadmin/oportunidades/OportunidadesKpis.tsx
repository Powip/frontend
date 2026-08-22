"use client";

import { TrendingUp, ShoppingBag, Truck, AlertTriangle } from "lucide-react";
import { useKpisOportunidades } from "@/hooks/superadmin/useOportunidades";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";
import { moneyCompact } from "@/components/superadmin/shared/format";

export function OportunidadesKpis() {
  const { data, isLoading, simuladoFields } = useKpisOportunidades();

  if (isLoading) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={TrendingUp} color="teal" label="MRR en oportunidades" value={moneyCompact(data.mrrOportunidades)} simulado={simuladoFields.includes("mrrOportunidades")} />
      <KpiCard icon={ShoppingBag} color="blue" label="GMV de la red" value={moneyCompact(data.gmvRed)} />
      <KpiCard icon={Truck} color="violet" label="Adelantos COD en tránsito" value={moneyCompact(data.codTransito)} simulado={simuladoFields.includes("codTransito")} />
      <KpiCard icon={AlertTriangle} color="amber" label="Empresas en riesgo" value={data.empresasRiesgo} simulado={simuladoFields.includes("empresasRiesgo")} />
    </KpiRow>
  );
}
