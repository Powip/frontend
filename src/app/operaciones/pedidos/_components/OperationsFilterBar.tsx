"use client";

import { useMemo, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesTableFilters } from "@/components/ventas/SalesTableFilters";
import type { OrderStatus } from "@/interfaces/IOrder";
import type { OperationsTabData, TabQueryState } from "./tabState";
import type { PedidosActions } from "./types";

/** Aviso "Últimos 30 días" de Entregados, Anulados e Historial, con salida a un rango propio. */
export function WindowNotice({
  window,
  filters,
  onClear,
}: {
  window?: OperationsTabData["window"];
  filters: TabQueryState["filters"];
  onClear: () => void;
}) {
  const explicit = !!(filters.dateFrom || filters.dateTo);
  return (
    <div
      data-testid="window-notice"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200"
    >
      <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {explicit ? (
        <>
          <span>
            Rango elegido: <b>{filters.dateFrom || "…"}</b> a <b>{filters.dateTo || "hoy"}</b>
          </span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onClear}>
            Volver a los últimos {window?.days ?? 30} días
          </Button>
        </>
      ) : (
        <span>
          <b>Últimos {window?.days ?? 30} días</b> · amplía el rango con «Fecha Desde / Hasta» en Filtros para ver pedidos más antiguos.
        </span>
      )}
    </div>
  );
}

const selectClass = "h-9 rounded-md border bg-background px-2.5 text-xs";

/**
 * Fila de filtros de las pestañas: antigüedad · couriers · Filtros (panel con búsqueda,
 * fechas, pago, zona, canal, producto…). No hay selector de tienda propio: el alcance
 * lo define el selector global «Todo el negocio».
 */
export function OperationsFilterBar({
  state,
  onState,
  actions,
  data,
  statusOptions,
  showAge = false,
  showCourierDropdown = false,
  windowed = false,
  showGuideFilter = true,
  trailing,
}: {
  state: TabQueryState;
  onState: (patch: Partial<TabQueryState>) => void;
  actions: PedidosActions;
  data: OperationsTabData;
  statusOptions: OrderStatus[];
  showAge?: boolean;
  showCourierDropdown?: boolean;
  windowed?: boolean;
  showGuideFilter?: boolean;
  trailing?: ReactNode;
}) {
  const couriers = useMemo(
    () => Array.from(new Set([...actions.apiCouriers, ...(data.metadata?.couriers ?? [])])).sort(),
    [actions.apiCouriers, data.metadata?.couriers],
  );
  const channels = useMemo(
    () => Array.from(new Set([...actions.salesChannels, ...(data.metadata?.channels ?? [])])).sort(),
    [actions.salesChannels, data.metadata?.channels],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {showAge && (
          <select
            aria-label="Antigüedad"
            value={state.minAgeDays ?? ""}
            onChange={(e) => onState({ minAgeDays: e.target.value ? (Number(e.target.value) as 7 | 15) : undefined })}
            className={selectClass}
          >
            <option value="">Cualquier antigüedad</option>
            <option value="7">Más de 7 días</option>
            <option value="15">Más de 15 días</option>
          </select>
        )}
        {showCourierDropdown && (
          <select
            aria-label="Courier"
            value={state.filters.courier}
            onChange={(e) => onState({ filters: { ...state.filters, courier: e.target.value } })}
            className={selectClass}
          >
            <option value="">Todos los couriers</option>
            {couriers.map((courier) => (
              <option key={courier} value={courier}>
                {courier}
              </option>
            ))}
          </select>
        )}
        {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
      </div>

      {windowed && (
        <WindowNotice
          window={data.window}
          filters={state.filters}
          onClear={() => onState({ filters: { ...state.filters, dateFrom: "", dateTo: "" } })}
        />
      )}

      <SalesTableFilters
        filters={state.filters}
        onFiltersChange={(filters) => onState({ filters })}
        showZoneFilter
        showGuideFilter={showGuideFilter}
        showCourierFilter={!showCourierDropdown}
        showStatusFilter={statusOptions.length > 1}
        showChannelFilter
        availableCouriers={couriers}
        availableStatuses={statusOptions}
        availableChannels={channels}
        showProductFilter
        availableProducts={data.metadata?.products ?? []}
      />
    </div>
  );
}
