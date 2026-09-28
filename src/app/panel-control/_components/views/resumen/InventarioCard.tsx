"use client";

import { ESTADO_STOCK_LABEL } from "@/features/panel-control/operaciones/models/inventario.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { formatNumber } from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";
import { ResumenBlock, type ResumenState } from "./ResumenBlock";

const MAX_ALERTAS = 6;

function cobertura(dias: number | null): string {
  if (dias === null) return "cobertura —";
  return `cobertura ${dias < 1 ? "< 1" : Math.floor(dias)} d`;
}

export function InventarioCard({ state }: { state: ResumenState }) {
  const { view, dispatch, openDrilldown } = usePanel();
  const puedeVer = view.access === "permitido" && view.tabs.includes("operaciones");
  return (
    <ResumenBlock
      state={state}
      titulo="Inventario"
      skeleton="tabla"
      subtitulo={
        state.data
          ? `${formatNumber(state.data.actual.inventario.agotados)} agotados · ${formatNumber(state.data.actual.inventario.criticos)} con menos de ${state.data.actual.inventario.umbralCriticoDias} días de cobertura · stock actual`
          : "Stock actual: no depende del periodo"
      }
      acciones={
        puedeVer && (
          <button
            type="button"
            onClick={() => dispatch({ type: "navigate", tab: "operaciones", subtab: "inventario" })}
            className="rounded text-xs font-semibold text-pc-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-pc-primary"
          >
            Ver →
          </button>
        )
      }
    >
      {(data) => {
        const alertas = data.actual.inventario.alertas.slice(0, MAX_ALERTAS);
        if (!alertas.length) {
          return <p className="text-xs text-pc-text-muted">Todo con stock suficiente.</p>;
        }
        return (
          <ul className="flex flex-col gap-1.5" aria-label="Productos agotados y críticos">
            {alertas.map((alerta) => (
              <li key={alerta.productoId}>
                <button
                  type="button"
                  onClick={() =>
                    openDrilldown(grupos.esperaProducto(alerta.productoId, alerta.nombre))
                  }
                  aria-label={`${alerta.nombre}: ${ESTADO_STOCK_LABEL[alerta.estado]}, disponible ${formatNumber(alerta.disponible)}, ${cobertura(alerta.coberturaDias)}, ${formatNumber(alerta.ventasEsperando)} ventas esperando. Ver pedidos`}
                  className="flex w-full items-center gap-2 rounded-md py-0.5 text-left text-xs text-pc-text outline-none hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
                >
                  <span className="min-w-0 flex-1 truncate">{alerta.nombre}</span>
                  <span className="shrink-0 text-[11px] text-pc-text-muted">
                    {formatNumber(alerta.ventasEsperando)} esperando ·{" "}
                    {cobertura(alerta.coberturaDias)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold",
                      alerta.estado === "agotado"
                        ? "bg-pc-bad-soft text-pc-bad"
                        : "bg-pc-warn-soft text-pc-warn",
                    )}
                  >
                    {ESTADO_STOCK_LABEL[alerta.estado]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        );
      }}
    </ResumenBlock>
  );
}
