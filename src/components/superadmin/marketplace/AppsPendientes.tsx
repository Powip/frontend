"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { getAppsPendientes, aprobarApp, rechazarApp } from "@/services/superadmin/marketplaceService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, SectionHeader } from "@/components/superadmin/shared";

export function AppsPendientes() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["superadmin", "marketplace", "pendientes"],
    queryFn: getAppsPendientes,
  });

  const { mutate: aprobar } = useMutation({
    mutationFn: aprobarApp,
    onSuccess: (app) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "marketplace"] });
      if (app) toast.success(`${app.nombre} fue aprobada y publicada.`);
    },
  });

  const { mutate: rechazar } = useMutation({
    mutationFn: rechazarApp,
    onSuccess: (app) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "marketplace"] });
      if (app) toast.error(`${app.nombre} fue rechazada.`);
    },
  });

  if (!data?.length) return null;

  return (
    <div className="mb-6">
      <SectionHeader title="Pendientes de aprobación" sub={`${data.length} app(s) esperando revisión`} />
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
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => rechazar(app.id)}>
                  <X className="h-3.5 w-3.5" />
                  Rechazar
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => aprobar(app.id)}>
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
