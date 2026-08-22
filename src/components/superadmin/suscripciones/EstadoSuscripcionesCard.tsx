"use client";

import { useQuery } from "@tanstack/react-query";
import { getEstadoSuscripcionesResumen } from "@/services/superadmin/suscripcionesService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, BadgeTone } from "@/components/superadmin/shared";
import { EstadoSuscripcion } from "@/interfaces/superadmin";

const TONE: Record<EstadoSuscripcion, BadgeTone> = {
  activa: "green",
  trial: "blue",
  vencida: "red",
  cancelada: "gray",
};

const LABEL: Record<EstadoSuscripcion, string> = {
  activa: "Activas",
  trial: "En trial",
  vencida: "Vencidas",
  cancelada: "Canceladas",
};

export function EstadoSuscripcionesCard() {
  const { data } = useQuery({
    queryKey: ["superadmin", "suscripciones", "estado-resumen"],
    queryFn: getEstadoSuscripcionesResumen,
  });

  const total = data ? Object.values(data).reduce((a, b) => a + b, 0) : 0;

  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">Estado de suscripciones</CardTitle>
      </CardHeader>
      <CardContent>
        {data && (
          <ul className="space-y-2.5">
            {(Object.keys(LABEL) as EstadoSuscripcion[]).map((estado) => {
              const count = data[estado];
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <li key={estado} className="flex items-center gap-2.5">
                  <StatusBadge label={LABEL[estado]} tone={TONE[estado]} className="w-[104px] justify-center" />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-[11px] font-bold text-foreground">{count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
