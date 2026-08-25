"use client";

import { Receipt, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useKpisFacturacion } from "@/hooks/superadmin/useFacturacion";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function FacturacionKpis() {
  const { data, isLoading, isSimulado } = useKpisFacturacion();

  if (isLoading || !data) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={Receipt} color="teal" label="Facturado del mes" value={money(data.facturadoMes)} simulado={isSimulado} />
      <KpiCard icon={CheckCircle2} color="green" label="Cobrado" value={money(data.cobrado)} simulado={isSimulado} />
      <KpiCard icon={Clock} color="amber" label="Pendiente" value={money(data.pendiente)} simulado={isSimulado} />
      <KpiCard icon={AlertTriangle} color="red" label="Vencido" value={money(data.vencido)} simulado={isSimulado} />
    </KpiRow>
  );
}
