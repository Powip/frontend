"use client";

import type { ReactNode } from "react";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import {
  type CourierFila,
  type EfectividadDepartamentoFila,
  type ScoreCourier,
  TIPO_COURIER_LABEL,
} from "@/features/panel-control/operaciones/models/couriers.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatDays,
  formatNumber,
  formatPercent,
  formatSoles,
  formatSolesDecimales,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";
import { evaluarMeta } from "@/features/panel-control/shared/utils/semaforo";
import { cn } from "@/lib/utils";
import { CeldaDrill } from "../ventas/CeldaDrill";
import { ContractBlock, KpiRow } from "../ventas/ContractBlock";
import { OrigenCanalesNota } from "../ventas/OrigenCanalesNota";

const SCORE_TONO: Record<ScoreCourier, string> = {
  A: "bg-pc-ok-soft text-pc-ok",
  B: "bg-pc-ok-soft text-pc-ok",
  C: "bg-pc-warn-soft text-pc-warn",
  D: "bg-pc-bad-soft text-pc-bad",
};

const enlace =
  "rounded font-semibold tabular-nums text-pc-primary underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary";

function Enlace({
  children,
  onSelect,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  onSelect: () => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={ariaLabel}
      className={cn(enlace, className)}
    >
      {children}
    </button>
  );
}

const pendiente = <span className="text-pc-warn">Pendiente</span>;

export function CouriersSubtab() {
  const { view, openDrilldown } = usePanel();
  const verCostos = view.access === "permitido" && view.capabilities.has("ver_costos");
  const state = usePanelContract(
    "operaciones-couriers",
    view.access === "permitido" ? view.query : null,
  );
  const labels = [
    "Envíos",
    "Efectividad de entrega",
    "Entrega al 1er intento",
    "Días de entrega",
    ...(verCostos ? ["Flete promedio"] : []),
    "Por liquidar",
    "Liquidación vencida",
  ];

  const columnasCourier: DataTableColumn<CourierFila>[] = [
    {
      id: "courier",
      header: "Courier",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver envíos de ${fila.nombre}`}
          onSelect={() =>
            openDrilldown(
              grupos.de("envios", `${fila.nombre} · envíos`, { courier: fila.courierId }),
            )
          }
        >
          {fila.nombre}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.nombre,
      exportValue: (fila) => fila.nombre,
    },
    {
      id: "tipo",
      header: "Tipo",
      align: "left",
      cell: (fila) => (fila.tipo ? TIPO_COURIER_LABEL[fila.tipo] : SIN_DATO),
      sortValue: (fila) => fila.tipo,
      exportValue: (fila) => (fila.tipo ? TIPO_COURIER_LABEL[fila.tipo] : null),
    },
    {
      id: "envios",
      header: "Envíos",
      cell: (fila) => formatNumber(fila.envios),
      sortValue: (fila) => fila.envios,
      exportValue: (fila) => fila.envios,
      exportFormat: "numero",
    },
    {
      id: "entregados",
      header: "Entregados",
      cell: (fila) => formatNumber(fila.entregados),
      sortValue: (fila) => fila.entregados,
      exportValue: (fila) => fila.entregados,
      exportFormat: "numero",
    },
    {
      id: "rechazados",
      header: "Rechazados",
      cell: (fila) =>
        fila.rechazados ? (
          <Enlace
            className="text-pc-bad"
            ariaLabel={`Ver ${formatNumber(fila.rechazados)} rechazados de ${fila.nombre}`}
            onSelect={() =>
              openDrilldown(
                grupos.de("rechazados", `${fila.nombre} · rechazados`, { courier: fila.courierId }),
              )
            }
          >
            {formatNumber(fila.rechazados)}
          </Enlace>
        ) : (
          "0"
        ),
      sortValue: (fila) => fila.rechazados,
      exportValue: (fila) => fila.rechazados,
      exportFormat: "numero",
    },
    {
      id: "transito",
      header: "En tránsito",
      cell: (fila) =>
        fila.enTransito ? (
          <Enlace
            ariaLabel={`Ver ${formatNumber(fila.enTransito)} envíos en tránsito de ${fila.nombre}`}
            onSelect={() =>
              openDrilldown(
                grupos.de("envios", `${fila.nombre} · en tránsito`, {
                  courier: fila.courierId,
                  estado: "EN_ENVIO",
                }),
              )
            }
          >
            {formatNumber(fila.enTransito)}
          </Enlace>
        ) : (
          "0"
        ),
      sortValue: (fila) => fila.enTransito,
      exportValue: (fila) => fila.enTransito,
      exportFormat: "numero",
    },
    {
      id: "efectividad",
      header: "Efectividad",
      cell: (fila) => formatPercent(fila.efectividad),
      sortValue: (fila) => fila.efectividad,
      exportValue: (fila) => fila.efectividad,
      exportFormat: "porcentaje",
    },
    {
      id: "primer",
      header: "1er intento",
      cell: (fila) =>
        fila.primerIntento === null && fila.entregados > 0 ? (
          <span title="El courier no informa el primer intento">{SIN_DATO}</span>
        ) : (
          formatPercent(fila.primerIntento)
        ),
      sortValue: (fila) => fila.primerIntento,
      exportValue: (fila) => fila.primerIntento,
      exportFormat: "porcentaje",
    },
    {
      id: "dias",
      header: "Días prom.",
      cell: (fila) => (fila.diasPromedio === null ? SIN_DATO : fila.diasPromedio.toFixed(1)),
      sortValue: (fila) => fila.diasPromedio,
      exportValue: (fila) => fila.diasPromedio,
      exportFormat: "numero",
    },
    {
      id: "flete_prom",
      header: "Flete prom.",
      capability: "ver_costos",
      cell: (fila) => formatSolesDecimales(fila.fletePromedio ?? null),
      sortValue: (fila) => fila.fletePromedio ?? null,
      exportValue: (fila) => fila.fletePromedio ?? null,
      exportFormat: "soles",
    },
    {
      id: "flete_total",
      header: "Flete total",
      capability: "ver_costos",
      cell: (fila) => formatSoles(fila.fleteTotal ?? null),
      sortValue: (fila) => fila.fleteTotal ?? null,
      exportValue: (fila) => fila.fleteTotal ?? null,
      exportFormat: "soles",
    },
    {
      id: "costo_rechazos",
      header: "Costo rechazos",
      capability: "ver_costos",
      cell: (fila) => formatSoles(fila.costoRechazos ?? null),
      sortValue: (fila) => fila.costoRechazos ?? null,
      exportValue: (fila) => fila.costoRechazos ?? null,
      exportFormat: "soles",
    },
    {
      id: "plazo",
      header: "Plazo liq.",
      cell: (fila) =>
        fila.plazoLiquidacionDias === null ? pendiente : formatDays(fila.plazoLiquidacionDias),
      sortValue: (fila) => fila.plazoLiquidacionDias,
      exportValue: (fila) => fila.plazoLiquidacionDias,
      exportFormat: "numero",
    },
    {
      id: "por_liquidar",
      header: "Por liquidar",
      cell: (fila) =>
        fila.porLiquidar ? (
          <Enlace
            ariaLabel={`Ver ${formatSoles(fila.porLiquidar)} por liquidar de ${fila.nombre}`}
            onSelect={() =>
              openDrilldown(
                grupos.actual(
                  "por_liquidar_actual",
                  `${fila.nombre} · por liquidar`,
                  { courier: fila.courierId },
                  "pedir_liquidacion",
                ),
              )
            }
          >
            {formatSoles(fila.porLiquidar)}
          </Enlace>
        ) : (
          formatSoles(0)
        ),
      sortValue: (fila) => fila.porLiquidar,
      exportValue: (fila) => fila.porLiquidar,
      exportFormat: "soles",
    },
    {
      id: "vencido",
      header: "Vencido",
      cell: (fila) =>
        fila.vencido === null ? (
          <span title="Sin plazo de liquidación cargado">{pendiente}</span>
        ) : fila.vencido > 0 ? (
          <Enlace
            className="text-pc-bad"
            ariaLabel={`Ver ${formatSoles(fila.vencido)} vencido de ${fila.nombre}`}
            onSelect={() =>
              openDrilldown(
                grupos.actual(
                  "por_liquidar_actual",
                  `${fila.nombre} · liquidación vencida`,
                  { courier: fila.courierId, vencido: "1" },
                  "pedir_liquidacion",
                ),
              )
            }
          >
            {formatSoles(fila.vencido)}
          </Enlace>
        ) : (
          formatSoles(0)
        ),
      sortValue: (fila) => fila.vencido,
      exportValue: (fila) => fila.vencido,
      exportFormat: "soles",
    },
    {
      id: "score",
      header: "Score",
      cell: (fila) =>
        fila.score ? (
          <span
            className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold", SCORE_TONO[fila.score])}
          >
            {fila.score}
          </span>
        ) : (
          SIN_DATO
        ),
      sortValue: (fila) => fila.score,
      exportValue: (fila) => fila.score,
    },
  ];

  const columnasDepartamento: DataTableColumn<EfectividadDepartamentoFila>[] = [
    {
      id: "departamento",
      header: "Departamento",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver envíos a ${fila.departamento}`}
          onSelect={() =>
            openDrilldown(
              grupos.de("envios", `${fila.departamento} · envíos`, {
                departamento: fila.departamento,
              }),
            )
          }
        >
          {fila.departamento}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.departamento,
      exportValue: (fila) => fila.departamento,
    },
    {
      id: "envios",
      header: "Envíos",
      cell: (fila) => formatNumber(fila.envios),
      sortValue: (fila) => fila.envios,
      exportValue: (fila) => fila.envios,
      exportFormat: "numero",
    },
    {
      id: "efectividad",
      header: "Efectividad",
      cell: (fila) => formatPercent(fila.efectividad),
      sortValue: (fila) => fila.efectividad,
      exportValue: (fila) => fila.efectividad,
      exportFormat: "porcentaje",
    },
    {
      id: "rechazados",
      header: "Rechazados",
      cell: (fila) =>
        fila.rechazados ? (
          <Enlace
            className="text-pc-bad"
            ariaLabel={`Ver ${formatNumber(fila.rechazados)} rechazados en ${fila.departamento}`}
            onSelect={() =>
              openDrilldown(
                grupos.de("rechazados", `${fila.departamento} · rechazados`, {
                  departamento: fila.departamento,
                }),
              )
            }
          >
            {formatNumber(fila.rechazados)}
          </Enlace>
        ) : (
          "0"
        ),
      sortValue: (fila) => fila.rechazados,
      exportValue: (fila) => fila.rechazados,
      exportFormat: "numero",
    },
    {
      id: "courier",
      header: "Courier principal",
      align: "left",
      cell: (fila) => fila.courierPrincipal ?? SIN_DATO,
      sortValue: (fila) => fila.courierPrincipal,
      exportValue: (fila) => fila.courierPrincipal,
    },
    {
      id: "ticket",
      header: "Ticket",
      cell: (fila) => formatSoles(fila.ticket),
      sortValue: (fila) => fila.ticket,
      exportValue: (fila) => fila.ticket,
      exportFormat: "soles",
    },
    {
      id: "flete",
      header: "Flete prom.",
      capability: "ver_costos",
      cell: (fila) => formatSolesDecimales(fila.fletePromedio ?? null),
      sortValue: (fila) => fila.fletePromedio ?? null,
      exportValue: (fila) => fila.fletePromedio ?? null,
      exportFormat: "soles",
    },
  ];

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <KpiRow
        state={state}
        labels={labels}
        titulo="Indicadores de couriers"
        className={
          verCostos
            ? "grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-7"
            : "grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6"
        }
      >
        {(data, origin) => {
          const k = data.actual.kpis;
          const a = data.anterior_misma_antiguedad?.kpis;
          const metas = data.metas?.indicadores;
          const metaDemo = origin.kind === "demo";
          return [
            <KpiCard
              key="envios"
              label="Envíos"
              value={formatNumber(k.envios)}
              origin={origin}
              delta={a ? calcularDelta(k.envios, a.envios) : undefined}
              sub={`${formatNumber(k.entregados)} entregados · ${formatNumber(k.rechazados)} rechazados · ${formatNumber(k.enTransito)} en tránsito`}
              onDrill={() => openDrilldown(grupos.de("envios", "Envíos del periodo"))}
            />,
            <KpiCard
              key="efectividad"
              label="Efectividad de entrega"
              glosario="efectividad_entrega"
              value={formatPercent(k.efectividadEntrega)}
              origin={origin}
              delta={a ? calcularDelta(k.efectividadEntrega, a.efectividadEntrega) : undefined}
              meta={
                metas ? evaluarMeta(k.efectividadEntrega, metas.efectividad_entrega) : undefined
              }
              metaDemo={metaDemo}
              sub="Un prepago cobrado aún en camino no cuenta como entregado"
              onDrill={() => openDrilldown(grupos.rechazados())}
              drillLabel="Ver rechazados"
            />,
            <KpiCard
              key="primer"
              label="Entrega al 1er intento"
              glosario="primer_intento"
              value={formatPercent(k.primerIntento)}
              origin={origin}
              meta={metas ? evaluarMeta(k.primerIntento, metas.primer_intento) : undefined}
              metaDemo={metaDemo}
              sub={
                k.entregasSinDatoPrimerIntento > 0
                  ? `${formatNumber(k.entregasSinDatoPrimerIntento)} entregas sin ese dato quedan fuera`
                  : "Sobre las entregas del periodo"
              }
            />,
            <KpiCard
              key="dias"
              label="Días de entrega"
              value={k.diasEntrega === null ? SIN_DATO : `${k.diasEntrega.toFixed(1)} días`}
              origin={origin}
              delta={a ? calcularDelta(k.diasEntrega, a.diasEntrega, "menos_es_mejor") : undefined}
              sub="Promedio de despacho a entrega"
              onDrill={() => openDrilldown(grupos.entregados())}
              drillLabel="Ver entregados"
            />,
            ...(k.fleteTotal !== undefined
              ? [
                  <KpiCard
                    key="flete"
                    label="Flete promedio"
                    value={formatSolesDecimales(k.fletePromedio ?? null)}
                    origin={origin}
                    sub={`${formatSoles(k.fleteTotal)} total, incluye retornos de provincia`}
                  />,
                ]
              : []),
            <KpiCard
              key="por_liquidar"
              label="Por liquidar"
              glosario="por_liquidar"
              value={formatSoles(k.porLiquidar)}
              origin={origin}
              sub={
                <>
                  {formatNumber(k.pedidosPorLiquidar)} pedidos entregados · estado actual
                  {k.porLiquidarSinPlazo > 0 && (
                    <span className="block text-pc-warn">
                      {formatSoles(k.porLiquidarSinPlazo)} con courier sin plazo cargado
                    </span>
                  )}
                </>
              }
              onDrill={() =>
                openDrilldown(
                  grupos.actual(
                    "por_liquidar_actual",
                    "Entregado sin liquidar",
                    {},
                    "pedir_liquidacion",
                  ),
                )
              }
            />,
            <KpiCard
              key="vencido"
              label="Liquidación vencida"
              value={<span className="text-pc-bad">{formatSoles(k.liquidacionVencida)}</span>}
              origin={origin}
              sub={`${formatNumber(k.pedidosVencidos)} pedidos pasaron el plazo pactado`}
              onDrill={() =>
                openDrilldown(
                  grupos.actual(
                    "por_liquidar_actual",
                    "Liquidación vencida",
                    { vencido: "1" },
                    "pedir_liquidacion",
                  ),
                )
              }
            />,
          ];
        }}
      </KpiRow>
      <ContractBlock
        state={state}
        titulo="Rendimiento por courier"
        subtitulo="Envíos de pedidos ingresados en el periodo. Por liquidar y vencido son estado actual. Score: A ≥ 90 %, B ≥ meta, C hasta 7 puntos bajo la meta, D por debajo."
      >
        {(data, origin) => (
          <DataTable
            caption="Rendimiento por courier"
            columns={columnasCourier}
            rows={data.actual.couriers}
            getRowKey={(fila) => fila.courierId}
            exportar={{ titulo: "Couriers", nombreBase: "couriers", origen: origin.kind }}
            emptyMessage="Sin envíos para estos filtros"
          />
        )}
      </ContractBlock>
      <ContractBlock
        state={state}
        titulo="Efectividad por departamento"
        subtitulo="Dónde se rechaza más; sirve para pedir adelanto por zona"
      >
        {(data, origin) => (
          <DataTable
            caption="Efectividad por departamento"
            columns={columnasDepartamento}
            rows={data.actual.departamentos}
            getRowKey={(fila) => fila.departamento}
            exportar={{
              titulo: "Efectividad por departamento",
              nombreBase: "efectividad_departamento",
              origen: origin.kind,
            }}
            emptyMessage="Sin envíos para estos filtros"
          />
        )}
      </ContractBlock>
    </div>
  );
}
