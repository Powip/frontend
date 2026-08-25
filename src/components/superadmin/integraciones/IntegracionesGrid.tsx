"use client";

import { toast } from "sonner";
import { RefreshCw, Plug } from "lucide-react";
import { useSaludIntegraciones, useToggleIntegracion, useReconectarIntegracion } from "@/hooks/superadmin/useIntegraciones";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { StatusBadge, BadgeTone, TableSkeleton, EmptyBlock, SimuladoBadge } from "@/components/superadmin/shared";

const ESTADO_TONE: Record<string, BadgeTone> = {
  operativo: "green",
  error: "red",
  desconectado: "gray",
};

export function IntegracionesGrid() {
  const { data, isLoading, isSimulado } = useSaludIntegraciones();
  const { mutate: toggle } = useToggleIntegracion();
  const { mutate: reconectar } = useReconectarIntegracion();

  const integraciones = data.integraciones;

  if (isLoading) return <TableSkeleton rows={4} cols={4} />;
  if (!integraciones.length) {
    return <EmptyBlock icon={Plug} title="Sin integraciones" description="No hay integraciones configuradas." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {integraciones.map((i) => (
        <Card key={i.id} className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-lg">{i.icono}</span>
                <div>
                  <div className="text-xs font-bold">
                    {i.nombre}
                    {isSimulado && <SimuladoBadge />}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">{i.categoria}</div>
                </div>
              </div>
              <Switch
                checked={i.activa}
                onCheckedChange={() =>
                  toggle(i.id, {
                    onSuccess: (integracion) => {
                      if (integracion) toast.success(`${integracion.nombre} ${integracion.activa ? "activada" : "desactivada"}.`);
                    },
                  })
                }
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <StatusBadge label={i.estado} tone={ESTADO_TONE[i.estado]} dot />
              <span className="text-[11px] font-semibold text-muted-foreground">Uptime {i.uptimePct}%</span>
            </div>
            {i.estado !== "operativo" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full gap-1.5"
                onClick={() =>
                  reconectar(i.id, {
                    onSuccess: (integracion) => {
                      if (integracion) toast.success(`${integracion.nombre} reconectada correctamente.`);
                    },
                  })
                }
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reconectar
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
