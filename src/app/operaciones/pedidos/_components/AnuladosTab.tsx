"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Eye, FileSpreadsheet } from "lucide-react";
import {
  SalesTableFilters,
  SalesFilters,
  emptySalesFilters,
  applyFilters,
} from "@/components/ventas/SalesTableFilters";
import { getCancellationReasonLabel } from "@/components/modals/CancellationModal";
import { OPS_PERMISSIONS } from "@/config/operationsPermissions";
import {
  ITEMS_PER_PAGE,
  PedidosActions,
  Sale,
  money,
  formatProductsShort,
} from "./types";
import { formatDateTime } from "./shared";

/**
 * Pestaña "Anulados" — pedidos con status ANULADO, separados de Historial
 * (que solo cubre ENTREGADO) para no mezclar cancelaciones con entregas.
 * Solo lectura + exportar, igual que Historia.
 */
export function AnuladosTab({
  sales,
  actions,
  initialSearch,
}: {
  sales: Sale[];
  actions: PedidosActions;
  initialSearch?: string;
}) {
  const [filters, setFilters] = useState<SalesFilters>({
    ...emptySalesFilters,
    search: initialSearch ?? "",
  });
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => applyFilters(sales, filters),
    [sales, filters],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const canExport = actions.can(OPS_PERMISSIONS.EXPORT);

  const totalAnulado = useMemo(
    () => sales.reduce((sum, s) => sum + s.total, 0),
    [sales],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {sales.length} pedido(s) anulados · {money(totalAnulado)} en total
        </span>
        {canExport && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => actions.onExportExcel(filtered, "anulados")}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>
        )}
      </div>

      <SalesTableFilters
        filters={filters}
        onFiltersChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
        showZoneFilter
        showSourceFilter
      />

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead>N° Orden</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha pedido</TableHead>
              <TableHead>Anulado</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Sin pedidos anulados
                </TableCell>
              </TableRow>
            )}
            {paged.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-medium">
                  {sale.orderNumber}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{sale.clientName}</div>
                  <div className="text-xs text-muted-foreground">
                    {sale.phoneNumber}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{sale.date}</TableCell>
                <TableCell className="text-sm">
                  {formatDateTime(sale.updatedAt)}
                </TableCell>
                <TableCell
                  className="max-w-[220px] truncate text-sm text-muted-foreground"
                  title={formatProductsShort(sale.items)}
                >
                  {formatProductsShort(sale.items)}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    {getCancellationReasonLabel(sale.cancellationReason)}
                  </span>
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {money(sale.total)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Ver pedido"
                      onClick={() => actions.onView(sale)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setPage}
        itemName="pedidos"
      />
    </div>
  );
}
