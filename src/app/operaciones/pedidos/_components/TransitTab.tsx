"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Eye, FileSpreadsheet, Loader2, MoreVertical, PackageCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinancialStatusBadge } from "@/components/shared/FinancialStatusBadge";
import { OrderDetailButton } from "@/components/orders/OrderDetailModal";
import { BulkStatusSelect } from "@/components/ventas/BulkStatusSelect";
import { DELIVERY_ZONES } from "@/constants/operationsDomain";
import { OPS_PERMISSIONS } from "@/config/operationsPermissions";
import type { OrderStatus } from "@/interfaces/IOrder";
import type { OperationsGuideGroup } from "@/services/operationsPedidosService";
import { OrderOriginLabel } from "../../_shared/OrderOriginLabel";
import { NumberedPagination } from "./NumberedPagination";
import { useBulkTools } from "./useBulkTools";
import { OperationsFilterBar } from "./OperationsFilterBar";
import { OperationsTabHeading } from "./OperationsTabsHeader";
import { DiasBadge, HiddenSelectionNotice, WhatsAppIcon, formatDateTime } from "./shared";
import type { OperationsTabProps } from "./tabState";
import { ITEMS_PER_PAGE, computeBulkAvailableStatuses, daysSince, money, type Sale } from "./types";
import { usePedidosSelection } from "./usePedidosSelection";

const ZONE_MAP = new Map(DELIVERY_ZONES.map((zone) => [zone.value, zone]));

/** Etiqueta del estado del pedido en esta vista: igual que el nombre de la pestaña donde vive. */
export function stageLabel(status: OrderStatus): { label: string; className: string } {
  switch (status) {
    case "ASIGNADO_A_GUIA":
      return { label: "Guía por aprobar", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" };
    case "EN_ENVIO":
      return { label: "En camino", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300" };
    case "DESPACHADO":
      return { label: "Despachado", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

/** Aviso real del courier (tracking), solo cuando reportó algo: nunca un "En tránsito" por defecto. */
export function courierNotice(sale: Pick<Sale, "shalomStatus">): { label: string; className: string } | null {
  if (sale.shalomStatus === "ENTREGADO") {
    return { label: "Por confirmar", className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" };
  }
  if (sale.shalomStatus === "EN_DESTINO") {
    return { label: "En agencia", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" };
  }
  return null;
}

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-semibold transition ${
    active
      ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
  }`;

/**
 * Pestañas En camino (guía asignada o aprobada) y Despachados (ya con el courier).
 * En camino: ASIGNADO_A_GUIA muestra "Aprobar guía"; EN_ENVIO muestra "Despachar" y deja
 * "Entregado" en el menú ⋮ (la mayoría de los pedidos pasa directo de EN_ENVIO a ENTREGADO).
 * Despachados: botón "Entregado".
 */
export function TransitTab({ variant, data, state, query, onState, actions }: OperationsTabProps & { variant: "camino" | "despachados" }) {
  const selection = usePedidosSelection(data.sales);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const canChangeStatus = actions.can(OPS_PERMISSIONS.CHANGE_STATUS_MANUAL);
  const canExport = actions.can(OPS_PERMISSIONS.EXPORT);
  const canManageGuides = actions.can(OPS_PERMISSIONS.MANAGE_GUIDES);
  const isCamino = variant === "camino";
  const guideView = state.view === "guia";
  const bulkStatuses = computeBulkAvailableStatuses(selection.selected);
  const statusOptions: OrderStatus[] = isCamino ? ["ASIGNADO_A_GUIA", "EN_ENVIO"] : ["DESPACHADO"];

  const run = async (saleId: string, status: OrderStatus) => {
    setBusy((prev) => new Set(prev).add(saleId));
    try {
      await actions.onChangeStatus(saleId, status);
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(saleId);
        return next;
      });
    }
  };

  const bulk = useBulkTools({ selection, query, data, actions, tabName: isCamino ? "en_camino" : "despachados" });

  const renderRowAction = (sale: Sale) => {
    if (!canChangeStatus) return null;
    const loading = busy.has(sale.id);
    const spinner = loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null;
    if (isCamino && sale.status === "ASIGNADO_A_GUIA") {
      return (
        <Button
          size="sm"
          className="h-7 gap-1 bg-indigo-600 px-2 text-xs font-semibold text-white hover:bg-indigo-700"
          disabled={!canManageGuides}
          title={canManageGuides ? undefined : "No tienes permiso para aprobar guías"}
          onClick={() => actions.onOpenGuide(sale)}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Aprobar guía
        </Button>
      );
    }
    if (isCamino) {
      return (
        <Button
          size="sm"
          className="h-7 gap-1 bg-blue-600 px-2 text-xs font-semibold text-white hover:bg-blue-700"
          disabled={loading}
          onClick={() => run(sale.id, "DESPACHADO")}
        >
          {spinner ?? <PackageCheck className="h-3.5 w-3.5" />}
          Despachar
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        className="h-7 gap-1 bg-green-600 px-2 text-xs font-semibold text-white hover:bg-green-700"
        disabled={loading}
        onClick={() => run(sale.id, "ENTREGADO")}
      >
        {spinner ?? <CheckCircle2 className="h-3.5 w-3.5" />}
        Entregado
      </Button>
    );
  };

  const renderGroupActions = (group: OperationsGuideGroup) => {
    if (!group.guideNumber) return null;
    const anchor = { id: group.orderIds[0], courier: group.courier } as Sale;
    const pendingApproval = group.statuses.includes("ASIGNADO_A_GUIA");
    return (
      <>
        {canChangeStatus && isCamino && pendingApproval && (
          <Button size="sm" className="h-7 gap-1 bg-indigo-600 px-2 text-xs font-semibold text-white hover:bg-indigo-700" onClick={() => actions.onOpenGuide(anchor)}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Aprobar guía
          </Button>
        )}
        {canChangeStatus && isCamino && !pendingApproval && group.statuses.every((status) => status === "EN_ENVIO") && (
          <Button
            size="sm"
            className="h-7 gap-1 bg-blue-600 px-2 text-xs font-semibold text-white hover:bg-blue-700"
            onClick={() => actions.onBulkStatusChange(group.orderIds, "DESPACHADO")}
          >
            <PackageCheck className="h-3.5 w-3.5" />
            Despachar guía
          </Button>
        )}
        {canChangeStatus && !isCamino && (
          <Button
            size="sm"
            className="h-7 gap-1 bg-green-600 px-2 text-xs font-semibold text-white hover:bg-green-700"
            onClick={() => actions.onBulkStatusChange(group.orderIds, "ENTREGADO")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Marcar entregada
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver guía" onClick={() => actions.onOpenGuide(anchor)}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-green-600 hover:text-green-700"
          title="WhatsApp masivo"
          onClick={async () => actions.onBulkWhatsApp(await actions.loadSalesByIds(group.orderIds))}
        >
          <WhatsAppIcon className="h-3.5 w-3.5" />
        </Button>
      </>
    );
  };

  return (
    <div className="space-y-3">
      <OperationsTabHeading
        tab={variant}
        total={data.loading ? undefined : data.total}
        totalLabel={guideView ? `guías · ${data.totalOrders ?? 0} pedidos` : "pedidos"}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros rápidos">
          {!isCamino && (
            <>
              <button type="button" aria-pressed={state.quick === "agencia-por-vencer"} className={chipClass(state.quick === "agencia-por-vencer")}
                onClick={() => onState({ quick: state.quick === "agencia-por-vencer" ? undefined : "agencia-por-vencer" })}>
                Agencia por vencer
              </button>
              <button type="button" aria-pressed={state.quick === "por-confirmar"} className={chipClass(state.quick === "por-confirmar")}
                onClick={() => onState({ quick: state.quick === "por-confirmar" ? undefined : "por-confirmar" })}>
                Por confirmar entrega
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-0.5" role="group" aria-label="Vista">
          {(["pedido", "guia"] as const).map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={state.view === view}
              onClick={() => onState({ view })}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${state.view === view ? "bg-violet-600 text-white" : "text-muted-foreground"}`}
            >
              {view === "pedido" ? "Por pedido" : "Por guía"}
            </button>
          ))}
        </div>
      </div>

      <OperationsFilterBar
        state={state}
        onState={onState}
        actions={actions}
        data={data}
        statusOptions={statusOptions}
        showAge
        showCourierDropdown
        trailing={
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs" onClick={actions.onSyncCourier}>
            Sincronizar con courier
          </Button>
        }
      />

      {!guideView && (
        <>
          {bulk.bannerNode}
          {bulk.progressNode}
          {bulk.exportNotice}
        </>
      )}

      {!guideView && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2" data-testid="bulk-bar">
          <span className="text-xs font-semibold text-muted-foreground">{selection.count} seleccionados</span>
          {canChangeStatus && (
            <BulkStatusSelect
              selectedCount={selection.count}
              availableStatuses={bulkStatuses}
              onStatusChange={bulk.bulkStatus}
              isLoading={actions.isBulkLoading}
              disabled={selection.count === 0}
            />
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={selection.count === 0} onClick={bulk.bulkWhatsApp}>
            <WhatsAppIcon className="h-3.5 w-3.5" />
            WhatsApp masivo
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={selection.count === 0} onClick={() => actions.onCopySelected(selection.selected)}>
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
          {selection.count > 0 && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={selection.clear}>
              Limpiar selección
            </Button>
          )}
        </div>
      )}

      {!guideView ? (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox aria-label="Seleccionar la página" checked={selection.pageAllSelected} onCheckedChange={() => selection.togglePage(data.sales)} />
                </TableHead>
                <TableHead>N° Orden</TableHead>
                <TableHead>Fecha de Venta</TableHead>
                <TableHead>Fecha de Procesado</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Distrito</TableHead>
                <TableHead>Guía</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Días</TableHead>
                <TableHead>Total / Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.loading && (
                <TableRow>
                  <TableCell colSpan={12} className="py-8 text-center text-sm text-muted-foreground">Cargando pedidos…</TableCell>
                </TableRow>
              )}
              {!data.loading && data.sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="py-8 text-center text-sm text-muted-foreground">
                    {isCamino ? "Sin pedidos en camino" : "Sin pedidos despachados"}
                  </TableCell>
                </TableRow>
              )}
              {data.sales.map((sale) => {
                const stage = stageLabel(sale.status);
                const notice = courierNotice(sale);
                return (
                  <TableRow key={sale.id} data-testid="transit-row">
                    <TableCell>
                      <Checkbox aria-label={`Seleccionar ${sale.orderNumber}`} checked={selection.ids.has(sale.id)} onCheckedChange={() => selection.toggle(sale)} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {sale.orderNumber}
                      <OrderOriginLabel {...sale} />
                    </TableCell>
                    <TableCell className="text-sm">{formatDateTime(sale.createdAt)}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(sale.statusChangedAt ?? sale.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{sale.clientName}</div>
                      <div className="text-xs text-muted-foreground">{sale.phoneNumber}</div>
                    </TableCell>
                    <TableCell className="text-sm">{sale.district || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {sale.guideNumber ? (
                        <button className="font-semibold text-violet-600 underline hover:text-violet-700" onClick={() => actions.onOpenGuide(sale)}>
                          {sale.guideNumber}
                        </button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{sale.courier || "—"}</TableCell>
                    <TableCell>
                      <DiasBadge days={daysSince(sale.createdAt)} />
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {money(sale.total)}
                      <div className="mt-1">
                        <FinancialStatusBadge pendingAmount={sale.pendingPayment} status={sale.status} />
                      </div>
                      {sale.pendingPayment > 0 && <div className="text-xs font-semibold text-red-600">Saldo {money(sale.pendingPayment)}</div>}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${stage.className}`}>{stage.label}</span>
                        {notice && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${notice.className}`}>{notice.label}</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {renderRowAction(sale)}
                        <OrderDetailButton orderId={sale.id} orderNumber={sale.orderNumber} />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700" title="WhatsApp" onClick={() => actions.onWhatsApp(sale)}>
                          <WhatsAppIcon className="h-3.5 w-3.5" />
                        </Button>
                        {isCamino && sale.status === "EN_ENVIO" && canChangeStatus && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Más acciones de ${sale.orderNumber}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => run(sale.id, "ENTREGADO")}>
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-green-600" />
                                Entregado
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead>N° Guía</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Zonas</TableHead>
                <TableHead>Por cobrar</TableHead>
                <TableHead>Salió</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.loading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Cargando guías…</TableCell>
                </TableRow>
              )}
              {!data.loading && (data.groups ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Sin guías</TableCell>
                </TableRow>
              )}
              {(data.groups ?? []).map((group) => {
                const pendingApproval = group.statuses.includes("ASIGNADO_A_GUIA");
                const estado = group.hasIncidents
                  ? { label: "Con incidencias", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" }
                  : group.allDeliveredByCourier
                    ? { label: "Por confirmar", cls: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" }
                    : pendingApproval
                      ? { label: "Guía por aprobar", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" }
                      : { label: isCamino ? "En camino" : "Despachado", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" };
                return (
                  <TableRow key={group.guideNumber || "sin-guia"} data-testid="guide-row">
                    <TableCell className="font-medium">
                      {group.guideNumber ? (
                        <button className="font-semibold text-violet-600 underline hover:text-violet-700" onClick={() => actions.onOpenGuide({ id: group.orderIds[0], courier: group.courier } as Sale)}>
                          {group.guideNumber}
                        </button>
                      ) : (
                        "Sin guía"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{group.courier || "—"}</TableCell>
                    <TableCell className="text-sm">
                      <b>{group.orders} pedido(s)</b>
                      <div className="text-xs text-muted-foreground">
                        {group.orderNumbers.slice(0, 2).join(", ")}
                        {group.orders > 2 ? `, +${group.orders - 2}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {group.zones.length === 0
                        ? "—"
                        : group.zones.slice(0, 2).map((zone) => (
                            <span key={zone} className="mr-1 inline-block rounded-full bg-muted px-1.5 py-0.5">
                              {ZONE_MAP.get(zone)?.emoji} {ZONE_MAP.get(zone)?.label ?? zone}
                            </span>
                          ))}
                      {group.zones.length > 2 && <span className="text-muted-foreground">+{group.zones.length - 2}</span>}
                    </TableCell>
                    <TableCell className="text-sm font-semibold tabular-nums text-red-600">{money(group.pending)}</TableCell>
                    <TableCell className="text-sm">{group.departedAt ? new Date(group.departedAt).toLocaleDateString("es-PE") : "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${estado.cls}`}>{estado.label}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">{renderGroupActions(group)}</div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {bulk.confirmDialog}

      <NumberedPagination
        currentPage={state.page}
        totalPages={data.totalPages}
        totalItems={data.total}
        itemsPerPage={ITEMS_PER_PAGE}
        itemName={guideView ? "guías" : "pedidos"}
        onPageChange={(page) => onState({ page })}
        disabled={data.fetching}
      />
    </div>
  );
}
