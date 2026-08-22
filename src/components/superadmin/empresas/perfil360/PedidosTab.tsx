"use client";

import { useState } from "react";
import { usePedidosEmpresa } from "@/hooks/superadmin/useEmpresas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge, TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";
import { money, formatDate } from "@/components/superadmin/shared/format";
import { PackageSearch } from "lucide-react";
import type { BadgeTone } from "@/components/superadmin/shared";
import { IPedidoResumen } from "@/interfaces/superadmin";

const TONE: Record<IPedidoResumen["estado"], BadgeTone> = {
  Entregado: "green",
  "En camino": "blue",
  Preparando: "amber",
  Devuelto: "red",
  Anulado: "gray",
};

export function PedidosTab({ empresaId }: { empresaId: string }) {
  const [page, setPage] = useState(1);
  const { data, meta, isLoading } = usePedidosEmpresa(empresaId, page, 10);

  if (isLoading) return <TableSkeleton rows={6} cols={5} />;
  if (!data.length) {
    return <EmptyBlock icon={PackageSearch} title="Este negocio aún no registra pedidos" description="No hay pedidos en atención al cliente para esta empresa." />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Courier</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs font-medium">{p.id}</TableCell>
                <TableCell className="text-xs">{p.cliente}</TableCell>
                <TableCell className="text-xs font-bold">{money(p.monto)}</TableCell>
                <TableCell>
                  <StatusBadge label={p.estado} tone={TONE[p.estado]} />
                </TableCell>
                <TableCell className="text-xs">{p.courier}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(p.fecha)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={meta.page} totalPages={meta.totalPages} totalItems={meta.total} itemsPerPage={10} onPageChange={setPage} itemName="pedidos" />
    </div>
  );
}
