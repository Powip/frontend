"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { getReportesProgramados, toggleReporteProgramado } from "@/services/superadmin/reportesService";
import { TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";

export function ReportesProgramadosTable() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "reportes", "programados"],
    queryFn: getReportesProgramados,
  });

  const { mutate: toggle } = useMutation({
    mutationFn: toggleReporteProgramado,
    onSuccess: (reporte) => {
      if (!reporte) return;
      queryClient.invalidateQueries({ queryKey: ["superadmin", "reportes"] });
      toast.success(`Envío de "${reporte.reporte}" ${reporte.activo ? "activado" : "desactivado"}.`);
    },
  });

  if (isLoading) return <TableSkeleton rows={4} cols={5} />;
  if (!data?.length) {
    return <EmptyBlock icon={CalendarClock} title="Sin reportes programados" description="Programa un envío recurrente con el botón 'Programar reporte'." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reporte</TableHead>
            <TableHead>Frecuencia</TableHead>
            <TableHead>Destinatario</TableHead>
            <TableHead>Próximo envío</TableHead>
            <TableHead>Activo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs font-semibold">{r.reporte}</TableCell>
              <TableCell className="text-xs">{r.frecuencia}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.destinatario}</TableCell>
              <TableCell className="text-xs">{formatDate(r.proximoEnvio)}</TableCell>
              <TableCell>
                <Switch checked={r.activo} onCheckedChange={() => toggle(r.id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
