"use client";

import { useComposicionClientes } from "@/hooks/superadmin/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Donut } from "@/components/superadmin/shared/charts/Donut";
import { SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { cn } from "@/lib/utils";

export function ComposicionClientesCard() {
  const { data, isSimulado } = useComposicionClientes();
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className={cn("shadow-sm h-full", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Composición de clientes
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Donut centerLabel={String(total)} data={data.map((d) => ({ label: d.segmento, value: d.count, pct: d.pct, color: d.color }))} />
      </CardContent>
    </Card>
  );
}
