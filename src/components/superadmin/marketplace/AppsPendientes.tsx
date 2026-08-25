"use client";

import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useAppsPendientes, useAprobarApp, useRechazarApp } from "@/hooks/superadmin/useMarketplace";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, SectionHeader, SimuladoBadge } from "@/components/superadmin/shared";

export function AppsPendientes() {
  const { data, isSimulado } = useAppsPendientes();

  const { mutate: aprobar } = useAprobarApp();
  const { mutate: rechazar } = useRechazarApp();

  function handleAprobar(id: string) {
    aprobar(id, {
      onSuccess: (app) => {
        if (app) toast.success(`${app.nombre} fue aprobada y publicada.`);
      },
    });
  }

  function handleRechazar(id: string) {
    rechazar(id, {
      onSuccess: (app) => {
        if (app) toast.error(`${app.nombre} fue rechazada.`);
      },
    });
  }

  if (!data?.length) return null;

  return (
    <div className="mb-6">
      <SectionHeader
        title="Pendientes de aprobación"
        sub={`${data.length} app(s) esperando revisión`}
        actions={isSimulado ? <SimuladoBadge /> : undefined}
      />
      <div className="space-y-2">
        {data.map((app) => (
          <Card key={app.id} className="shadow-sm">
            <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-lg">{app.icono}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold">{app.nombre}</div>
                <div className="truncate text-[10.5px] text-muted-foreground">{app.descripcion}</div>
              </div>
              <StatusBadge label={app.categoria} tone="blue" />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleRechazar(app.id)}>
                  <X className="h-3.5 w-3.5" />
                  Rechazar
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => handleAprobar(app.id)}>
                  <Check className="h-3.5 w-3.5" />
                  Aprobar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
