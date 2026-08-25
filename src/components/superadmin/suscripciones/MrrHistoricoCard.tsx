"use client";

import { useMrrHistoricoSuscripciones } from "@/hooks/superadmin/useSuscripciones";
import StatsChart from "@/components/superadmin/StatsChart";
import { Card, CardContent } from "@/components/ui/card";
import { SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { cn } from "@/lib/utils";

export function MrrHistoricoCard() {
  const { data, isSimulado } = useMrrHistoricoSuscripciones();

  return (
    <Card className={cn("shadow-sm h-full", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardContent className="pt-5">
        {isSimulado && (
          <div className="mb-1 flex justify-end">
            <SimuladoBadge />
          </div>
        )}
        <StatsChart
          title="MRR histórico — últimos meses"
          data={data}
          xKey="mes"
          lines={[{ key: "mrr", name: "MRR (S/)", color: "#027778" }]}
        />
      </CardContent>
    </Card>
  );
}
