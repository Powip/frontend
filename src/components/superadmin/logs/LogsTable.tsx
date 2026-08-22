"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLogs } from "@/services/superadmin/logsService";
import { NivelLog } from "@/interfaces/superadmin";
import { StatusBadge, NIVEL_LOG_TONE, TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";
import { formatDateTime } from "@/components/superadmin/shared/format";

interface Props {
  nivel: NivelLog | "todos";
}

export function LogsTable({ nivel }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "logs", "list", { nivel }],
    queryFn: () => getLogs(nivel),
  });

  if (isLoading) return <TableSkeleton rows={10} cols={5} />;
  if (!data?.length) {
    return <EmptyBlock icon={ScrollText} title="Sin logs" description="No hay eventos para este filtro." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
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
  );
}
