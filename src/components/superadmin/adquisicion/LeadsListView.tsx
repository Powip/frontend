"use client";

import { useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { useLeadsList, LeadsFilters } from "@/hooks/superadmin/useAdquisicion";
import { ILead } from "@/interfaces/superadmin";
import { StatusBadge, ESTADO_LEAD_TONE, ESTADO_LEAD_LABEL, TableSkeleton, EmptyBlock, ErrorBanner } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";
import { Target } from "lucide-react";

interface Props {
  filters: LeadsFilters;
  onOpenLead: (id: string) => void;
  onPageChange: (page: number) => void;
  onRowsLoaded: (rows: ILead[]) => void;
}

export function LeadsListView({ filters, onOpenLead, onPageChange, onRowsLoaded }: Props) {
  const { data, meta, isLoading, isError, refetch } = useLeadsList(filters);

  useEffect(() => {
    onRowsLoaded(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isLoading) return <TableSkeleton rows={8} cols={6} />;
  if (isError) return <ErrorBanner message="No se pudo cargar la lista de leads." onRetry={() => refetch()} />;
  if (!data.length) {
    return <EmptyBlock icon={Target} title="Sin leads para estos filtros" description="Prueba limpiando la búsqueda o los filtros aplicados." />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Negocio</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>SDR</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((l) => (
              <TableRow key={l.id} className="cursor-pointer" onClick={() => onOpenLead(l.id)}>
                <TableCell>
                  <div className="text-xs font-semibold">{l.negocio || l.nombre}</div>
                  <div className="text-[10.5px] text-muted-foreground">{l.whatsapp}</div>
                </TableCell>
                <TableCell className="text-xs capitalize">{l.canalAdquisicion}</TableCell>
                <TableCell className="text-xs">{l.sdrNombre ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge label={ESTADO_LEAD_LABEL[l.estado] ?? l.estado} tone={ESTADO_LEAD_TONE[l.estado] ?? "gray"} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(l.fechaLead)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        currentPage={meta.page}
        totalPages={meta.totalPages}
        totalItems={meta.total}
        itemsPerPage={meta.pageSize}
        onPageChange={onPageChange}
        itemName="leads"
      />
    </div>
  );
}
