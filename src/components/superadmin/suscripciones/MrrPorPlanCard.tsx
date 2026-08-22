"use client";

import { useQuery } from "@tanstack/react-query";
import { getMrrPorPlan } from "@/services/superadmin/suscripcionesService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Donut } from "@/components/superadmin/shared/charts/Donut";
import { moneyCompact } from "@/components/superadmin/shared/format";

const COLORS: Record<string, string> = {
  Basic: "#94A3B8",
  Pro: "#3B82F6",
  Scale: "#027778",
  Enterprise: "#7C3AED",
  Trial: "#F59E0B",
};

export function MrrPorPlanCard() {
  const { data } = useQuery({ queryKey: ["superadmin", "suscripciones", "mrr-por-plan"], queryFn: getMrrPorPlan });

  const total = data?.reduce((sum, d) => sum + d.mrr, 0) ?? 0;

  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">MRR por plan</CardTitle>
      </CardHeader>
      <CardContent>
        {data && (
          <Donut
            centerLabel={moneyCompact(total)}
            data={data.map((d) => ({ label: d.plan, value: d.mrr, pct: d.pct, color: COLORS[d.plan] ?? "#94A3B8" }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
