"use client";

import { Truck, Wallet, FileText, ShieldAlert } from "lucide-react";
import { useKpisOperacion } from "@/hooks/superadmin/useOperacion";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";
import { moneyCompact } from "@/components/superadmin/shared/format";

export function OperacionKpis() {
  const { data, isLoading, isSimulado } = useKpisOperacion();

  if (isLoading) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={Truck} color="violet" label="COD en tránsito" value={moneyCompact(data.codTransito)} simulado={isSimulado} />
      <KpiCard icon={Wallet} color="blue" label="Liquidaciones pendientes" value={moneyCompact(data.liquidacionPendiente)} simulado={isSimulado} />
      <KpiCard icon={FileText} color="teal" label="Emiten SUNAT" value={`${data.emiten}/${data.totalSunat}`} simulado={isSimulado} />
      <KpiCard icon={ShieldAlert} color="red" label="Alertas de fraude" value={data.alertasFraude} simulado={isSimulado} />
    </KpiRow>
  );
}
