"use client";

import { toast } from "sonner";
import { Play, Pause, Megaphone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCampanasList, useToggleCampana } from "@/hooks/superadmin/useCampanas";
import { EstadoCampana, ICampana } from "@/interfaces/superadmin";
import { RowActionsMenu, StatusBadge, TableSkeleton, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { cn } from "@/lib/utils";

const ESTADO_TONE: Record<EstadoCampana, "green" | "amber" | "gray" | "blue"> = {
  activa: "green",
  pausada: "amber",
  borrador: "gray",
  finalizada: "blue",
};

export function CampanasTable() {
  const { data, isLoading, isSimulado } = useCampanasList();
  const { mutate: toggle } = useToggleCampana();

  function handleToggle(c: ICampana) {
    toggle(
      { id: c.id, estadoActual: c.estado },
      { onSuccess: (campana) => campana && toast.success(`"${campana.nombre}" ahora está ${campana.estado}.`) }
    );
  }

  if (isLoading) return <TableSkeleton rows={6} cols={7} />;
  if (!data.length) {
    return <EmptyBlock icon={Megaphone} title="Sin campañas todavía" description="Crea la primera campaña con el botón 'Nueva campaña'." />;
  }

  return (
    <div className={cn(isSimulado && cn("rounded-xl p-3.5", SIMULADO_CARD_CLASS))}>
      {isSimulado && (
        <div className="mb-2 flex justify-end">
          <SimuladoBadge />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Enviados</TableHead>
              <TableHead>Apertura</TableHead>
              <TableHead>Conversión</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xs font-semibold">{c.nombre}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.segmento}</TableCell>
                <TableCell>
                  <StatusBadge label={c.canal} tone={c.canal === "WhatsApp" ? "green" : "blue"} />
                </TableCell>
                <TableCell>
                  <StatusBadge label={c.estado} tone={ESTADO_TONE[c.estado]} />
                </TableCell>
                <TableCell className="text-xs">{c.enviados.toLocaleString("es-PE")}</TableCell>
                <TableCell className="text-xs">{c.aperturaPct}%</TableCell>
                <TableCell className="text-xs">{c.conversionPct}%</TableCell>
                <TableCell>
                  <RowActionsMenu
                    actions={[
                      (c.estado === "activa"
                        ? { label: "Pausar", icon: Pause, onClick: () => handleToggle(c) }
                        : { label: "Activar", icon: Play, onClick: () => handleToggle(c) }),
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
