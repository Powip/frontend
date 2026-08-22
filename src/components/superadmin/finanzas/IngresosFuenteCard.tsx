"use client";

import { useQuery } from "@tanstack/react-query";
import { getIngresosFuente } from "@/services/superadmin/finanzasService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Donut } from "@/components/superadmin/shared/charts/Donut";
import { moneyCompact } from "@/components/superadmin/shared/format";

const COLORS: Record<string, string> = {
  Suscripciones: "#027778",
  "POWIP Payment": "#3B82F6",
  "Add-ons": "#F59E0B",
};

export function IngresosFuenteCard() {
  const { data } = useQuery({ queryKey: ["superadmin", "finanzas", "ingresos-fuente"], queryFn: getIngresosFuente });

  const total = data?.reduce((sum, d) => sum + d.monto, 0) ?? 0;

  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">Ingresos por fuente</CardTitle>
      </CardHeader>
      <CardContent>
        {data && (
          <Donut
            centerLabel={moneyCompact(total)}
            data={data.map((d) => ({ label: d.fuente, value: d.monto, pct: d.pct, color: COLORS[d.fuente] ?? "#94A3B8" }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
