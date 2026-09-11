"use client";

import { Percent, Building2, Landmark, Clock } from "lucide-react";
import { useKpisComisionesMp } from "@/hooks/superadmin/useComisionesMp";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function ComisionesMpKpis() {
  const { data, isLoading, isSimulado } = useKpisComisionesMp();

  if (isLoading || !data) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={Percent} color="violet" label="Comisión este mes" value={money(data.comisionMes)} sub="0.5% sobre pagos MP" simulado={isSimulado} />
      <KpiCard
        icon={Building2}
        color="teal"
        label="Negocios con MP activo"
        value={`${data.negociosConMp} / ${data.negociosTotal}`}
        simulado={isSimulado}
      />
      <KpiCard icon={Landmark} color="amber" label="Modo powip_temporal" value={data.negociosModoTemporal} sub="Sin cuenta MP propia" simulado={isSimulado} />
      <KpiCard icon={Clock} color="red" label="Liquidación pendiente" value={money(data.liquidacionPendienteTotal)} simulado={isSimulado} />
    </KpiRow>
  );
}
