"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt, TrendingUp, Repeat, LineChart } from "lucide-react";
import { getResumenMes } from "@/services/superadmin/finanzasService";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function FinanzasKpis() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "finanzas", "resumen-mes"], queryFn: getResumenMes });

  if (isLoading || !data) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={Receipt} color="teal" label="Facturado este mes" value={money(data.facturadoMes)} />
      <KpiCard icon={TrendingUp} color="green" label="Proyección de cierre" value={money(data.proyeccionCierre)} />
      <KpiCard icon={Repeat} color="blue" label="MRR actual" value={money(data.mrrActual)} />
      <KpiCard icon={LineChart} color="violet" label="MRR proyectado" value={money(data.mrrProyectado)} />
    </KpiRow>
  );
}
