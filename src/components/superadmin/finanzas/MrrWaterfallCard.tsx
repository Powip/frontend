"use client";

import { useQuery } from "@tanstack/react-query";
import { getMrrWaterfall } from "@/services/superadmin/finanzasService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Waterfall } from "@/components/superadmin/shared/charts/Waterfall";

export function MrrWaterfallCard() {
  const { data } = useQuery({ queryKey: ["superadmin", "finanzas", "mrr-waterfall"], queryFn: getMrrWaterfall });

  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">MRR de cierre — Waterfall</CardTitle>
      </CardHeader>
      <CardContent>{data && <Waterfall data={data} />}</CardContent>
    </Card>
  );
}
