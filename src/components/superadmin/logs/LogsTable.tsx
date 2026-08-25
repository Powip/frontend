"use client";

import { ScrollText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLogs } from "@/hooks/superadmin/useLogs";
import { NivelLog } from "@/interfaces/superadmin";
import { StatusBadge, NIVEL_LOG_TONE, TableSkeleton, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { formatDateTime } from "@/components/superadmin/shared/format";
import { cn } from "@/lib/utils";

interface Props {
  nivel: NivelLog | "todos";
}

export function LogsTable({ nivel }: Props) {
  const { data, isLoading, isSimulado } = useLogs(nivel);

  if (isLoading) return <TableSkeleton rows={10} cols={5} />;
  if (!data?.length) {
    return <EmptyBlock icon={ScrollText} title="Sin logs" description="No hay eventos para este filtro." />;
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
              <TableHead>Hora</TableHead>
              <TableHead>Nivel</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Mensaje</TableHead>
              <TableHead>Empresa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap">{formatDateTime(l.ts)}</TableCell>
                <TableCell>
                  <StatusBadge label={l.nivel} tone={NIVEL_LOG_TONE[l.nivel]} />
                </TableCell>
                <TableCell className="text-xs font-mono">{l.servicio}</TableCell>
                <TableCell className="text-xs">{l.mensaje}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.empresaNombre ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
