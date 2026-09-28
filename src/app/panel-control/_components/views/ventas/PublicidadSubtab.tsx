"use client";

import { useState } from "react";
import { BarChart } from "@/components/panel-control/charts/BarChart";
import { HBarList } from "@/components/panel-control/charts/HBarList";
import { LineChart } from "@/components/panel-control/charts/LineChart";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import type { PublicidadCanalFila } from "@/features/panel-control/publicidad/models/publicidad.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { colorCanal } from "@/features/panel-control/shared/utils/canal-color";
import { axisSoles } from "@/features/panel-control/shared/utils/chart";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatDayKey,
  formatNumber,
  formatPercent,
  formatSoles,
  formatVeces,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";
import { CeldaDrill, PuntoColor } from "./CeldaDrill";
import { ContractBlock, KpiRow } from "./ContractBlock";
import { DesglosePauta, PATRON_ESTIMADO } from "./DesglosePauta";
import { OrigenCanalesNota } from "./OrigenCanalesNota";
import { SesionesLiveTabla } from "./SesionesLiveTabla";

export function PublicidadSubtab() {
  const { view, openDrilldown } = usePanel();
  const [diaPauta, setDiaPauta] = useState<string | null>(null);
  const { canalColor } = usePanelOptions();
  const verComisiones = view.access === "permitido" && view.capabilities.has("ver_comisiones");
  const state = usePanelContract("publicidad", view.access === "permitido" ? view.query : null);
  const labels = [
    "Invertido",
    "Retorno de publicidad",
    "Costo por venta",
    "% de la venta",
    ...(verComisiones ? ["Comisiones de plataformas"] : []),
  ];

  const columnas: DataTableColumn<PublicidadCanalFila>[] = [
    {
      id: "canal",
      header: "Canal",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver ventas de ${fila.canalNombre}`}
          onSelect={() => openDrilldown(grupos.ventasCanal(fila.canalId, fila.canalNombre))}
        >
          <PuntoColor color={colorCanal(fila.canalId, canalColor(fila.canalId))} />
          <span className="truncate">{fila.canalNombre}</span>
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.canalNombre,
      exportValue: (fila) => fila.canalNombre,
    },
    {
      id: "directa",
      header: "Pauta directa",
      cell: (fila) => formatSoles(fila.pautaDirecta),
      sortValue: (fila) => fila.pautaDirecta,
      exportValue: (fila) => fila.pautaDirecta,
      exportFormat: "soles",
    },
    {
      id: "general",
      header: "Pauta general (est.)",
      cell: (fila) => (
        <i className="text-pc-text-muted">{formatSoles(fila.pautaGeneralEstimada)}</i>
      ),
      sortValue: (fila) => fila.pautaGeneralEstimada,
      exportValue: (fila) => fila.pautaGeneralEstimada,
      exportFormat: "soles",
    },
    {
      id: "total",
      header: "Total invertido",
      cell: (fila) => <b>{formatSoles(fila.totalInvertido)}</b>,
      sortValue: (fila) => fila.totalInvertido,
      exportValue: (fila) => fila.totalInvertido,
      exportFormat: "soles",
    },
    {
      id: "comision",
      header: "Comisión",
      capability: "ver_comisiones",
      cell: (fila) => formatSoles(fila.comision ?? null),
      sortValue: (fila) => fila.comision ?? null,
      exportValue: (fila) => fila.comision ?? null,
      exportFormat: "soles",
    },
    {
      id: "ventas",
      header: "Ventas",
      cell: (fila) => formatNumber(fila.ventas),
      sortValue: (fila) => fila.ventas,
      exportValue: (fila) => fila.ventas,
      exportFormat: "numero",
    },
    {
      id: "facturacion",
      header: "Facturación",
      cell: (fila) => formatSoles(fila.facturacion),
      sortValue: (fila) => fila.facturacion,
      exportValue: (fila) => fila.facturacion,
      exportFormat: "soles",
    },
    {
      id: "costo_venta",
      header: "Costo por venta",
      cell: (fila) => formatSoles(fila.costoPorVenta),
      sortValue: (fila) => fila.costoPorVenta,
      exportValue: (fila) => fila.costoPorVenta,
      exportFormat: "soles",
    },
    {
      id: "retorno",
      header: "Retorno",
      cell: (fila) => formatVeces(fila.retorno),
      sortValue: (fila) => fila.retorno,
      exportValue: (fila) => fila.retorno,
      exportFormat: "numero",
    },
    {
      id: "ganancia",
      header: "Ganancia",
      capability: "ver_costos",
      cell: (fila) => formatSoles(fila.ganancia ?? null),
      sortValue: (fila) => fila.ganancia ?? null,
      exportValue: (fila) => fila.ganancia ?? null,
      exportFormat: "soles",
    },
  ];

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      {state.data?.actual.inversionNoSeparable && (
        <p role="note" className="rounded-xl bg-pc-warn-soft px-3 py-2 text-xs text-pc-warn">
          La inversión publicitaria no se puede separar por zona, turno o asesora. Las ventas sí
          respetan esos filtros, pero la inversión es la del periodo completo: el retorno y el costo
          por venta con esos filtros son orientativos.
        </p>
      )}
      <KpiRow
        state={state}
        labels={labels}
        titulo="Indicadores de publicidad"
        className={
          verComisiones
            ? "grid grid-cols-2 gap-3 lg:grid-cols-5"
            : "grid grid-cols-2 gap-3 lg:grid-cols-4"
        }
      >
        {(data, origin) => {
          const k = data.actual.kpis;
          const a = data.anterior_misma_antiguedad?.kpis;
          const tarjetas = [
            <KpiCard
              key="invertido"
              label="Invertido"
              glosario="pauta_general"
              value={formatSoles(k.invertido)}
              origin={origin}
              delta={a ? calcularDelta(k.invertido, a.invertido, "menos_es_mejor") : undefined}
              sub={
                <>
                  Directa {formatSoles(k.pautaDirecta)} · general registrada{" "}
                  {formatSoles(k.pautaGeneralRegistrada)}
                  {k.pautaGeneralSinAsignar > 0 && (
                    <span className="block">
                      {formatSoles(k.pautaGeneralSinAsignar)} de pauta general sin canal que la
                      reciba
                    </span>
                  )}
                </>
              }
            />,
            <KpiCard
              key="retorno"
              label="Retorno de publicidad"
              glosario="retorno_publicidad"
              value={formatVeces(k.retornoPublicidad)}
              origin={origin}
              delta={a ? calcularDelta(k.retornoPublicidad, a.retornoPublicidad) : undefined}
              sub={
                k.retornoPublicidad === null
                  ? `${SIN_DATO}: sin inversión registrada en el periodo`
                  : `${formatSoles(k.facturacionEnCanalesConPauta)} facturados en canales con pauta`
              }
              onDrill={
                k.ventasEnCanalesConPauta > 0 ? () => openDrilldown(grupos.ventas()) : undefined
              }
            />,
            <KpiCard
              key="costo_venta"
              label="Costo por venta"
              glosario="costo_por_venta"
              value={formatSoles(k.costoPorVenta)}
              origin={origin}
              delta={
                a ? calcularDelta(k.costoPorVenta, a.costoPorVenta, "menos_es_mejor") : undefined
              }
              sub={
                k.costoPorVenta === null
                  ? `${SIN_DATO}: sin inversión o sin ventas en canales con pauta`
                  : `${formatNumber(k.ventasEnCanalesConPauta)} ventas en canales con pauta`
              }
            />,
            <KpiCard
              key="porcentaje"
              label="% de la venta"
              value={formatPercent(k.porcentajeDeLaVenta, 1)}
              origin={origin}
              delta={
                a
                  ? calcularDelta(k.porcentajeDeLaVenta, a.porcentajeDeLaVenta, "menos_es_mejor")
                  : undefined
              }
              sub="Inversión sobre la facturación total del periodo"
            />,
          ];
          if (k.comisionesPlataformas !== undefined) {
            tarjetas.push(
              <KpiCard
                key="comisiones"
                label="Comisiones de plataformas"
                value={formatSoles(k.comisionesPlataformas)}
                origin={origin}
                sub="Comisión y pasarela según la ficha de cada canal"
              />,
            );
          }
          return tarjetas;
        }}
      </KpiRow>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ContractBlock
          state={state}
          titulo="Inversión por canal"
          subtitulo="Directa: registrada en el canal. General: presupuesto común repartido por facturación (estimado)."
        >
          {(data) => {
            const filas = data.actual.porCanal;
            return (
              <div className="space-y-2">
                <ul
                  className="flex flex-wrap gap-3 text-xs text-pc-text-muted"
                  aria-label="Leyenda"
                >
                  <li className="inline-flex items-center gap-1.5">
                    <i
                      aria-hidden
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: "var(--pc-series-1)" }}
                    />
                    Pauta directa (registrada)
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <i
                      aria-hidden
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: PATRON_ESTIMADO }}
                    />
                    Pauta general (reparto estimado)
                  </li>
                </ul>
                <HBarList
                  ariaLabel="Inversión por canal"
                  formatValue={formatSoles}
                  rows={filas.flatMap((fila) => [
                    ...(fila.pautaDirecta > 0
                      ? [
                          {
                            key: `${fila.canalId}-directa`,
                            label: `${fila.canalNombre} · directa`,
                            value: fila.pautaDirecta,
                            dotColor: colorCanal(fila.canalId, canalColor(fila.canalId)),
                            description: `${fila.canalNombre}: pauta directa registrada ${formatSoles(fila.pautaDirecta)}`,
                            onSelect: () =>
                              openDrilldown(grupos.ventasCanal(fila.canalId, fila.canalNombre)),
                          },
                        ]
                      : []),
                    ...(fila.pautaGeneralEstimada > 0
                      ? [
                          {
                            key: `${fila.canalId}-general`,
                            label: `${fila.canalNombre} · general (est.)`,
                            value: fila.pautaGeneralEstimada,
                            dotColor: colorCanal(fila.canalId, canalColor(fila.canalId)),
                            barColor: PATRON_ESTIMADO,
                            description: `${fila.canalNombre}: pauta general estimada ${formatSoles(fila.pautaGeneralEstimada)} (reparto, no inversión registrada)`,
                            onSelect: () =>
                              openDrilldown(grupos.ventasCanal(fila.canalId, fila.canalNombre)),
                          },
                        ]
                      : []),
                  ])}
                />
                {data.actual.kpis.pautaGeneralSinAsignar > 0 && (
                  <p role="note" className="text-xs text-pc-text-muted">
                    {formatSoles(data.actual.kpis.pautaGeneralSinAsignar)} de pauta general no se
                    reparten: ningún canal que la reciba tuvo ventas en el periodo.
                  </p>
                )}
              </div>
            );
          }}
        </ContractBlock>
        <ContractBlock
          state={state}
          titulo="Inversión diaria"
          subtitulo="Pauta registrada por día. Clic o Enter muestra el desglose de esa inversión."
          skeleton="grafico"
        >
          {(data) => (
            <BarChart
              ariaLabel="Inversión diaria en publicidad"
              formatAxis={axisSoles}
              color="var(--pc-series-2)"
              height={240}
              width={620}
              data={data.actual.porDia.map((dia) => ({
                key: dia.dia,
                label:
                  data.actual.porDia.length > 2
                    ? String(Number(dia.dia.slice(8)))
                    : formatDayKey(dia.dia),
                value: dia.invertido,
                description: `${formatDayKey(dia.dia)}: invertido ${formatSoles(dia.invertido)} · vendido en canales con pauta ${formatSoles(dia.vendido)} (${formatNumber(dia.ventas)} ventas) · costo por venta ${formatSoles(dia.costoPorVenta)}`,
                onSelect: () => setDiaPauta(dia.dia),
                accion: "Ver desglose de pauta",
              }))}
            />
          )}
        </ContractBlock>
      </div>
      <ContractBlock
        state={state}
        titulo="Vendido frente a invertido"
        subtitulo="Facturación diaria en canales con pauta y la inversión del mismo día. Un punto de «Vendido» abre esas ventas; uno de «Invertido» muestra el desglose de la pauta."
        skeleton="linea"
      >
        {(data) => (
          <div className="space-y-2">
            <LineChart
              ariaLabel="Vendido frente a invertido por día"
              etiquetas={data.actual.porDia.map((dia) => formatDayKey(dia.dia))}
              series={[
                {
                  id: "vendido",
                  nombre: "Vendido",
                  color: "var(--pc-series-1)",
                  valores: data.actual.porDia.map((dia) => dia.vendido),
                },
                {
                  id: "invertido",
                  nombre: "Invertido",
                  color: "var(--pc-series-2)",
                  valores: data.actual.porDia.map((dia) => dia.invertido),
                },
              ]}
              formatAxis={axisSoles}
              formatValue={formatSoles}
              height={220}
              width={1000}
              puntos={(serie, indice) => {
                const dia = data.actual.porDia[indice];
                if (!dia) return null;
                if (serie.id === "invertido") {
                  return { accion: "Ver desglose de pauta", onSelect: () => setDiaPauta(dia.dia) };
                }
                if (!dia.ventas) return null;
                return {
                  accion: "Ver ventas",
                  onSelect: () =>
                    openDrilldown(
                      grupos.de(
                        "ventas_dia",
                        `Ventas del ${formatDayKey(dia.dia)} en canales con pauta`,
                        { dia: dia.dia, canales: data.actual.canalesConPauta.join(",") },
                      ),
                    ),
                };
              }}
            />
            {(() => {
              const seleccionado = data.actual.porDia.find((dia) => dia.dia === diaPauta);
              return seleccionado ? (
                <DesglosePauta
                  key={seleccionado.dia}
                  dia={seleccionado}
                  onCerrar={() => setDiaPauta(null)}
                />
              ) : null;
            })()}
          </div>
        )}
      </ContractBlock>
      <ContractBlock
        state={state}
        titulo="Retorno por canal"
        subtitulo="Solo canales con inversión o comisión en el periodo"
      >
        {(data, origin) => (
          <div className="space-y-2">
            <DataTable
              caption="Publicidad por canal"
              columns={columnas}
              rows={data.actual.porCanal}
              getRowKey={(fila) => fila.canalId}
              exportar={{
                titulo: "Publicidad por canal",
                nombreBase: "publicidad_canal",
                origen: origin.kind,
              }}
              emptyMessage="Sin inversión registrada para estos filtros"
            />
            <p role="note" className="text-xs text-pc-text-muted">
              Retorno y costo por venta muestran «{SIN_DATO}» cuando el canal no tiene inversión o
              ventas.
            </p>
          </div>
        )}
      </ContractBlock>
      <ContractBlock
        state={state}
        titulo="Sesiones de TikTok Live"
        subtitulo="Las ventas se atribuyen al canal de origen (Live), aunque se cierren por WhatsApp"
      >
        {(data, origin) => (
          <SesionesLiveTabla sesiones={data.actual.sesionesLive} origen={origin.kind} />
        )}
      </ContractBlock>
    </div>
  );
}
