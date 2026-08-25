"use client";

import { useMrrWaterfall } from "@/hooks/superadmin/useFinanzas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Waterfall } from "@/components/superadmin/shared/charts/Waterfall";
import { SimuladoBadge } from "@/components/superadmin/shared";

export function MrrWaterfallCard() {
  const { data, isSimulado } = useMrrWaterfall();

  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          MRR de cierre — Waterfall
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>{data && <Waterfall data={data.data} />}</CardContent>
    </Card>
  );
}
