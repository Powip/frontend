"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useComisionesPorFuente } from "@/hooks/superadmin/useComisionesMp";
import { SimuladoBadge, TableSkeleton } from "@/components/superadmin/shared";
import type { FuenteComisionMp } from "@/interfaces/superadmin";

const COLORS: Record<FuenteComisionMp, string> = {
  "Cobros deuda link": "#027778",
  "Upsell pre-despacho": "#4C2FB5",
  "Catálogo / recompra": "#10B981",
};

export function ComisionesPorFuenteCard() {
  const { data, isLoading, isSimulado } = useComisionesPorFuente();

  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Comisión por fuente
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={3} cols={1} />
        ) : (
          <div className="space-y-4">
            {data.data.map((f) => (
              <div key={f.fuente}>
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                  <span>{f.fuente}</span>
                  <span className="text-muted-foreground">{f.pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${f.pct}%`, backgroundColor: COLORS[f.fuente] }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
