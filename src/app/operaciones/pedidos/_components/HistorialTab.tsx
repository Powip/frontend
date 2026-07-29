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
import { Eye, FileSpreadsheet, Receipt } from "lucide-react";
import {
  SalesTableFilters,
  SalesFilters,
  emptySalesFilters,
  applyFilters,
} from "@/components/ventas/SalesTableFilters";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";
import { OPS_PERMISSIONS } from "@/config/operationsPermissions";
import { ITEMS_PER_PAGE, PedidosActions, Sale, money, formatProductsShort } from "./types";
import { StatusPill } from "./shared";

type StatusChip = "" | "ENTREGADO" | "ANULADO" | "SALDO";

/** Pestaña "Historial" — ENTREGADO + ANULADO, solo lectura + exportar. */
export function HistorialTab({
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
  const [statusFilter, setStatusFilter] = useState<StatusChip>("");
  const [page, setPage] = useState(1);
  const [comprobanteOrderId, setComprobanteOrderId] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    if (statusFilter === "SALDO") return sales.filter((s) => s.pendingPayment > 0);
    return statusFilter ? sales.filter((s) => s.status === statusFilter) : sales;
  }, [sales, statusFilter]);
  const filtered = useMemo(() => applyFilters(byStatus, filters), [byStatus, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const canExport = actions.can(OPS_PERMISSIONS.EXPORT);

  const conSaldo = sales.filter((s) => s.pendingPayment > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {(["", "ENTREGADO", "ANULADO", "SALDO"] as const).map((s) => (
            <button
              key={s || "todos"}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                statusFilter === s
                  ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              {s === ""
                ? `Todos (${sales.length})`
                : s === "SALDO"
                ? `Con saldo pendiente (${conSaldo})`
                : `${s} (${sales.filter((x) => x.status === s).length})`}
            </button>
          ))}
        </div>
        {canExport && (
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => actions.onExportExcel(filtered, "historial")}>
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
        showGuideFilter
        showSourceFilter
      />

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead>N° Orden</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Guía / Courier</TableHead>
              <TableHead>Liquidación</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  Sin historial que mostrar
                </TableCell>
              </TableRow>
            )}
            {paged.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-medium">{sale.orderNumber}</TableCell>
                <TableCell>
                  <div className="font-medium">{sale.clientName}</div>
                  <div className="text-xs text-muted-foreground">{sale.phoneNumber}</div>
                </TableCell>
                <TableCell className="text-sm">{sale.date}</TableCell>
                <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground" title={formatProductsShort(sale.items)}>
                  {formatProductsShort(sale.items)}
                </TableCell>
                <TableCell>
                  <StatusPill status={sale.status} />
                </TableCell>
                <TableCell className="text-sm">
                  {sale.guideNumber || "—"} · {sale.courier || "—"}
                </TableCell>
                <TableCell>
                  {sale.status === "ANULADO" ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : sale.pendingPayment > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      Pendiente
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700 dark:bg-green-500/15 dark:text-green-300">
                      Liquidado
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm tabular-nums">{money(sale.total)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Comprobante"
                      onClick={() => setComprobanteOrderId(sale.id)}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver pedido" onClick={() => actions.onView(sale)}>
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

      <OrderReceiptModal
        open={comprobanteOrderId !== null}
        orderId={comprobanteOrderId}
        onClose={() => setComprobanteOrderId(null)}
      />
    </div>
  );
}
