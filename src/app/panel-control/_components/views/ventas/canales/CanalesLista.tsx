"use client";

import { ProgressBar } from "@/components/panel-control/charts/ProgressBar";
import {
  type CanalFicha,
  FAMILIAS_CANAL,
} from "@/features/panel-control/canales/models/canal-ficha.model";
import type {
  CanalEntregasFila,
  CanalVentasFila,
} from "@/features/panel-control/canales/models/canales-comparativo.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { COLOR_SIN_CANAL, colorCanal } from "@/features/panel-control/shared/utils/canal-color";
import {
  formatNumber,
  formatPercent,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";
import { PuntoColor } from "../CeldaDrill";
import { ContractBlock } from "../ContractBlock";

type ComparativoState = PanelContractState<"canales-comparativo">;

interface CanalesListaProps {
  ventas: ComparativoState;
  entregas: ComparativoState;
  seleccionado: string | null;
  onSeleccionar: (canalId: string) => void;
}

const SIN_FAMILIA = "Sin familia asignada";

export function usaTicket(ficha: CanalFicha): boolean {
  return ficha.entrada === "presencial" || ficha.usaCourier === false;
}

export function CanalesLista({ ventas, entregas, seleccionado, onSeleccionar }: CanalesListaProps) {
  const { openDrilldown } = usePanel();
  const entregasData = entregas.data?.actual;
  const entregasPorCanal = new Map<string | null, CanalEntregasFila>(
    entregasData?.vista === "entregas"
      ? entregasData.filas.map((fila) => [fila.canalId, fila])
      : [],
  );

  return (
    <ContractBlock
      state={ventas}
      titulo="Canales por familia"
      subtitulo="Facturación por canal de origen. Elige un canal para ver su ficha y su detalle."
    >
      {(data) => {
        const actual = data.actual;
        if (actual.vista !== "ventas") return null;
        const filasPorCanal = new Map<string | null, CanalVentasFila>(
          actual.filas.map((fila) => [fila.canalId, fila]),
        );
        const familias = [...FAMILIAS_CANAL, SIN_FAMILIA].map((familia) => {
          const fichas = actual.canales
            .filter((ficha) => (ficha.familia ?? SIN_FAMILIA) === familia)
            .filter((ficha) => ficha.activo || (filasPorCanal.get(ficha.id)?.ventas ?? 0) > 0)
            .sort(
              (a, b) =>
                (filasPorCanal.get(b.id)?.facturacion ?? 0) -
                (filasPorCanal.get(a.id)?.facturacion ?? 0),
            );
          const facturacion = fichas.reduce(
            (total, ficha) => total + (filasPorCanal.get(ficha.id)?.facturacion ?? 0),
            0,
          );
          return { familia, fichas, facturacion };
        });
        const otrasFamilias = actual.canales
          .map((ficha) => ficha.familia)
          .filter(
            (familia): familia is string =>
              !!familia && !(FAMILIAS_CANAL as readonly string[]).includes(familia),
          );
        for (const familia of new Set(otrasFamilias)) {
          const fichas = actual.canales.filter((ficha) => ficha.familia === familia);
          familias.push({
            familia,
            fichas,
            facturacion: fichas.reduce(
              (total, ficha) => total + (filasPorCanal.get(ficha.id)?.facturacion ?? 0),
              0,
            ),
          });
        }
        const sinCanal = filasPorCanal.get(null);
        const visibles = familias.filter((grupo) => grupo.fichas.length > 0);

        return (
          <div className="space-y-3">
            {visibles.map((grupo) => (
              <section key={grupo.familia} aria-label={`Familia ${grupo.familia}`}>
                <h4 className="mb-1 flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-pc-text-muted">
                  <span>{grupo.familia}</span>
                  <span className="tabular-nums">{formatSoles(grupo.facturacion)}</span>
                </h4>
                <ul className="flex flex-col gap-1">
                  {grupo.fichas.map((ficha) => {
                    const fila = filasPorCanal.get(ficha.id);
                    const entrega = entregasPorCanal.get(ficha.id);
                    const color = colorCanal(ficha.id, ficha.color);
                    const metrica = usaTicket(ficha)
                      ? `ticket ${formatSoles(fila?.ticket)}`
                      : entregasData
                        ? `efectividad ${formatPercent(entrega?.efectividadEntrega)}`
                        : `ticket ${formatSoles(fila?.ticket)}`;
                    const activo = seleccionado === ficha.id;
                    return (
                      <li key={ficha.id}>
                        <button
                          type="button"
                          aria-pressed={activo}
                          aria-label={`${ficha.nombre}: ${formatSoles(fila?.facturacion ?? 0)}, ${formatNumber(fila?.ventas ?? 0)} ventas, ${metrica}${fila?.metaPeriodo ? `, ${formatPercent(fila.avanceMeta)} de la meta` : ""}. Ver ficha y detalle`}
                          onClick={() => onSeleccionar(ficha.id)}
                          className={cn(
                            "grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg border border-transparent px-2.5 py-2 text-left text-xs outline-none transition-colors hover:bg-pc-surface-muted focus-visible:ring-2 focus-visible:ring-pc-primary",
                            activo && "border-pc-primary bg-pc-primary-soft",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-1.5 font-semibold text-pc-text">
                            <PuntoColor color={color} />
                            <span className="truncate">{ficha.nombre}</span>
                          </span>
                          <span className="text-right font-semibold tabular-nums text-pc-text">
                            {formatSoles(fila?.facturacion ?? 0)}
                          </span>
                          <span className="text-pc-text-muted">
                            {formatNumber(fila?.ventas ?? 0)} ventas · {metrica}
                          </span>
                          <span className="text-right tabular-nums text-pc-text-muted">
                            {fila?.metaPeriodo
                              ? `${formatPercent(fila.avanceMeta)} meta`
                              : "sin meta"}
                          </span>
                          {fila?.metaPeriodo ? (
                            <span className="col-span-2">
                              <ProgressBar
                                logrado={fila.facturacion}
                                meta={fila.metaPeriodo}
                                etiqueta={`Avance de la meta de ${ficha.nombre}`}
                              />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {sinCanal && sinCanal.ventas > 0 && (
              <button
                type="button"
                onClick={() => openDrilldown(grupos.ventasCanal(null, null))}
                aria-label={`Sin canal: ${formatSoles(sinCanal.facturacion)}, ${formatNumber(sinCanal.ventas)} ventas sin canal de origen. Ver pedidos`}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs text-pc-text-muted outline-none hover:bg-pc-surface-muted focus-visible:ring-2 focus-visible:ring-pc-primary"
              >
                <span className="flex items-center gap-1.5">
                  <PuntoColor color={COLOR_SIN_CANAL} />
                  Sin canal · {formatNumber(sinCanal.ventas)} ventas
                </span>
                <span className="font-semibold tabular-nums">
                  {formatSoles(sinCanal.facturacion)}{" "}
                  <span aria-hidden className="text-pc-primary">
                    ›
                  </span>
                </span>
              </button>
            )}
            <p className="border-t border-pc-border-soft pt-2 text-xs text-pc-text-muted">
              Total {formatSoles(actual.total.facturacion)} · {formatNumber(actual.total.ventas)}{" "}
              ventas
            </p>
          </div>
        );
      }}
    </ContractBlock>
  );
}
