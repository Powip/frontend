"use client";

import type { ReactNode } from "react";
import { GoalIndicator } from "@/components/panel-control/GoalIndicator";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { formatNumber, formatPercent } from "@/features/panel-control/shared/utils/format";
import { evaluarMeta } from "@/features/panel-control/shared/utils/semaforo";
import { cn } from "@/lib/utils";
import { ResumenBlock, type ResumenState } from "./ResumenBlock";

interface CeldaProps {
  label: string;
  valor: string;
  extra?: ReactNode;
  alerta?: boolean;
  onSelect?: () => void;
  descripcion: string;
}

function Celda({ label, valor, extra, alerta, onSelect, descripcion }: CeldaProps) {
  const contenido = (
    <>
      <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-pc-text-muted">
        {label}
      </span>
      <span
        className={cn(
          "mt-0.5 block text-lg font-bold tabular-nums",
          alerta ? "text-pc-bad" : "text-pc-text",
        )}
      >
        {valor}
      </span>
    </>
  );
  return (
    <div className="min-w-0 rounded-xl bg-pc-surface-muted px-3 py-2.5">
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`${descripcion}. Ver pedidos`}
          className="w-full rounded text-left outline-none hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
        >
          {contenido}
        </button>
      ) : (
        contenido
      )}
      {extra}
    </div>
  );
}

export function ClientesCard({ state }: { state: ResumenState }) {
  const { view, dispatch, openDrilldown } = usePanel();
  const puedeVer = view.access === "permitido" && view.tabs.includes("canales");
  return (
    <ResumenBlock
      state={state}
      titulo="Clientes"
      subtitulo="Clientes con ventas en el periodo"
      skeleton="kpis"
      acciones={
        puedeVer && (
          <button
            type="button"
            onClick={() => dispatch({ type: "navigate", tab: "canales", subtab: "clientes" })}
            className="rounded text-xs font-semibold text-pc-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-pc-primary"
          >
            Ver →
          </button>
        )
      }
    >
      {(data) => {
        const { clientes } = data.actual;
        const meta = data.metas?.indicadores.recompra;
        return (
          <div className="grid grid-cols-2 gap-2.5">
            <Celda
              label="Nuevos"
              valor={formatNumber(clientes.nuevos)}
              descripcion={`${formatNumber(clientes.nuevos)} clientes nuevos`}
              onSelect={
                clientes.nuevos === null ? undefined : () => openDrilldown(grupos.clientesNuevos())
              }
            />
            <Celda
              label="Recompra"
              valor={formatPercent(clientes.recompra)}
              descripcion={`Recompra ${formatPercent(clientes.recompra)}`}
              extra={
                meta && (
                  <div className="mt-1">
                    <GoalIndicator
                      evaluacion={evaluarMeta(clientes.recompra, meta)}
                      demo={data.metas !== null && state.origin.kind === "demo"}
                    />
                  </div>
                )
              }
            />
            <Celda
              label="Con compra"
              valor={formatNumber(clientes.conCompra)}
              descripcion={`${formatNumber(clientes.conCompra)} clientes con compra`}
            />
            <Celda
              label="Lista negra"
              valor={formatNumber(clientes.listaNegra)}
              alerta={(clientes.listaNegra ?? 0) > 0}
              descripcion={`${formatNumber(clientes.listaNegra)} ventas a clientes con rechazos previos`}
              onSelect={
                clientes.listaNegra === null ? undefined : () => openDrilldown(grupos.listaNegra())
              }
            />
          </div>
        );
      }}
    </ResumenBlock>
  );
}
