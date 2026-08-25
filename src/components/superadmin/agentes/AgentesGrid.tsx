"use client";

import { toast } from "sonner";
import { Settings, Bot } from "lucide-react";
import { useAgentesIa, useToggleAgenteIa } from "@/hooks/superadmin/useAgentesIa";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { TableSkeleton, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";
import { cn } from "@/lib/utils";

export function AgentesGrid() {
  const { data, isLoading, isSimulado } = useAgentesIa();
  const { mutate: toggle } = useToggleAgenteIa();

  if (isLoading) return <TableSkeleton rows={4} cols={4} />;
  if (!data?.length) {
    return <EmptyBlock icon={Bot} title="Sin agentes" description="No hay agentes de IA configurados." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((agente) => (
        <Card key={agente.id} className={cn("shadow-sm", isSimulado && SIMULADO_CARD_CLASS)}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold">
                  {agente.nombre}
                  {isSimulado && <SimuladoBadge />}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{agente.descripcion}</p>
              </div>
              <Switch
                checked={agente.activo}
                onCheckedChange={() =>
                  toggle(agente.id, {
                    onSuccess: (actualizado) => {
                      if (actualizado) toast.success(`${actualizado.nombre} ${actualizado.activo ? "activado" : "desactivado"}.`);
                    },
                  })
                }
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <div className="text-sm font-extrabold">{agente.usoMes.toLocaleString("es-PE")}</div>
                <div className="mt-0.5 text-[9.5px] uppercase tracking-wide text-muted-foreground">Uso del mes</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <div className="text-sm font-extrabold">{money(agente.costoMes)}</div>
                <div className="mt-0.5 text-[9.5px] uppercase tracking-wide text-muted-foreground">Costo del mes</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full gap-1.5"
              onClick={() => toast.info(`Configuración de ${agente.nombre} (mock).`)}
            >
              <Settings className="h-3.5 w-3.5" />
              Configurar
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
