"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { splitVisibleSelection, useVisibleSelection } from "@/hooks/useOperationsPedidos";
import type { OrderStatus } from "@/interfaces/IOrder";
import {
  OPERATIONS_EXPORT_CAP,
  OPERATIONS_SELECT_CAP,
  type OperationsPedidosQuery,
} from "@/services/operationsPedidosService";
import { getStatusLabel } from "@/utils/domain/orders-status-flow";
import { useBulkConfirm } from "./BulkConfirm";
import type { OperationsTabData } from "./tabState";
import { BULK_CONFIRM_THRESHOLD, WHATSAPP_MAX_WINDOWS, type PedidosActions, type Sale } from "./types";
import { useFilterLoader } from "./useFilterLoader";
import type { PedidosSelection } from "./usePedidosSelection";

const fmt = (n: number) => n.toLocaleString("es-PE");

/**
 * Selección, exportación y acciones masivas de una pestaña paginada en servidor.
 *
 * - "Seleccionar los N pedidos del filtro": al marcar la página aparece un banner que, a pedido,
 *   baja todo lo que cumple el filtro (tope 2.000) con progreso y opción de cancelar.
 * - Exportar Excel: con selección, solo lo seleccionado que cumple los filtros actuales; sin
 *   selección, todo el filtro paginando por dentro (tope 10.000) con progreso. Nunca corta en silencio.
 * - Cambiar estado y WhatsApp masivo piden confirmación con la cantidad real cuando superan una página.
 *   WhatsApp abre como máximo 50 ventanas por clic y quita de la selección las ya atendidas.
 */
export function useBulkTools({
  selection,
  query,
  data,
  actions,
  tabName,
}: {
  selection: PedidosSelection;
  query: OperationsPedidosQuery;
  data: OperationsTabData;
  actions: PedidosActions;
  tabName: string;
}) {
  const loader = useFilterLoader(query);
  const { confirm, dialog: confirmDialog } = useBulkConfirm();
  const { visibleIds } = useVisibleSelection(
    selection.selected.map((s) => s.id),
    query,
  );
  const exportSelection = splitVisibleSelection(selection.selected, visibleIds);
  const hasSelection = selection.count > 0;
  const total = data.total;
  const busy = !!loader.progress;
  const product = query.filters.product ?? "";

  // ---- Seleccionar los N pedidos del filtro ----
  const moreThanPage = total > data.sales.length;
  const filterFullySelected = moreThanPage && selection.count >= total;
  const tooManyToSelect = total > OPERATIONS_SELECT_CAP;

  const selectFilter = async () => {
    const result = await loader.load("select", OPERATIONS_SELECT_CAP);
    if (result.status === "done") {
      selection.addMany(result.sales);
      toast.success(`${fmt(result.sales.length)} pedidos seleccionados`);
    } else if (result.status === "too-many") {
      toast.error(`El filtro tiene ${fmt(result.total)} pedidos y el máximo para seleccionarlos todos es ${fmt(result.cap)}. Afina los filtros.`);
    } else if (result.status === "cancelled") {
      toast.info("Selección cancelada");
    } else {
      toast.error("No se pudo seleccionar el filtro completo");
    }
  };

  // ---- Exportar Excel ----
  const exportCount = hasSelection ? exportSelection.visible.length : total;
  const exportTooMany = !hasSelection && total > OPERATIONS_EXPORT_CAP;
  const exportDisabled = busy || exportCount === 0 || exportTooMany;
  const exportTitle = hasSelection
    ? "Exporta los pedidos seleccionados que cumplen los filtros actuales"
    : exportTooMany
      ? `El filtro tiene ${fmt(total)} pedidos y el máximo para exportar es ${fmt(OPERATIONS_EXPORT_CAP)}`
      : "Sin selección: exporta todo lo que cumple el filtro";

  const exportNow = async () => {
    if (hasSelection) {
      actions.onExportExcel(exportSelection.visible, tabName, product);
      return;
    }
    const result = await loader.load("export", OPERATIONS_EXPORT_CAP);
    if (result.status === "done") {
      actions.onExportExcel(result.sales, tabName, product);
    } else if (result.status === "too-many") {
      toast.error(`El filtro tiene ${fmt(result.total)} pedidos y el máximo para exportar es ${fmt(result.cap)}. Acota con filtros o fechas.`);
    } else if (result.status === "cancelled") {
      toast.info("Exportación cancelada");
    } else {
      toast.error("No se pudo exportar el filtro completo");
    }
  };

  // ---- Acciones masivas con confirmación ----
  const bulkStatus = (status: OrderStatus) => {
    const ids = selection.selected.map((s) => s.id);
    const run = () => actions.onBulkStatusChange(ids, status);
    if (ids.length <= BULK_CONFIRM_THRESHOLD) return run();
    confirm({
      title: "Cambiar el estado de varios pedidos",
      description: `Vas a cambiar ${fmt(ids.length)} pedidos a «${getStatusLabel(status)}». Se actualizan uno por uno y puede tardar un momento.`,
      confirmLabel: `Cambiar ${fmt(ids.length)} pedidos`,
      run,
    });
  };

  const bulkWhatsApp = () => {
    const list: Sale[] = selection.selected;
    const send = () => {
      const sent = actions.onBulkWhatsApp(list);
      // Los ya atendidos salen de la selección para poder seguir con el resto.
      if (typeof sent === "number" && sent < list.length) selection.removeMany(list.slice(0, sent).map((s) => s.id));
    };
    if (list.length <= BULK_CONFIRM_THRESHOLD) return send();
    confirm({
      title: "WhatsApp masivo",
      description:
        list.length > WHATSAPP_MAX_WINDOWS
          ? `Se abrirán ${WHATSAPP_MAX_WINDOWS} ventanas de las ${fmt(list.length)} seleccionadas (máximo por clic). Los ya atendidos salen de la selección para que continúes con el resto. Permite los pop-ups.`
          : `Se abrirán ${fmt(list.length)} ventanas de WhatsApp. Permite los pop-ups.`,
      confirmLabel: `Abrir ${Math.min(list.length, WHATSAPP_MAX_WINDOWS)} ventanas`,
      run: send,
    });
  };

  // ---- Piezas de interfaz ----
  const progressNode: ReactNode = loader.progress && (
    <div role="status" data-testid="bulk-progress" className="flex flex-wrap items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
      <span>
        {loader.progress.purpose === "export" ? "Preparando la exportación" : "Seleccionando"}:{" "}
        <b>
          {fmt(loader.progress.loaded)} de {loader.progress.total ? fmt(loader.progress.total) : "…"}
        </b>
      </span>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-violet-200 dark:bg-violet-500/30">
        <div
          className="h-full bg-violet-600 transition-all"
          style={{ width: `${loader.progress.total ? Math.round((loader.progress.loaded / loader.progress.total) * 100) : 5}%` }}
        />
      </div>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={loader.cancel}>
        Cancelar
      </Button>
    </div>
  );

  const bannerNode: ReactNode = (() => {
    if (filterFullySelected) {
      return (
        <div data-testid="select-filter-banner" className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
          <span>
            Están seleccionados los <b>{fmt(total)}</b> pedidos del filtro.
          </span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={selection.clear}>
            Limpiar selección
          </Button>
        </div>
      );
    }
    if (selection.pageAllSelected && moreThanPage) {
      return (
        <div data-testid="select-filter-banner" className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <span>
            Seleccionaste <b>{fmt(selection.count)}</b> pedidos.
          </span>
          {tooManyToSelect ? (
            <span className="text-amber-700 dark:text-amber-300">
              El filtro tiene {fmt(total)} pedidos y el máximo para seleccionarlos todos es {fmt(OPERATIONS_SELECT_CAP)}: afina los filtros.
            </span>
          ) : (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={busy} onClick={selectFilter}>
              Seleccionar los {fmt(total)} pedidos del filtro
            </Button>
          )}
        </div>
      );
    }
    return null;
  })();

  const exportNotice: ReactNode = exportTooMany && (
    <div role="alert" data-testid="export-too-many" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      El filtro tiene {fmt(total)} pedidos y el máximo para exportarlos todos es {fmt(OPERATIONS_EXPORT_CAP)}. Acota con filtros o fechas, o selecciona los pedidos que necesitas.
    </div>
  );

  return {
    bannerNode,
    progressNode,
    exportNotice,
    confirmDialog,
    exportSelection,
    exportCount,
    exportDisabled,
    exportTitle,
    exportNow,
    bulkStatus,
    bulkWhatsApp,
    busy,
  };
}
