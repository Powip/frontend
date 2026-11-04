"use client";

import type { ElementType, ReactNode } from "react";
import { AlertTriangle, Archive, Ban, CheckCircle2, Layers, PackageCheck, Truck } from "lucide-react";
import {
  OPERATIONS_TABS,
  getOperationsTabDef,
  type OperationsTabKey,
} from "@/utils/domain/operations-pedidos-tabs";
import type { OperationsCounts } from "@/services/operationsPedidosService";

export const OPERATIONS_TAB_ICON: Record<OperationsTabKey, ElementType> = {
  preparados: Layers,
  camino: Truck,
  despachados: PackageCheck,
  entregados: CheckCircle2,
  anulados: Ban,
  historial: Archive,
  atencion: AlertTriangle,
};

const countOf = (counts: OperationsCounts | undefined, key: keyof OperationsCounts) => counts?.[key];

/** Fila de tarjetas con ícono, nombre y contador grande; la activa en violeta y "Necesita atención" en rojo. */
export function OperationsTabCards({
  counts,
  active,
  onSelect,
}: {
  counts?: OperationsCounts;
  active: OperationsTabKey;
  onSelect: (tab: OperationsTabKey) => void;
}) {
  return (
    <div role="tablist" aria-label="Pestañas de pedidos" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {OPERATIONS_TABS.map((tab) => {
        const Icon = OPERATIONS_TAB_ICON[tab.key];
        const count = countOf(counts, tab.countKey);
        const isActive = tab.key === active;
        const isAlert = !!tab.alerta;
        const hasAlerts = isAlert && (count ?? 0) > 0;
        const base = "flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition";
        const tone = hasAlerts
          ? `border-red-200 bg-red-50 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 ${isActive ? "ring-2 ring-red-400" : ""}`
          : isActive
            ? "border-violet-500 bg-violet-50 ring-1 ring-violet-300 dark:bg-violet-500/10"
            : "border-border bg-card hover:bg-muted/50";
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`tab-card-${tab.key}`}
            onClick={() => onSelect(tab.key)}
            className={`${base} ${tone}`}
          >
            <Icon
              aria-hidden="true"
              className={`h-6 w-6 shrink-0 ${hasAlerts ? "text-red-600" : isActive ? "text-violet-600" : "text-muted-foreground"}`}
            />
            <span className="min-w-0">
              <span
                className={`block truncate text-xs font-semibold ${hasAlerts ? "text-red-700 dark:text-red-300" : isActive ? "text-violet-700 dark:text-violet-300" : "text-foreground"}`}
              >
                {tab.label}
              </span>
              {isAlert ? (
                <span
                  className={`block text-2xl font-extrabold tabular-nums leading-tight ${hasAlerts ? "text-red-600" : "text-foreground"}`}
                >
                  {count ?? "–"}
                  <span className="ml-1 text-sm font-semibold">{count === 1 ? "alerta" : "alertas"}</span>
                </span>
              ) : (
                <span
                  className={`block text-2xl font-extrabold tabular-nums leading-tight ${isActive ? "text-violet-700 dark:text-violet-300" : "text-foreground"}`}
                >
                  {count ?? "–"}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Encabezado de la pestaña activa: ícono + nombre + "N pedidos" + descripción + acción principal. */
export function OperationsTabHeading({
  tab,
  total,
  totalLabel = "pedidos",
  action,
}: {
  tab: OperationsTabKey;
  /** Pedidos que cumplen el filtro actual; undefined mientras carga. */
  total?: number;
  totalLabel?: string;
  action?: ReactNode;
}) {
  const def = getOperationsTabDef(tab);
  const Icon = OPERATIONS_TAB_ICON[tab];
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Icon aria-hidden="true" className={`h-6 w-6 ${def.alerta ? "text-red-600" : "text-violet-600"}`} />
          <h2 className="text-xl font-extrabold tracking-tight">{def.label}</h2>
          {total !== undefined && (
            <span
              data-testid="tab-total-badge"
              className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
            >
              {total} {totalLabel}
            </span>
          )}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{def.description}</p>
      </div>
      {action}
    </div>
  );
}
