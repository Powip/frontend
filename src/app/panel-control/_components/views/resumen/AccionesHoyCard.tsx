"use client";

import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { ACCION_PEDIDO_LABEL } from "@/features/panel-control/acciones/models/accion-pedido.model";
import type { AccionHoy } from "@/features/panel-control/resumen/models/resumen.model";
import {
  ordenarAcciones,
  SUBPESTANA_ACCION,
  textoAccion,
} from "@/features/panel-control/resumen/utils/acciones-texto";
import { getTabDefinition } from "@/features/panel-control/shared/config/panel-tabs.config";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { formatNumber } from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";
import { ResumenBlock, type ResumenState } from "./ResumenBlock";

const ESTILO = {
  alta: { caja: "border-pc-bad/30 bg-pc-bad-soft/50", icono: "bg-pc-bad", texto: "Urgente" },
  media: { caja: "border-pc-warn/30 bg-pc-warn-soft/50", icono: "bg-pc-warn", texto: "Atención" },
  baja: { caja: "border-pc-info/30 bg-pc-info-soft/50", icono: "bg-pc-info", texto: "Informativo" },
} as const;

function FilaAccion({ accion }: { accion: AccionHoy }) {
  const { view, dispatch, openDrilldown } = usePanel();
  const texto = textoAccion(accion);
  const estilo = ESTILO[accion.urgencia];
  const puedeIr = view.access === "permitido" && view.tabs.includes(accion.pestana);
  return (
    <li
      className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5", estilo.caja)}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white",
          estilo.icono,
        )}
      >
        {accion.urgencia === "baja" ? "i" : "!"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-pc-text">
          <span className="sr-only">{estilo.texto}: </span>
          {texto.titulo}
        </p>
        <p className="text-xs text-pc-text-muted">{texto.detalle}</p>
      </div>
      <div className="flex w-full shrink-0 gap-1.5 sm:w-auto">
        <Button
          type="button"
          size="sm"
          className="bg-pc-primary text-white hover:bg-pc-primary-strong"
          aria-label={`${texto.titulo}: ver ${formatNumber(accion.pedidos)} pedidos para ${ACCION_PEDIDO_LABEL[accion.accion].toLowerCase()}`}
          onClick={() => openDrilldown(accion.grupo)}
        >
          Ver {formatNumber(accion.pedidos)} pedidos
        </Button>
        {puedeIr && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Ir a ${getTabDefinition(accion.pestana).label}`}
            onClick={() =>
              dispatch({
                type: "navigate",
                tab: accion.pestana,
                subtab: SUBPESTANA_ACCION[accion.id] ?? null,
              })
            }
          >
            Ir →
          </Button>
        )}
      </div>
    </li>
  );
}

export const AccionesHoyCard = forwardRef<HTMLHeadingElement, { state: ResumenState }>(
  function AccionesHoyCard({ state }, ref) {
    return (
      <ResumenBlock
        state={state}
        id="resumen-acciones"
        skeleton="tabla"
        titulo={
          <span ref={ref} tabIndex={-1} className="outline-none">
            Qué hacer hoy
          </span>
        }
        subtitulo="Estado actual: no depende del periodo, sí de tienda, canal y demás filtros. «Anulaciones sin motivo» cuenta el periodo. Cada tarea abre sus pedidos; las acciones por pedido todavía no se ejecutan desde aquí."
      >
        {(data) => {
          const acciones = ordenarAcciones(data.actual.acciones);
          if (!acciones.length) {
            return (
              <p className="rounded-xl border border-dashed border-pc-border bg-pc-surface-muted p-3 text-xs text-pc-text-muted">
                ✓ No hay pendientes para estos filtros.
              </p>
            );
          }
          return (
            <ul className="flex flex-col gap-2" aria-label="Tareas ordenadas por urgencia">
              {acciones.map((accion) => (
                <FilaAccion key={accion.clave} accion={accion} />
              ))}
            </ul>
          );
        }}
      </ResumenBlock>
    );
  },
);
