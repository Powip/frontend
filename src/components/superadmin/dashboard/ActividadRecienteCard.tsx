"use client";

import { useActividadReciente } from "@/hooks/superadmin/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initials, relativeTime } from "@/components/superadmin/shared/format";
import { SimuladoBadge, SIMULADO_CARD_CLASS, EmptyBlock } from "@/components/superadmin/shared";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

export function ActividadRecienteCard() {
  const { data, isLoading, isSimulado } = useActividadReciente(10);
  const eventos = data.data;

  return (
    <Card className={cn("shadow-sm h-full", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Actividad en tiempo real
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-8 animate-pulse rounded-md bg-muted/50" />)}</div>}
        {!isLoading && !eventos.length && <EmptyBlock icon={Activity} title="Sin actividad" description="No hay eventos recientes." />}
        {!isLoading && !!eventos.length && (
          <ul>
            {eventos.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 border-b border-border/60 py-2.5 last:border-0 last:pb-0">
                <span className="w-14 shrink-0 text-[10px] text-muted-foreground">{relativeTime(a.ts)}</span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${a.actorColor}`}>
                  {initials(a.actorNombre)}
                </span>
                <span className="text-xs">
                  <b className="font-semibold">{a.actorNombre}</b> <span className="text-muted-foreground">{a.accion}</span>{" "}
                  <b className="font-semibold">{a.referencia}</b>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
