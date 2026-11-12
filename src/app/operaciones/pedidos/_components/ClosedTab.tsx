"use client";

import { ExternalOrderNumberCell, ExternalOrderNumberHead } from "@/components/orders/ExternalOrderNumberColumn";
import { hasExternalOrderNumbers } from "@/lib/externalOrderNumber";
import { Copy, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinancialStatusBadge } from "@/components/shared/FinancialStatusBadge";
import { OrderDetailButton } from "@/components/orders/OrderDetailModal";
import { getCancellationReasonLabel } from "@/components/modals/CancellationModal";
import { OPS_PERMISSIONS } from "@/config/operationsPermissions";
import type { OrderStatus } from "@/interfaces/IOrder";
import { OrderOriginLabel } from "../../_shared/OrderOriginLabel";
import { NumberedPagination } from "./NumberedPagination";
import { useBulkTools } from "./useBulkTools";
import { OperationsFilterBar } from "./OperationsFilterBar";
import { OperationsTabHeading } from "./OperationsTabsHeader";
import { HiddenSelectionNotice, ProductThumbnails, StatusPill, WhatsAppIcon, formatDateTime } from "./shared";
import type { OperationsTabProps } from "./tabState";
import { ITEMS_PER_PAGE, money, type Sale } from "./types";
import { usePedidosSelection } from "./usePedidosSelection";

type ClosedVariant = "entregados" | "anulados" | "historial";

const EMPTY: Record<ClosedVariant, string> = {
  entregados: "Sin pedidos entregados en este período",
  anulados: "Sin pedidos anulados en este período",
  historial: "Sin pedidos cerrados en este período",
};

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-semibold transition ${
    active
      ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
  }`;

function SettlementBadge({ sale }: { sale: Sale }) {
  return sale.pendingPayment > 0 ? (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
      Pendiente
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700 dark:bg-green-500/15 dark:text-green-300">
      Liquidado
    </span>
  );
}

/**
 * Pestañas de cierre — Entregados, Anulados e Historial (entregados + anulados).
 * Solo lectura + exportar. Por defecto muestran los últimos 30 días; con «Fecha Desde / Hasta»
 * se pide otro rango al servidor (siempre paginado).
 */
export function ClosedTab({ variant, data, state, query, onState, actions }: OperationsTabProps & { variant: ClosedVariant }) {
  const selection = usePedidosSelection(data.sales);
  const canExport = actions.can(OPS_PERMISSIONS.EXPORT);
  const counts = data.counts;
  const statusOptions: OrderStatus[] = variant === "entregados" ? ["ENTREGADO"] : variant === "anulados" ? ["ANULADO"] : ["ENTREGADO", "ANULADO"];
  const bulk = useBulkTools({ selection, query, data, actions, tabName: variant });
  // FEAT-31: «N° Externo» solo se dibuja si algún pedido de la pestaña lo trae.
  const showExternalCol = hasExternalOrderNumbers(data.sales);
  const colSpan = (variant === "historial" ? 11 : variant === "entregados" ? 10 : 9) + (showExternalCol ? 1 : 0);
  const dateLabel = variant === "anulados" ? "Anulado" : variant === "entregados" ? "Entregado" : "Fecha de cierre";

  return (
    <div className="space-y-3">
      <OperationsTabHeading tab={variant} total={data.loading ? undefined : data.total} />

      {variant === "historial" && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Estado">
          {(
            [
              { value: "", label: "Todos", count: counts?.historial },
              { value: "ENTREGADO", label: "Entregados", count: counts?.entregados },
              { value: "ANULADO", label: "Anulados", count: counts?.anulados },
            ] as const
          ).map((chip) => (
            <button
              key={chip.label}
              type="button"
              aria-pressed={state.filters.status === chip.value}
              className={chipClass(state.filters.status === chip.value)}
              onClick={() => onState({ filters: { ...state.filters, status: chip.value } })}
            >
              {chip.label} ({chip.count ?? "–"})
            </button>
          ))}
          <button
            type="button"
            aria-pressed={state.filters.hasPendingBalance === "yes"}
            className={chipClass(state.filters.hasPendingBalance === "yes")}
            onClick={() => onState({ filters: { ...state.filters, hasPendingBalance: state.filters.hasPendingBalance === "yes" ? "" : "yes" } })}
          >
            Con saldo pendiente
          </button>
        </div>
      )}

      <OperationsFilterBar
        state={state}
        onState={onState}
        actions={actions}
        data={data}
        statusOptions={variant === "historial" ? [] : statusOptions}
        windowed
        trailing={
          <>
            {selection.count > 0 && (
              <span className="text-xs font-semibold text-muted-foreground">{selection.count} seleccionados</span>
            )}
            {selection.count > 0 && (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => actions.onCopySelected(selection.selected)}>
                <Copy className="h-3.5 w-3.5" />
                Copiar ({selection.count})
              </Button>
            )}
            {selection.count > 0 && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={selection.clear}>
                Limpiar selección
              </Button>
            )}
            {canExport && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={bulk.exportDisabled}
                title={bulk.exportTitle}
                onClick={bulk.exportNow}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Exportar Excel ({bulk.exportCount})
              </Button>
            )}
            {canExport && selection.count > 0 && <HiddenSelectionNotice count={bulk.exportSelection.hiddenCount} />}
          </>
        }
      />

      {bulk.bannerNode}
      {bulk.progressNode}
      {bulk.exportNotice}

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead className="w-8">
                <Checkbox aria-label="Seleccionar la página" checked={selection.pageAllSelected} onCheckedChange={() => selection.togglePage(data.sales)} />
              </TableHead>
              <TableHead>N° Orden</TableHead>
              {showExternalCol && <ExternalOrderNumberHead />}
              <TableHead>Fecha de Venta</TableHead>
              <TableHead>{dateLabel}</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Productos</TableHead>
              {variant === "historial" && <TableHead>Estado</TableHead>}
              {variant === "anulados" ? <TableHead>Motivo</TableHead> : <TableHead>Guía / Courier</TableHead>}
              {variant !== "anulados" && <TableHead>Liquidación</TableHead>}
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.loading && (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">Cargando pedidos…</TableCell>
              </TableRow>
            )}
            {!data.loading && data.sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">{EMPTY[variant]}</TableCell>
              </TableRow>
            )}
            {data.sales.map((sale) => (
              <TableRow key={sale.id} data-testid="closed-row">
                <TableCell>
                  <Checkbox aria-label={`Seleccionar ${sale.orderNumber}`} checked={selection.ids.has(sale.id)} onCheckedChange={() => selection.toggle(sale)} />
                </TableCell>
                <TableCell className="font-medium">
                  {sale.orderNumber}
                  <OrderOriginLabel {...sale} />
                </TableCell>
                {showExternalCol && <ExternalOrderNumberCell value={sale.externalOrderNumber} />}
                <TableCell className="text-sm">{formatDateTime(sale.createdAt)}</TableCell>
                <TableCell className="text-sm">{formatDateTime(sale.statusChangedAt ?? sale.updatedAt)}</TableCell>
                <TableCell>
                  <div className="font-medium">{sale.clientName}</div>
                  <div className="text-xs text-muted-foreground">{sale.phoneNumber}</div>
                </TableCell>
                <TableCell>
                  <ProductThumbnails items={sale.items} />
                </TableCell>
                {variant === "historial" && (
                  <TableCell>
                    <StatusPill status={sale.status} />
                  </TableCell>
                )}
                {variant === "anulados" ? (
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      {getCancellationReasonLabel(sale.cancellationReason)}
                    </span>
                  </TableCell>
                ) : (
                  <TableCell className="text-sm">
                    {sale.guideNumber || "—"} · {sale.courier || "—"}
                  </TableCell>
                )}
                {variant !== "anulados" && (
                  <TableCell>{sale.status === "ANULADO" ? "—" : <SettlementBadge sale={sale} />}</TableCell>
                )}
                <TableCell className="text-sm tabular-nums">
                  {money(sale.total)}
                  <div className="mt-1">
                    <FinancialStatusBadge pendingAmount={sale.pendingPayment} status={sale.status} />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <OrderDetailButton orderId={sale.id} orderNumber={sale.orderNumber} />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700" title="WhatsApp" onClick={() => actions.onWhatsApp(sale)}>
                      <WhatsAppIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {bulk.confirmDialog}

      <NumberedPagination
        currentPage={state.page}
        totalPages={data.totalPages}
        totalItems={data.total}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={(page) => onState({ page })}
        disabled={data.fetching}
      />
    </div>
  );
}
