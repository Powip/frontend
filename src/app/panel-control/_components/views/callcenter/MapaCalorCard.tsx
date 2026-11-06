"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { SegmentedControl } from "@/components/panel-control/SegmentedControl";
import {
  type CeldaMapaCalor,
  DIAS_SEMANA_LABEL,
  HORAS_MAPA_CALOR,
} from "@/features/panel-control/call-center/models/call-center.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { formatNumber, formatPercent } from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";
import { ContractBlock } from "../ventas/ContractBlock";

function etiquetaCelda(dia: number, hora: number, celda: CeldaMapaCalor | undefined): string {
  const base = `${DIAS_SEMANA_LABEL[dia]} ${hora}:00`;
  if (!celda) return `${base}: sin leads`;
  return `${base}: ${formatNumber(celda.leads)} leads, confirmación ${formatPercent(celda.confirmacion)} (${formatNumber(celda.confirmados)} confirmados, ${formatNumber(celda.anulados)} anulados)`;
}

type VistaMapa = "leads" | "confirmacion";

function MapaCalor({ celdas }: { celdas: CeldaMapaCalor[] }) {
  const [vista, setVista] = useState<VistaMapa>("leads");
  const { openDrilldown } = usePanel();
  const tablaRef = useRef<HTMLTableElement>(null);
  const porClave = new Map(celdas.map((celda) => [`${celda.diaSemana}-${celda.hora}`, celda]));
  const horas = [...new Set([...HORAS_MAPA_CALOR, ...celdas.map((celda) => celda.hora)])].sort(
    (a, b) => a - b,
  );
  const maximo = Math.max(1, ...celdas.map((celda) => celda.leads));
  const inicial = [...celdas].sort((a, b) => b.leads - a.leads)[0];
  const [activa, setActiva] = useState<[number, number]>([
    inicial?.diaSemana ?? 0,
    Math.max(0, horas.indexOf(inicial?.hora ?? horas[0])),
  ]);

  const mover = (event: KeyboardEvent<HTMLButtonElement>, fila: number, columna: number) => {
    const destinos: Record<string, [number, number]> = {
      ArrowUp: [Math.max(0, fila - 1), columna],
      ArrowDown: [Math.min(6, fila + 1), columna],
      ArrowLeft: [fila, Math.max(0, columna - 1)],
      ArrowRight: [fila, Math.min(horas.length - 1, columna + 1)],
      Home: [fila, 0],
      End: [fila, horas.length - 1],
    };
    const destino = destinos[event.key];
    if (!destino) return;
    event.preventDefault();
    setActiva(destino);
    tablaRef.current
      ?.querySelector<HTMLButtonElement>(`[data-celda="${destino[0]}-${destino[1]}"]`)
      ?.focus();
  };

  const celdaActiva = porClave.get(`${activa[0]}-${horas[activa[1]]}`);

  return (
    <div className="space-y-2">
      <SegmentedControl
        ariaLabel="Qué muestra cada celda"
        value={vista}
        onChange={setVista}
        options={[
          { value: "leads", label: "Leads" },
          { value: "confirmacion", label: "% confirmación" },
        ]}
      />
      <div className="overflow-x-auto">
        <table
          ref={tablaRef}
          className="border-separate border-spacing-0.5 text-[10.5px]"
          aria-label="Leads por día y hora de llegada (hora Lima)"
        >
          <thead>
            <tr>
              <th scope="col" className="sr-only">
                Día
              </th>
              {horas.map((hora) => (
                <th key={hora} scope="col" className="px-0.5 font-medium text-pc-text-soft">
                  {hora}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIAS_SEMANA_LABEL.map((dia, fila) => (
              <tr key={dia}>
                <th scope="row" className="pr-1.5 text-right font-medium text-pc-text-muted">
                  {dia}
                </th>
                {horas.map((hora, columna) => {
                  const celda = porClave.get(`${fila}-${hora}`);
                  const intensidad = celda
                    ? vista === "leads"
                      ? celda.leads / maximo
                      : (celda.confirmacion ?? 0)
                    : 0;
                  const esActiva = activa[0] === fila && activa[1] === columna;
                  return (
                    <td key={hora} className="p-0">
                      <button
                        type="button"
                        data-celda={`${fila}-${columna}`}
                        tabIndex={esActiva ? 0 : -1}
                        aria-label={`${etiquetaCelda(fila, hora, celda)}${celda ? ". Ver leads" : ""}`}
                        aria-disabled={!celda}
                        title={etiquetaCelda(fila, hora, celda)}
                        onFocus={() => setActiva([fila, columna])}
                        onKeyDown={(event) => mover(event, fila, columna)}
                        onClick={() => {
                          if (!celda) return;
                          openDrilldown(
                            grupos.de("leads", `Leads del ${dia} a las ${hora}:00`, {
                              dia_semana: String(fila),
                              hora: String(hora),
                            }),
                          );
                        }}
                        className={cn(
                          "grid h-6 w-7 place-items-center rounded tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-pc-text",
                          celda ? "cursor-pointer" : "cursor-default",
                          intensidad > 0.45 ? "text-white" : "text-pc-text",
                        )}
                        style={{
                          background: celda
                            ? `color-mix(in srgb, var(--pc-primary) ${Math.round(12 + intensidad * 88)}%, transparent)`
                            : "var(--pc-surface-muted)",
                        }}
                      >
                        {celda
                          ? vista === "leads"
                            ? celda.leads
                            : celda.confirmacion === null
                              ? "—"
                              : Math.round(celda.confirmacion * 100)
                          : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p aria-live="polite" className="text-xs text-pc-text-muted">
        {etiquetaCelda(activa[0], horas[activa[1]], celdaActiva)}
        {vista === "confirmacion" && " · los números de las celdas son % de confirmación"}
      </p>
    </div>
  );
}

export function MapaCalorCard({ state }: { state: PanelContractState<"callcenter"> }) {
  return (
    <ContractBlock
      state={state}
      titulo="¿A qué hora llegan los leads?"
      subtitulo="Leads del periodo por día y hora de llegada (hora Lima). Cada celda muestra cuántos llegaron; su confirmación va en la descripción. Flechas para moverte, Enter para ver los leads."
      skeleton="grafico"
    >
      {(data) =>
        data.actual.mapaCalor.length ? (
          <MapaCalor celdas={data.actual.mapaCalor} />
        ) : (
          <p className="text-sm text-pc-text-muted">Sin datos para estos filtros</p>
        )
      }
    </ContractBlock>
  );
}
