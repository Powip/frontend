"use client";

import { useResumenMes } from "@/hooks/superadmin/useFinanzas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "@/components/superadmin/shared/charts/Gauge";
import { money } from "@/components/superadmin/shared/format";
import { SimuladoBadge } from "@/components/superadmin/shared";

export function MetaMesCard() {
  const { data, isSimulado } = useResumenMes();

  if (!data) return null;

  const tone = data.avancePct >= 90 ? "green" : data.avancePct >= 60 ? "amber" : "red";

  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Meta del mes vs. avance
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Gauge value={data.avancePct} max={100} label={`${money(data.facturadoMes)} de ${money(data.meta)} de meta`} tone={tone} />
      </CardContent>
    </Card>
  );
}
