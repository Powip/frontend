"use client";

import { useCanalesRed } from "@/hooks/superadmin/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { EmptyBlock } from "@/components/superadmin/shared";
import { Radio } from "lucide-react";

export function CanalesRedCard() {
  const { canales, oportunidad, isLoading } = useCanalesRed();
  const max = Math.max(...canales.map((c) => c.count), 1);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">Canales de venta de la red</CardTitle>
      </CardHeader>
      <CardContent>
        {!isLoading && !canales.length && (
          <EmptyBlock icon={Radio} title="Sin canales declarados" description="Ninguna empresa tiene canales de venta cargados todavía." />
        )}
        {!!canales.length && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-2.5">
              {canales.map((c) => (
                <div key={c.canal} className="flex items-center gap-3 text-[11.5px]">
                  <span className="w-28 shrink-0 font-medium text-muted-foreground">{c.canal}</span>
                  <span className="h-[9px] flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(c.count / max) * 100}%` }} />
                  </span>
                  <span className="w-16 text-right font-bold">
                    {c.count} <span className="font-normal text-muted-foreground">({c.pct}%)</span>
                  </span>
                </div>
              ))}
            </div>
            {oportunidad && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-primary">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Oportunidad de producto
                </div>
                <div className="text-xs font-semibold">{oportunidad.titulo}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{oportunidad.motivo}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
