"use client";

import { useSegmentacionRed } from "@/hooks/superadmin/useOportunidades";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { moneyCompact } from "@/components/superadmin/shared/format";
import { PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

export function SegmentacionRedCard() {
  const { data, isSimulado } = useSegmentacionRed();
  const max = Math.max(...data.map((s) => s.count), 1);

  return (
    <Card className={cn("shadow-sm h-full", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Segmentación de la red (rubro)
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data.length && <EmptyBlock icon={PieChart} title="Sin datos de segmentación" description="No hay empresas para segmentar por rubro." />}
        {!!data.length && (
          <div className="space-y-2.5">
            {data
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((s) => (
                <div key={s.rubro} className="flex items-center gap-3 text-[11.5px]">
                  <span className="w-28 shrink-0 truncate font-medium text-muted-foreground">{s.rubro}</span>
                  <span className="h-[9px] flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(s.count / max) * 100}%` }} />
                  </span>
                  <span className="w-14 shrink-0 text-right font-bold">{s.count}</span>
                  <span className="w-20 shrink-0 text-right text-muted-foreground">{moneyCompact(s.mrr)}</span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
