"use client";

import { ExternalOrderNumberCell, ExternalOrderNumberHead } from "@/components/orders/ExternalOrderNumberColumn";
import { hasExternalOrderNumbers } from "@/lib/externalOrderNumber";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  FileSpreadsheet,
  Loader2,
  MoreVertical,
  PackagePlus,
  Pencil,
  Plus,
  PlusCircle,
  Printer,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinancialStatusBadge } from "@/components/shared/FinancialStatusBadge";
import { OrderDetailButton } from "@/components/orders/OrderDetailModal";
import { BulkStatusSelect } from "@/components/ventas/BulkStatusSelect";
import { OPS_PERMISSIONS } from "@/config/operationsPermissions";
import type { OrderStatus } from "@/interfaces/IOrder";
import { getAvailableStatuses, getStatusLabel } from "@/utils/domain/orders-status-flow";
import { OrderOriginLabel } from "../../_shared/OrderOriginLabel";
import { GuideEligibilityDialog } from "./GuideEligibilityDialog";
import { GuideBlockReason, splitGuideEligibility } from "./guideEligibility";
import type { GuideReviewReturn } from "./guideReviewReturn";
import { NumberedPagination } from "./NumberedPagination";
import { useBulkTools } from "./useBulkTools";
import { OperationsFilterBar } from "./OperationsFilterBar";
import { OperationsTabHeading } from "./OperationsTabsHeader";
import { HiddenSelectionNotice, StockIssueIcon, WhatsAppIcon, formatDateTime } from "./shared";
import type { OperationsTabProps } from "./tabState";
import { ITEMS_PER_PAGE, computeBulkAvailableStatuses, money, type Sale } from "./types";
import { usePedidosSelection } from "./usePedidosSelection";

const STATUS_OPTIONS: OrderStatus[] = ["PREPARADO", "LLAMADO"];

const BLOCK_SUMMARY_LABEL: Record<GuideBlockReason, string> = {
  STATUS_NOT_ALLOWED: "por su estado actual — avánzalos con \"Cambiar estado\" de cada fila o en lote",
  PICKUP_IN_STORE: "configurado(s) como retiro en tienda",
  HAS_GUIDE: "que ya tiene(n) guía",
  MISSING_DELIVERY_TYPE: "sin tipo de entrega configurado",
  UNSUPPORTED_DELIVERY_TYPE: "con un tipo de entrega que no admite guía",
};

/** Subestado de un pedido preparado: Contactado = LLAMADO, No contactado = PREPARADO. */
export function SubstateBadge({ sale }: { sale: Sale }) {
  const contacted = sale.status === "LLAMADO";
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {contacted ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700 dark:bg-green-500/15 dark:text-green-300">
          <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
          Contactado
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Clock aria-hidden="true" className="h-3 w-3" />
          No contactado
        </span>
      )}
      {sale.callStatus === "NO_ANSWER" && (
        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
          No contesta
        </span>
      )}
      {sale.callStatus === "SCHEDULED" && (
        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          Reprogramado
        </span>
      )}
    </span>
  );
}

export function PreparadosTab({
  data,
  state,
  query,
  onState,
  actions,
  guideReturn,
  onGuideReturnHandled,
}: OperationsTabProps & {
  /** Vuelta desde /registrar-venta: se restaura la selección y, solo si el pedido se guardó, se reabre la revisión. */
  guideReturn?: GuideReviewReturn | null;
  onGuideReturnHandled?: () => void;
}) {
  const selection = usePedidosSelection(data.sales);
  const [guideReview, setGuideReview] = useState<{ ids: string[]; updatedId: string | null } | null>(null);
  const canDispatch = actions.can(OPS_PERMISSIONS.DISPATCH);
  const canExport = actions.can(OPS_PERMISSIONS.EXPORT);
  const canChangeStatus = actions.can(OPS_PERMISSIONS.CHANGE_STATUS_MANUAL);
  const counts = data.counts;

  useEffect(() => {
    if (!guideReturn) return;
    selection.addMany(guideReturn.sales);
    // Sin guardado ("Volver") no se reabre nada ni se anuncia éxito.
    if (guideReturn.updatedId) setGuideReview({ ids: guideReturn.sales.map((s) => s.id), updatedId: guideReturn.updatedId });
    onGuideReturnHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideReturn]);

  // Los datos de la página (frescos) van al final para que ganen sobre los de la selección (posiblemente viejos).
  // FEAT-31: «N° Externo» solo se dibuja si algún pedido de la pestaña lo trae.
  const showExternalCol = hasExternalOrderNumbers(data.sales);
  const known = useMemo(() => new Map([...selection.selected, ...data.sales].map((sale) => [sale.id, sale])), [data.sales, selection.selected]);
  const { eligible, blocked } = splitGuideEligibility(selection.selected);
  const bulkStatuses = useMemo(() => computeBulkAvailableStatuses(selection.selected), [selection.selected]);
  // Resumen por motivo. ANULADO no se cuenta (no tiene sentido pedir que se avance).
  const blockSummary = blocked
    .filter((b) => b.sale.status !== "ANULADO")
    .reduce((acc, b) => acc.set(b.reason, (acc.get(b.reason) ?? 0) + 1), new Map<GuideBlockReason, number>());
  const blockedCount = Array.from(blockSummary.values()).reduce((a, b) => a + b, 0);
  const guideButtonCount = blocked.length === 0 ? `${eligible.length}` : `${eligible.length} de ${selection.count}`;
  const eligibleForCourier = selection.selected.filter((s) => s.status === "ASIGNADO_A_GUIA" && !s.courier);
  const reviewSales = guideReview ? guideReview.ids.flatMap((id) => (known.has(id) ? [known.get(id)!] : [])) : [];

  // Con bloqueados se abre primero la revisión con el motivo de cada uno: nunca se omiten pedidos en silencio.
  const startGuide = (list: Sale[]) => {
    if (list.length === 0) {
      toast.info("Selecciona al menos un pedido para asignarlo a una guía de salida.");
      return;
    }
    const split = splitGuideEligibility(list);
    if (split.blocked.length === 0) actions.onOpenCreateGuide(split.eligible);
    else setGuideReview({ ids: list.map((s) => s.id), updatedId: null });
  };

  const bulk = useBulkTools({ selection, query, data, actions, tabName: "preparados" });
  const ids = () => selection.selected.map((s) => s.id);

  return (
    <div className="space-y-3">
      <OperationsTabHeading
        tab="preparados"
        total={data.loading ? undefined : data.total}
        action={
          canDispatch && (
            <Button className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700" onClick={() => startGuide(selection.selected)}>
              <Plus className="h-4 w-4" />
              Asignar a guía de salida
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Subestado">
        {(
          [
            { key: undefined, label: "Todos", count: counts?.preparados },
            { key: "contactado", label: "Contactado", count: counts?.preparadosContactados },
            { key: "no_contactado", label: "No contactado", count: counts?.preparadosNoContactados },
          ] as const
        ).map((chip) => (
          <button
            key={chip.label}
            type="button"
            aria-pressed={state.sub === chip.key}
            onClick={() => onState({ sub: chip.key })}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              state.sub === chip.key
                ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            {chip.label} ({chip.count ?? "–"})
          </button>
        ))}
      </div>

      <OperationsFilterBar
        state={state}
        onState={onState}
        actions={actions}
        data={data}
        statusOptions={STATUS_OPTIONS}
        showAge
        showCourierDropdown
        trailing={
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs" onClick={actions.onSyncCourier}>
            Sincronizar con courier
          </Button>
        }
      />

      {blockedCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <b>{blockedCount} pedido(s) seleccionados no se pueden incluir en una guía:</b>
            <ul className="mt-1 list-disc pl-4">
              {Array.from(blockSummary.entries()).map(([reason, count]) => (
                <li key={reason}>
                  {count} {BLOCK_SUMMARY_LABEL[reason]}
                </li>
              ))}
            </ul>
            Toca &quot;Asignar a guía&quot; para ver el detalle de cada pedido.
          </div>
        </div>
      )}

      {bulk.bannerNode}
      {bulk.progressNode}
      {bulk.exportNotice}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2" data-testid="bulk-bar">
        <span className="text-xs font-semibold text-muted-foreground">{selection.count} seleccionados</span>
        {canDispatch && (
          <Button
            size="sm"
            className="h-8 gap-1 bg-violet-600 text-xs text-white hover:bg-violet-700"
            disabled={selection.count === 0}
            onClick={() => startGuide(selection.selected)}
            title={blocked.length > 0 ? `${blocked.length} pedido(s) bloqueado(s): se mostrará el detalle` : undefined}
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Asignar a guía ({guideButtonCount})
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          disabled={selection.count === 0}
          onClick={bulk.bulkWhatsApp}
        >
          <WhatsAppIcon className="h-3.5 w-3.5" />
          WhatsApp masivo
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          disabled={selection.count === 0}
          onClick={() => actions.onCopySelected(selection.selected)}
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar
        </Button>
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
        {canChangeStatus && (
          <BulkStatusSelect
            selectedCount={selection.count}
            availableStatuses={bulkStatuses}
            onStatusChange={bulk.bulkStatus}
            isLoading={actions.isBulkLoading}
            extraActions={[{ value: "NO_ANSWER", label: "No Contesta", colorClassName: "text-amber-600" }]}
            onExtraAction={() => actions.onBulkMarkNoAnswer(ids())}
            disabled={selection.count === 0}
          />
        )}
        {canDispatch && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={selection.count === 0}>
                Más acciones
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem disabled={eligible.length === 0} onClick={() => actions.onOpenAddToGuide(eligible)}>
                <PlusCircle className="mr-2 h-3.5 w-3.5" />
                Agregar a guía existente
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={eligibleForCourier.length === 0}
                onClick={() => actions.onAssignCourierBulk(eligibleForCourier)}
              >
                <Truck className="mr-2 h-3.5 w-3.5" />
                Asignar courier ({eligibleForCourier.length})
              </DropdownMenuItem>
              <DropdownMenuItem disabled={actions.isBulkLoading} onClick={() => actions.onBulkPrint(selection.selected)}>
                {actions.isBulkLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-2 h-3.5 w-3.5" />}
                Imprimir etiquetas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onBulkDeliveryReschedule(ids())}>
                <CalendarClock className="mr-2 h-3.5 w-3.5" />
                Reprogramar entrega
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {selection.count > 0 && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={selection.clear}>
            Limpiar selección
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  aria-label="Seleccionar la página"
                  checked={selection.pageAllSelected}
                  onCheckedChange={() => selection.togglePage(data.sales)}
                />
              </TableHead>
              <TableHead>N° Orden</TableHead>
              {showExternalCol && <ExternalOrderNumberHead />}
              <TableHead>Fecha de Venta</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Distrito</TableHead>
              <TableHead>Total / Saldo</TableHead>
              <TableHead>Subestado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.loading && (
              <TableRow>
                <TableCell colSpan={8 + (showExternalCol ? 1 : 0)} className="py-8 text-center text-sm text-muted-foreground">
                  Cargando pedidos…
                </TableCell>
              </TableRow>
            )}
            {!data.loading && data.sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={8 + (showExternalCol ? 1 : 0)} className="py-8 text-center text-sm text-muted-foreground">
                  Sin pedidos preparados
                </TableCell>
              </TableRow>
            )}
            {data.sales.map((sale) => (
              <TableRow key={sale.id} data-testid="preparados-row">
                <TableCell>
                  <Checkbox
                    aria-label={`Seleccionar ${sale.orderNumber}`}
                    checked={selection.ids.has(sale.id)}
                    onCheckedChange={() => selection.toggle(sale)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    <StockIssueIcon show={sale.hasStockIssue} />
                    {sale.orderNumber}
                    <OrderOriginLabel {...sale} />
                  </div>
                  {(sale.storeName || sale.stockStoreName) && (
                    <div className="truncate text-[11px] font-normal text-muted-foreground">
                      {[sale.storeName, sale.stockStoreName].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </TableCell>
                {showExternalCol && <ExternalOrderNumberCell value={sale.externalOrderNumber} />}
                <TableCell className="text-sm">{formatDateTime(sale.createdAt)}</TableCell>
                <TableCell>
                  <div className="truncate font-medium">{sale.clientName}</div>
                  <div className="truncate text-xs text-muted-foreground">{sale.phoneNumber}</div>
                </TableCell>
                <TableCell className="text-sm">{sale.district || "—"}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  {money(sale.total)}
                  <div className="mt-1">
                    <FinancialStatusBadge pendingAmount={sale.pendingPayment} status={sale.status} />
                  </div>
                  {sale.pendingPayment > 0 && (
                    <div className="text-xs font-semibold text-red-600">Saldo {money(sale.pendingPayment)}</div>
                  )}
                </TableCell>
                <TableCell>
                  <SubstateBadge sale={sale} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {canDispatch && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => startGuide([sale])}>
                        <Truck className="h-3.5 w-3.5" />
                        Asignar guía
                      </Button>
                    )}
                    <OrderDetailButton orderId={sale.id} orderNumber={sale.orderNumber} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-green-600 hover:text-green-700"
                      title="WhatsApp"
                      onClick={() => actions.onWhatsApp(sale)}
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Más acciones de ${sale.orderNumber}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => actions.onEdit(sale)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar pedido
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => actions.onOpenPayment(sale)}>
                          {sale.hasPendingApprovalPayments ? "Cobros (pendientes de aprobar)" : "Registrar cobro"}
                        </DropdownMenuItem>
                        {canChangeStatus && (
                          <>
                            <DropdownMenuSeparator />
                            {getAvailableStatuses(sale.status)
                              .filter((status) => status !== sale.status && status !== "ANULADO")
                              .map((status) => (
                                <DropdownMenuItem key={status} onClick={() => actions.onChangeStatus(sale.id, status)}>
                                  Cambiar a {getStatusLabel(status)}
                                </DropdownMenuItem>
                              ))}
                            <DropdownMenuItem onClick={() => actions.onMarkNoAnswer(sale.id)}>No contesta</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => actions.onDeliveryReschedule(sale)}>Reprogramar entrega</DropdownMenuItem>
                          </>
                        )}
                        {actions.can(OPS_PERMISSIONS.REASSIGN_SELLER) && (
                          <DropdownMenuItem onClick={() => actions.onReassignSeller(sale)}>Reasignar vendedor</DropdownMenuItem>
                        )}
                        {actions.can(OPS_PERMISSIONS.CANCEL_ORDER) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => actions.onCancel(sale)}>
                              Anular pedido
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NumberedPagination
        currentPage={state.page}
        totalPages={data.totalPages}
        totalItems={data.total}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={(page) => onState({ page })}
        disabled={data.fetching}
      />

      {bulk.confirmDialog}

      {guideReview && reviewSales.length > 0 && (
        <GuideEligibilityDialog
          open
          sales={reviewSales}
          updatedOrderId={guideReview.updatedId}
          onClose={() => setGuideReview(null)}
          onContinue={(list) => {
            setGuideReview(null);
            actions.onOpenCreateGuide(list);
          }}
          onEditDeliveryType={(sale) => {
            setGuideReview(null);
            actions.onEditDeliveryType(sale, { selectedIds: reviewSales.map((s) => s.id), dayKey: "" });
          }}
        />
      )}
    </div>
  );
}
