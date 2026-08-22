"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { EstadoSuscripcion, PlanEmpresa } from "@/interfaces/superadmin";
import { getSuscripciones } from "@/services/superadmin/suscripcionesService";
import { StatusBadge, TableSkeleton, EmptyBlock, BadgeTone } from "@/components/superadmin/shared";
import { money, formatDate } from "@/components/superadmin/shared/format";

const TONE: Record<EstadoSuscripcion, BadgeTone> = {
  activa: "green",
  trial: "blue",
  vencida: "red",
  cancelada: "gray",
};

export function SuscripcionesTable({ q, estado, plan }: { q: string; estado: EstadoSuscripcion | "todos"; plan: PlanEmpresa | "todos" }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "suscripciones", "list", { q, estado, plan, page }],
    queryFn: () => getSuscripciones({ q, estado, plan, page, pageSize: 10 }),
  });

  if (isLoading) return <TableSkeleton rows={8} cols={7} />;
  if (!data?.data.length) {
    return <EmptyBlock icon={RefreshCw} title="Sin resultados para estos filtros" description="Prueba limpiando la búsqueda o el filtro de estado/plan." />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Próximo pago</TableHead>
              <TableHead>Método</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="text-xs font-semibold">{s.empresaNombre}</div>
                  {s.addOns.length > 0 && (
                    <div className="text-[10.5px] text-muted-foreground">+ {s.addOns.join(", ")}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs">{s.plan}</TableCell>
                <TableCell className="text-xs capitalize">{s.ciclo}</TableCell>
                <TableCell className="text-xs font-bold">{money(s.mrr)}</TableCell>
                <TableCell>
                  <StatusBadge label={s.estado} tone={TONE[s.estado]} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(s.proximoPago)}</TableCell>
                <TableCell className="text-xs">{s.metodoPago}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        currentPage={data.meta.page}
        totalPages={data.meta.totalPages}
        totalItems={data.meta.total}
        itemsPerPage={data.meta.pageSize}
        onPageChange={setPage}
        itemName="suscripciones"
      />
    </div>
  );
}
