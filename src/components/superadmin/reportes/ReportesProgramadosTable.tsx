"use client";

import { CalendarClock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useReportesProgramados, useToggleReporteProgramado } from "@/hooks/superadmin/useReportes";
import { TableSkeleton, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";
import { cn } from "@/lib/utils";

export function ReportesProgramadosTable() {
  const { data, isLoading, isSimulado } = useReportesProgramados();
  const { mutate: toggle } = useToggleReporteProgramado();

  if (isLoading) return <TableSkeleton rows={4} cols={5} />;
  if (!data?.length) {
    return <EmptyBlock icon={CalendarClock} title="Sin reportes programados" description="Programa un envío recurrente con el botón 'Programar reporte'." />;
  }

  return (
    <div className={cn(isSimulado && cn("rounded-xl p-3.5", SIMULADO_CARD_CLASS))}>
      {isSimulado && (
        <div className="mb-3 flex items-center justify-end">
          <SimuladoBadge />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
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
    </div>
  );
}
