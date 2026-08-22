"use client";

import { useQuery } from "@tanstack/react-query";
import { getMrrHistoricoSuscripciones } from "@/services/superadmin/suscripcionesService";
import StatsChart from "@/components/superadmin/StatsChart";
import { Card, CardContent } from "@/components/ui/card";

export function MrrHistoricoCard() {
  const { data } = useQuery({
    queryKey: ["superadmin", "suscripciones", "mrr-historico"],
    queryFn: getMrrHistoricoSuscripciones,
  });

  return (
    <Card className="shadow-sm h-full">
      <CardContent className="pt-5">
        <StatsChart
          title="MRR histórico — últimos meses"
          data={data ?? []}
          xKey="mes"
          lines={[{ key: "mrr", name: "MRR (S/)", color: "#027778" }]}
        />
      </CardContent>
    </Card>
  );
}
