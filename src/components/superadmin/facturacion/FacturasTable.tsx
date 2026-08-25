"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Send, Download, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { EstadoFactura } from "@/interfaces/superadmin";
import { useFacturas, useMarcarFacturaPagada, useReenviarFactura } from "@/hooks/superadmin/useFacturacion";
import { RowActionsMenu, StatusBadge, ESTADO_FACTURA_TONE, TableSkeleton, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { money, formatDate } from "@/components/superadmin/shared/format";
import { cn } from "@/lib/utils";

export function FacturasTable({ q, estado }: { q: string; estado: EstadoFactura | "todos" }) {
  const [page, setPage] = useState(1);

  const { data, meta, isLoading, isSimulado } = useFacturas({ q, estado, page, pageSize: 10 });

  const { mutate: pagar } = useMarcarFacturaPagada();
  const { mutate: reenviar } = useReenviarFactura();

  function handlePagar(id: string) {
    pagar(id, { onSuccess: (factura) => factura && toast.success(`Factura ${factura.id} marcada como pagada.`) });
  }

  function handleReenviar(id: string) {
    reenviar(id, { onSuccess: ({ id }) => toast.success(`Factura ${id} reenviada al cliente.`) });
  }

  if (isLoading) return <TableSkeleton rows={8} cols={7} />;
  if (!data.length) {
    return <EmptyBlock icon={FileText} title="Sin facturas para estos filtros" description="Prueba limpiando la búsqueda o el filtro de estado." />;
  }

  return (
    <div className={cn(isSimulado && cn("rounded-xl p-3.5", SIMULADO_CARD_CLASS))}>
      {isSimulado && (
        <div className="mb-2 flex justify-end">
          <SimuladoBadge />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
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
            {data.map((f) => (
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
                        onClick: () => handlePagar(f.id),
                      },
                      {
                        label: "Reenviar",
                        icon: Send,
                        onClick: () => handleReenviar(f.id),
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
        currentPage={meta.page}
        totalPages={meta.totalPages}
        totalItems={meta.total}
        itemsPerPage={meta.pageSize}
        onPageChange={setPage}
        itemName="facturas"
      />
    </div>
  );
}
