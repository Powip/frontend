"use client";

import { useGrowthSeries } from "@/hooks/superadmin/useDashboard";
import StatsChart from "@/components/superadmin/StatsChart";
import { Card, CardContent } from "@/components/ui/card";
import { SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { cn } from "@/lib/utils";

export function MrrClientesCharts() {
  const { data, isSimulado } = useGrowthSeries(12);

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <Card className={cn("shadow-sm", isSimulado && SIMULADO_CARD_CLASS)}>
        <CardContent className="pt-5">
          {isSimulado && (
            <div className="mb-1 flex justify-end">
              <SimuladoBadge />
            </div>
          )}
          <StatsChart
            title="MRR — últimos 12 meses"
            data={data.mrr}
            xKey="mes"
            lines={[{ key: "valor", name: "MRR (S/)", color: "#027778" }]}
          />
        </CardContent>
      </Card>
      <Card className={cn("shadow-sm", isSimulado && SIMULADO_CARD_CLASS)}>
        <CardContent className="pt-5">
          {isSimulado && (
            <div className="mb-1 flex justify-end">
              <SimuladoBadge />
            </div>
          )}
          <StatsChart
            title="Clientes activos — últimos 12 meses"
            data={data.clientesActivos}
            xKey="mes"
            lines={[{ key: "valor", name: "Clientes", color: "#3B82F6" }]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
