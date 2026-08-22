"use client";

import { toast } from "sonner";
import { Video } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useDemos, useMoverEtapa, useConvertirLead } from "@/hooks/superadmin/useAdquisicion";
import { StatusBadge, TableSkeleton, EmptyBlock, type BadgeTone } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";
import { IDemo } from "@/interfaces/superadmin";

const ESTADO_DEMO_TONE: Record<IDemo["estado"], BadgeTone> = {
  agendada: "blue",
  realizada: "violet",
  no_asistio: "gray",
  ganada: "green",
  perdida: "red",
};

export function DemosTab() {
  const { data, isLoading } = useDemos();
  const { mutate: moverEtapa } = useMoverEtapa();
  const { mutate: convertir, isPending: activando } = useConvertirLead();

  return (
    <div>
      <p className="mb-3.5 text-[11px] text-muted-foreground">
        No hay tabla de demos propia — esta lista son los leads actualmente en etapa de demo (ver docs/superadmin/adquisicion-endpoints.md).
      </p>

      {isLoading && <TableSkeleton rows={6} cols={6} />}
      {!isLoading && !data.length && <EmptyBlock icon={Video} title="Sin demos en curso" description="No hay leads en etapa de demo." />}
      {!isLoading && !!data.length && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Negocio</TableHead>
                <TableHead>Próxima acción</TableHead>
                <TableHead>SDR</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right pr-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs font-semibold">{d.negocio}</TableCell>
                  <TableCell className="text-xs">{d.fecha ? formatDate(d.fecha) : "—"}</TableCell>
                  <TableCell className="text-xs">{d.sdrNombre ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge label={d.estado} tone={ESTADO_DEMO_TONE[d.estado]} />
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    {d.estado === "agendada" && (
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => moverEtapa({ id: d.leadId, nuevoEstado: "demo_realizada", estadoActual: "demo_agendada" })}
                        >
                          Asistió
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => moverEtapa({ id: d.leadId, nuevoEstado: "perdido", estadoActual: "demo_agendada", motivo: "No asistió a la demo" })}
                        >
                          No asistió
                        </Button>
                      </div>
                    )}
                    {d.estado === "realizada" && (
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] text-emerald-600"
                          disabled={activando}
                          onClick={() =>
                            convertir(d.leadId, {
                              onSuccess: () => toast.success(`${d.negocio} se activó en Empresas.`),
                              onError: () => toast.error("No se pudo convertir — reintentá."),
                            })
                          }
                        >
                          Ganó — activar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] text-destructive"
                          onClick={() => moverEtapa({ id: d.leadId, nuevoEstado: "perdido", estadoActual: "demo_realizada" })}
                        >
                          Perdió
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
