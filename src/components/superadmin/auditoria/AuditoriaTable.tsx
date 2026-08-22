"use client";

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuditLog } from "@/services/superadmin/auditoriaService";
import { TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";
import { formatDateTime } from "@/components/superadmin/shared/format";

function fmtJson(v?: Record<string, unknown>): string {
  if (!v || !Object.keys(v).length) return "—";
  return JSON.stringify(v);
}

interface Props {
  q: string;
}

export function AuditoriaTable({ q }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "auditoria", "list", { q }],
    queryFn: () => getAuditLog(q),
  });

  if (isLoading) return <TableSkeleton rows={8} cols={7} />;
  if (!data?.length) {
    return <EmptyBlock icon={History} title="Sin resultados" description="No hay registros de auditoría para esta búsqueda." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Entidad</TableHead>
            <TableHead>Antes</TableHead>
            <TableHead>Después</TableHead>
            <TableHead>IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="text-xs whitespace-nowrap">{formatDateTime(a.ts)}</TableCell>
              <TableCell className="text-xs font-semibold">{a.actorNombre}</TableCell>
              <TableCell className="text-xs">{a.accion}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {a.entidad} · {a.entidadId}
              </TableCell>
              <TableCell className="text-[10.5px] font-mono text-muted-foreground">{fmtJson(a.antes)}</TableCell>
              <TableCell className="text-[10.5px] font-mono text-muted-foreground">{fmtJson(a.despues)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{a.ip}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
