"use client";

import { useSaludIntegraciones } from "@/hooks/superadmin/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";

export function SaludPlataformaCard() {
  const { data, isSimulado } = useSaludIntegraciones();
  const activas = data.integraciones.filter((i) => i.estado === "operativo").length;
  const total = data.integraciones.length;

  return (
    <Card className={cn("shadow-sm h-full", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Salud de la plataforma
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          {data.integraciones.map((i) => (
            <li key={i.id} className="flex items-center gap-2.5 border-b border-border/60 py-2 last:border-0">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-sm">{i.icono}</span>
              <span className="text-xs font-medium">{i.nombre}</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground">{i.uptimePct}%</span>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    i.estado === "operativo" ? "bg-emerald-500" : i.estado === "error" ? "bg-red-500" : "bg-muted-foreground"
                  )}
                />
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <InfraMetric label="Integraciones activas" value={`${activas}/${total}`} />
          <InfraMetric label="Uptime promedio" value={`${data.uptimePromedio}%`} />
        </div>
      </CardContent>
    </Card>
  );
}

function InfraMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
      <div className="text-sm font-extrabold">{value}</div>
      <div className="text-[9.5px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
