"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { getApps } from "@/services/superadmin/marketplaceService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, BadgeTone, TableSkeleton, EmptyBlock, SectionHeader } from "@/components/superadmin/shared";

const ESTADO_TONE: Record<string, BadgeTone> = {
  publicada: "green",
  pendiente: "amber",
  rechazada: "red",
};

export function AppsCatalogo() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "marketplace", "list"], queryFn: getApps });
  const [instaladas, setInstaladas] = useState<Set<string>>(new Set());

  function toggleInstalar(id: string, nombre: string) {
    setInstaladas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info(`${nombre} desinstalada (mock).`);
      } else {
        next.add(id);
        toast.success(`${nombre} instalada (mock).`);
      }
      return next;
    });
  }

  return (
    <div>
      <SectionHeader title="Catálogo de apps" sub="Apps y partners integrados a nivel plataforma." />
      {isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : !data?.length ? (
        <EmptyBlock icon={Store} title="Sin apps" description="No hay apps registradas en el marketplace." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((app) => (
            <Card key={app.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-lg">{app.icono}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold">{app.nombre}</div>
                    <div className="text-[10.5px] text-muted-foreground">{app.categoria}</div>
                  </div>
                  <StatusBadge label={app.estado} tone={ESTADO_TONE[app.estado]} className="ml-auto" />
                </div>
                <p className="mt-2.5 line-clamp-2 text-[11.5px] text-muted-foreground">{app.descripcion}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <div className="text-sm font-extrabold">{app.instalacionesCount}</div>
                    <div className="mt-0.5 text-[9.5px] uppercase tracking-wide text-muted-foreground">Instalaciones</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <div className="text-sm font-extrabold">{app.revenueSharePct}%</div>
                    <div className="mt-0.5 text-[9.5px] uppercase tracking-wide text-muted-foreground">Revenue share</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={instaladas.has(app.id) ? "outline" : "default"}
                  className="mt-3 w-full"
                  onClick={() => toggleInstalar(app.id, app.nombre)}
                >
                  {instaladas.has(app.id) ? "Desinstalar" : "Instalar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
