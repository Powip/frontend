"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Send, Download, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { EstadoFactura } from "@/interfaces/superadmin";
import { getFacturas, marcarFacturaPagada, reenviarFactura } from "@/services/superadmin/facturacionService";
import { RowActionsMenu, StatusBadge, ESTADO_FACTURA_TONE, TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";
import { money, formatDate } from "@/components/superadmin/shared/format";

export function FacturasTable({ q, estado }: { q: string; estado: EstadoFactura | "todos" }) {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "facturacion", "list", { q, estado, page }],
    queryFn: () => getFacturas({ q, estado, page, pageSize: 10 }),
  });

  const { mutate: pagar } = useMutation({
    mutationFn: (id: string) => marcarFacturaPagada(id),
    onSuccess: (factura) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "facturacion"] });
      if (factura) toast.success(`Factura ${factura.id} marcada como pagada.`);
    },
  });

  const { mutate: reenviar } = useMutation({
    mutationFn: (id: string) => reenviarFactura(id),
    onSuccess: ({ id }) => toast.success(`Factura ${id} reenviada al cliente.`),
  });

  if (isLoading) return <TableSkeleton rows={8} cols={7} />;
  if (!data?.data.length) {
    return <EmptyBlock icon={FileText} title="Sin facturas para estos filtros" description="Prueba limpiando la búsqueda o el filtro de estado." />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Emisión</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="text-xs font-medium">{f.id}</TableCell>
                <TableCell className="text-xs">{f.empresaNombre}</TableCell>
                <TableCell className="text-xs">{f.plan}</TableCell>
                <TableCell className="text-xs font-bold">{money(f.monto)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(f.fechaEmision)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(f.fechaVence)}</TableCell>
                <TableCell>
                  <StatusBadge label={f.estado} tone={ESTADO_FACTURA_TONE[f.estado]} />
                </TableCell>
                <TableCell>
                  <RowActionsMenu
                    actions={[
                      {
                        label: "Marcar pagado",
                        icon: CheckCircle2,
                        onClick: () => pagar(f.id),
                      },
                      {
                        label: "Reenviar",
                        icon: Send,
                        onClick: () => reenviar(f.id),
                      },
                      {
                        label: "Descargar PDF",
                        icon: Download,
                        separatorBefore: true,
                        onClick: () => toast.success("PDF generado (mock)."),
                      },
                    ]}
                  />
                </TableCell>
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
        itemName="facturas"
      />
    </div>
  );
}
