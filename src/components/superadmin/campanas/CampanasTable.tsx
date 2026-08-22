"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, Pause, Megaphone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCampanas, toggleCampana } from "@/services/superadmin/campanasService";
import { EstadoCampana } from "@/interfaces/superadmin";
import { RowActionsMenu, StatusBadge, TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";

const ESTADO_TONE: Record<EstadoCampana, "green" | "amber" | "gray" | "blue"> = {
  activa: "green",
  pausada: "amber",
  borrador: "gray",
  finalizada: "blue",
};

export function CampanasTable() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "campanas", "list"], queryFn: getCampanas });

  const { mutate: toggle } = useMutation({
    mutationFn: toggleCampana,
    onSuccess: (campana) => {
      if (!campana) return;
      queryClient.invalidateQueries({ queryKey: ["superadmin", "campanas"] });
      toast.success(`"${campana.nombre}" ahora está ${campana.estado}.`);
    },
  });

  if (isLoading) return <TableSkeleton rows={6} cols={7} />;
  if (!data?.length) {
    return <EmptyBlock icon={Megaphone} title="Sin campañas todavía" description="Crea la primera campaña con el botón 'Nueva campaña'." />;
  }

  return (
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
                      ? { label: "Pausar", icon: Pause, onClick: () => toggle(c.id) }
                      : { label: "Activar", icon: Play, onClick: () => toggle(c.id) }),
                  ]}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
