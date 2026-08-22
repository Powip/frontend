"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { getProximosVencimientos } from "@/services/superadmin/suscripcionesService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyBlock, StatusBadge, ESTADO_FACTURA_TONE } from "@/components/superadmin/shared";
import { formatDate, relativeDays } from "@/components/superadmin/shared/format";

export function ProximosVencimientosCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "suscripciones", "proximos-vencimientos"],
    queryFn: () => getProximosVencimientos(8),
  });

  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">Próximos vencimientos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-md bg-muted/50" />)}</div>}
        {!isLoading && !data?.length && (
          <EmptyBlock icon={CalendarClock} title="Sin vencimientos próximos" description="No hay pagos programados en el corto plazo." />
        )}
        {!isLoading && !!data?.length && (
          <ul className="space-y-2">
            {data.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{s.empresaNombre}</div>
                  <div className="truncate text-[10.5px] text-muted-foreground">
                    {s.plan} · {formatDate(s.proximoPago)}
                  </div>
                </div>
                <StatusBadge label={relativeDays(s.proximoPago)} tone={s.estado === "trial" ? "blue" : ESTADO_FACTURA_TONE.pendiente} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
