"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { getKpisFacturacion } from "@/services/superadmin/facturacionService";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function FacturacionKpis() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "facturacion", "kpis"], queryFn: getKpisFacturacion });

  if (isLoading || !data) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={Receipt} color="teal" label="Facturado del mes" value={money(data.facturadoMes)} />
      <KpiCard icon={CheckCircle2} color="green" label="Cobrado" value={money(data.cobrado)} />
      <KpiCard icon={Clock} color="amber" label="Pendiente" value={money(data.pendiente)} />
      <KpiCard icon={AlertTriangle} color="red" label="Vencido" value={money(data.vencido)} />
    </KpiRow>
  );
}
