"use client";

import { HBarList } from "@/components/panel-control/charts/HBarList";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { colorCanal } from "@/features/panel-control/shared/utils/canal-color";
import {
  formatNumber,
  formatPercent,
  formatSoles,
  formatVeces,
} from "@/features/panel-control/shared/utils/format";
import { ResumenBlock, type ResumenState } from "./ResumenBlock";

export function VentasPorCanalCard({ state }: { state: ResumenState }) {
  const { view, dispatch, openDrilldown } = usePanel();
  const { canalColor } = usePanelOptions();
  const puedeVerCanales = view.access === "permitido" && view.tabs.includes("canales");

  return (
    <ResumenBlock
      state={state}
      titulo="Ventas por canal"
      subtitulo="Facturación por canal de origen (el canal de cierre no suma dos veces)"
      skeleton="tabla"
      acciones={
        puedeVerCanales && (
          <button
            type="button"
            onClick={() => dispatch({ type: "navigate", tab: "canales", subtab: "canales" })}
            className="rounded text-xs font-semibold text-pc-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-pc-primary"
          >
            Ver canales →
          </button>
        )
      }
    >
      {(data) => {
        const filas = data.actual.ventasPorCanal;
        const total = data.actual.vendi.facturacion;
        const sinCanal = filas.find((fila) => fila.canalId === null);
        return (
          <div className="space-y-2">
            <HBarList
              ariaLabel="Facturación por canal"
              formatValue={formatSoles}
              total={total}
              rows={filas.map((fila) => {
                const color = colorCanal(
                  fila.canalId,
                  fila.color ?? (fila.canalId ? canalColor(fila.canalId) : null),
                );
                const nombre = fila.canalNombre ?? "Sin canal";
                const retorno =
                  fila.retornoPublicidad !== undefined && fila.retornoPublicidad !== null
                    ? ` · retorno de publicidad ${formatVeces(fila.retornoPublicidad)}`
                    : "";
                return {
                  key: fila.canalId ?? "sin-canal",
                  label: `${nombre} · ${formatNumber(fila.ventas)}`,
                  value: fila.facturacion,
                  dotColor: color,
                  barColor: color,
                  description: `${nombre}: ${formatSoles(fila.facturacion)} · ${formatNumber(fila.ventas)} ventas · ${formatPercent(total ? fila.facturacion / total : null)}${retorno}`,
                  onSelect: () => openDrilldown(grupos.ventasCanal(fila.canalId, fila.canalNombre)),
                };
              })}
            />
            <p className="text-xs text-pc-text-muted">
              Total {formatSoles(filas.reduce((suma, fila) => suma + fila.facturacion, 0))} ·{" "}
              {formatNumber(filas.reduce((suma, fila) => suma + fila.ventas, 0))} ventas
            </p>
            {sinCanal && (
              <p role="note" className="text-xs text-pc-text-muted">
                «Sin canal»: {formatNumber(sinCanal.ventas)} ventas sin canal de origen atribuido.
                Se muestran aparte para que el total cuadre.
              </p>
            )}
          </div>
        );
      }}
    </ResumenBlock>
  );
}
