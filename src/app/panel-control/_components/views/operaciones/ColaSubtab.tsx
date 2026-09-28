"use client";

import { BarChart } from "@/components/panel-control/charts/BarChart";
import { HBarList } from "@/components/panel-control/charts/HBarList";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { EstadoBadge } from "@/components/panel-control/EstadoBadge";
import { GoalIndicator } from "@/components/panel-control/GoalIndicator";
import { KpiCard } from "@/components/panel-control/KpiCard";
import { notifyPendingIntegration } from "@/components/panel-control/pending-integration";
import { ACCION_PEDIDO_LABEL } from "@/features/panel-control/acciones/models/accion-pedido.model";
import {
  BUCKET_ANTIGUEDAD_LABEL,
  BUCKETS_ANTIGUEDAD,
  type ColaMatrizFila,
  ETAPA_OPERATIVA_LABEL,
  type TiempoEtapaFila,
} from "@/features/panel-control/operaciones/models/cola.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { ESTADOS_PANEL_DEFINICION } from "@/features/panel-control/shared/config/estados.config";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import type { MetaIndicador } from "@/features/panel-control/shared/models/goal.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { axisNumber } from "@/features/panel-control/shared/utils/chart";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatDayKey,
  formatNumber,
  formatPercent,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";
import { evaluarMeta } from "@/features/panel-control/shared/utils/semaforo";
import { cn } from "@/lib/utils";
import { ContractBlock, KpiRow } from "../ventas/ContractBlock";
import { OrigenCanalesNota } from "../ventas/OrigenCanalesNota";

const KPI_LABELS = [
  "Cola activa",
  "Sin guía +24 h",
  "Envíos retrasados",
  "Días de confirmado a entregado",
  "Incidencia (rechazo)",
];

const formatHoras = (horas: number | null) => (horas === null ? SIN_DATO : `${horas.toFixed(1)} h`);

function metaHoras(fila: TiempoEtapaFila): MetaIndicador | null {
  if (fila.metaHoras === null) return null;
  return {
    id: "dias_ciclo",
    etiqueta: ETAPA_OPERATIVA_LABEL[fila.etapa],
    valor: fila.metaHoras,
    direccion: "maximo",
    unidad: "cantidad",
    tolerancia: 0.1,
  };
}

const enlace =
  "rounded font-semibold tabular-nums text-pc-primary underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary";

export function ColaSubtab() {
  const { view, openDrilldown } = usePanel();
  const state = usePanelContract(
    "operaciones-cola",
    view.access === "permitido" ? view.query : null,
  );

  const abrirCelda = (fila: ColaMatrizFila, bucket?: (typeof BUCKETS_ANTIGUEDAD)[number]) =>
    openDrilldown(
      grupos.actual(
        "cola_operativa",
        `${ESTADOS_PANEL_DEFINICION[fila.estado].etiqueta}${bucket ? ` · ${BUCKET_ANTIGUEDAD_LABEL[bucket]}` : ""}`,
        { estado: fila.estado, ...(bucket ? { antiguedad: bucket } : {}) },
        fila.accion,
      ),
    );

  const columnasMatriz: DataTableColumn<ColaMatrizFila>[] = [
    {
      id: "estado",
      header: "Estado",
      align: "left",
      cell: (fila) => <EstadoBadge estado={fila.estado} />,
      sortValue: (fila) => fila.estado,
      exportValue: (fila) => ESTADOS_PANEL_DEFINICION[fila.estado].etiqueta,
    },
    ...BUCKETS_ANTIGUEDAD.map(
      (bucket): DataTableColumn<ColaMatrizFila> => ({
        id: bucket,
        header: BUCKET_ANTIGUEDAD_LABEL[bucket],
        cell: (fila) =>
          fila.porAntiguedad[bucket] ? (
            <button
              type="button"
              onClick={() => abrirCelda(fila, bucket)}
              aria-label={`${ESTADOS_PANEL_DEFINICION[fila.estado].etiqueta}, ${BUCKET_ANTIGUEDAD_LABEL[bucket]}: ${formatNumber(fila.porAntiguedad[bucket])} pedidos. Ver pedidos`}
              className={cn(enlace, bucket === "mas_5d" && "text-pc-bad")}
            >
              {formatNumber(fila.porAntiguedad[bucket])}
            </button>
          ) : (
            <span className="text-pc-text-soft">0</span>
          ),
        sortValue: (fila) => fila.porAntiguedad[bucket],
        exportValue: (fila) => fila.porAntiguedad[bucket],
        exportFormat: "numero",
      }),
    ),
    {
      id: "total",
      header: "Total",
      cell: (fila) => (
        <button
          type="button"
          onClick={() => abrirCelda(fila)}
          aria-label={`${ESTADOS_PANEL_DEFINICION[fila.estado].etiqueta}: ${formatNumber(fila.total)} pedidos en total. Ver pedidos`}
          className={enlace}
        >
          {formatNumber(fila.total)}
        </button>
      ),
      sortValue: (fila) => fila.total,
      exportValue: (fila) => fila.total,
      exportFormat: "numero",
    },
    {
      id: "accion",
      header: "Acción",
      cell: (fila) => (
        <button
          type="button"
          disabled={fila.total === 0}
          onClick={() =>
            notifyPendingIntegration(ACCION_PEDIDO_LABEL[fila.accion], "acciones-pedido")
          }
          className="rounded-md border border-pc-border px-2 py-0.5 text-xs font-semibold text-pc-text outline-none hover:border-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary disabled:opacity-50"
        >
          {ACCION_PEDIDO_LABEL[fila.accion]}
          <span className="ml-1 rounded bg-pc-surface-muted px-1 text-[10px] font-bold uppercase text-pc-text-muted">
            Pendiente
          </span>
        </button>
      ),
    },
  ];

  const columnasEtapa: DataTableColumn<TiempoEtapaFila>[] = [
    {
      id: "etapa",
      header: "Etapa",
      align: "left",
      cell: (fila) => ETAPA_OPERATIVA_LABEL[fila.etapa],
      sortValue: (fila) => ETAPA_OPERATIVA_LABEL[fila.etapa],
      exportValue: (fila) => ETAPA_OPERATIVA_LABEL[fila.etapa],
    },
    {
      id: "mediana",
      header: "Mediana",
      cell: (fila) => {
        const meta = metaHoras(fila);
        return (
          <span className="inline-flex items-center gap-1.5">
            {meta && <GoalIndicator compacto evaluacion={evaluarMeta(fila.medianaHoras, meta)} />}
            {formatHoras(fila.medianaHoras)}
          </span>
        );
      },
      sortValue: (fila) => fila.medianaHoras,
      exportValue: (fila) => fila.medianaHoras,
      exportFormat: "numero",
    },
    {
      id: "meta",
      header: "Meta",
      cell: (fila) => (fila.metaHoras === null ? SIN_DATO : `≤ ${fila.metaHoras} h`),
      sortValue: (fila) => fila.metaHoras,
      exportValue: (fila) => fila.metaHoras,
      exportFormat: "numero",
    },
    {
      id: "medidos",
      header: "Pedidos medidos",
      cell: (fila) => formatNumber(fila.pedidosMedidos),
      sortValue: (fila) => fila.pedidosMedidos,
      exportValue: (fila) => fila.pedidosMedidos,
      exportFormat: "numero",
    },
    {
      id: "sobre_meta",
      header: "Sobre la meta",
      cell: (fila) =>
        fila.sobreMeta ? (
          <button
            type="button"
            onClick={() =>
              openDrilldown(
                grupos.de("etapa_lenta", `${ETAPA_OPERATIVA_LABEL[fila.etapa]} · sobre la meta`, {
                  etapa: fila.etapa,
                }),
              )
            }
            aria-label={`${ETAPA_OPERATIVA_LABEL[fila.etapa]}: ${formatNumber(fila.sobreMeta)} pedidos sobre la meta. Ver pedidos`}
            className={enlace}
          >
            {formatNumber(fila.sobreMeta)}
          </button>
        ) : (
          "0"
        ),
      sortValue: (fila) => fila.sobreMeta,
      exportValue: (fila) => fila.sobreMeta,
      exportFormat: "numero",
    },
    {
      id: "sin_fechas",
      header: "Sin fechas",
      cell: (fila) => formatNumber(fila.sinFechas),
      sortValue: (fila) => fila.sinFechas,
      exportValue: (fila) => fila.sinFechas,
      exportFormat: "numero",
    },
  ];

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <KpiRow
        state={state}
        labels={KPI_LABELS}
        titulo="Indicadores de la cola"
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {(data, origin) => {
          const k = data.actual.kpis;
          const a = data.anterior_misma_antiguedad?.kpis;
          const metas = data.metas?.indicadores;
          const metaDemo = origin.kind === "demo";
          return [
            <KpiCard
              key="cola"
              label="Cola activa"
              glosario="cola_operativa"
              value={formatNumber(k.colaActiva)}
              origin={origin}
              sub="Por preparar, despachar o en camino · estado actual"
              onDrill={() => openDrilldown(grupos.actual("cola_operativa", "Cola activa"))}
            />,
            <KpiCard
              key="sin_guia"
              label="Sin guía +24 h"
              value={formatNumber(k.sinGuiaMas24h)}
              origin={origin}
              meta={metas ? evaluarMeta(k.sinGuiaMas24h, metas.ventas_sin_guia) : undefined}
              metaDemo={metaDemo}
              sub="LLAMADO o PREPARADO hace más de 24 h · estado actual"
              onDrill={() =>
                openDrilldown(
                  grupos.accion("ventas_sin_guia", "Ventas sin guía +24 h", "asignar_guia"),
                )
              }
              drillLabel="Asignar guía"
            />,
            <KpiCard
              key="retrasados"
              label="Envíos retrasados"
              value={formatNumber(k.enviosRetrasados)}
              origin={origin}
              sub={
                <>
                  Superan el tiempo normal de su courier · estado actual
                  {k.enviosSinTiempoNormal > 0 && (
                    <span className="block text-pc-warn">
                      {formatNumber(k.enviosSinTiempoNormal)} en camino con courier sin tiempo
                      normal cargado: pendiente
                    </span>
                  )}
                </>
              }
              onDrill={() =>
                openDrilldown(
                  grupos.accion("envios_retrasados", "Envíos retrasados", "reclamar_courier"),
                )
              }
              drillLabel="Reclamar al courier"
            />,
            <KpiCard
              key="ciclo"
              label="Días de confirmado a entregado"
              value={
                k.diasConfirmadoAEntregado === null
                  ? SIN_DATO
                  : `${k.diasConfirmadoAEntregado.toFixed(1)} días`
              }
              origin={origin}
              delta={
                a
                  ? calcularDelta(
                      k.diasConfirmadoAEntregado,
                      a.diasConfirmadoAEntregado,
                      "menos_es_mejor",
                    )
                  : undefined
              }
              meta={metas ? evaluarMeta(k.diasConfirmadoAEntregado, metas.dias_ciclo) : undefined}
              metaDemo={metaDemo}
              sub={`Mediana de ${formatNumber(k.entregasMedidas)} entregas con courier ingresadas en el periodo`}
              onDrill={() =>
                openDrilldown(
                  grupos.de("etapa_lenta", "Ciclo total sobre la meta", { etapa: "ciclo_total" }),
                )
              }
              drillLabel="Ver los lentos"
            />,
            <KpiCard
              key="incidencia"
              label="Incidencia (rechazo)"
              glosario="incidencia_rechazo"
              value={formatPercent(k.incidenciaRechazo)}
              origin={origin}
              delta={
                a
                  ? calcularDelta(k.incidenciaRechazo, a.incidenciaRechazo, "menos_es_mejor")
                  : undefined
              }
              meta={metas ? evaluarMeta(k.incidenciaRechazo, metas.incidencia_rechazo) : undefined}
              metaDemo={metaDemo}
              sub={`${formatNumber(k.rechazados)} rechazados ÷ ${formatNumber(k.entregados + k.rechazados)} cerrados con courier`}
              onDrill={() => openDrilldown(grupos.rechazados())}
              drillLabel="Ver rechazados"
            />,
          ];
        }}
      </KpiRow>
      <ContractBlock
        state={state}
        titulo="Cola por estado y antigüedad"
        subtitulo="Ventas en curso ahora mismo, por tiempo en su estado actual. No depende del periodo. Cada número abre esos pedidos."
      >
        {(data, origin) => (
          <div className="space-y-2">
            <DataTable
              caption="Cola por estado y antigüedad"
              columns={columnasMatriz}
              rows={data.actual.matriz}
              getRowKey={(fila) => fila.estado}
              exportar={{
                titulo: "Cola por estado",
                nombreBase: "cola_estado",
                origen: origin.kind,
              }}
            />
            {data.actual.matriz.some((fila) => fila.sinFecha > 0) && (
              <p role="note" className="text-xs text-pc-warn">
                {formatNumber(data.actual.matriz.reduce((suma, fila) => suma + fila.sinFecha, 0))}{" "}
                pedidos sin fecha de entrada a su estado: no se pueden ubicar por antigüedad.
              </p>
            )}
            <p className="text-xs text-pc-text-muted">
              Las acciones por estado (Preparar, Asignar guía, Coordinar recojo, Reclamar al
              courier) requieren POST /panel/acciones: por ahora solo avisan y no cambian nada.
            </p>
          </div>
        )}
      </ContractBlock>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ContractBlock
          state={state}
          titulo="Tiempo por etapa"
          subtitulo="Mediana en horas de los pedidos con courier ingresados en el periodo y ya entregados, contra su meta"
        >
          {(data, origin) => (
            <DataTable
              caption="Tiempo por etapa"
              columns={columnasEtapa}
              rows={data.actual.tiemposPorEtapa}
              getRowKey={(fila) => fila.etapa}
              exportar={{
                titulo: "Tiempo por etapa",
                nombreBase: "tiempo_etapa",
                origen: origin.kind,
              }}
            />
          )}
        </ContractBlock>
        <ContractBlock
          state={state}
          titulo="Motivos de rechazo"
          subtitulo="Rechazos de pedidos ingresados en el periodo. Un ANULADO no se cuenta como rechazo."
        >
          {(data) => (
            <HBarList
              ariaLabel="Rechazos por motivo"
              formatValue={formatNumber}
              rows={data.actual.motivosRechazo.map((fila) => ({
                key: fila.motivo,
                label: fila.sinMotivo ? "Sin motivo (error de datos)" : fila.motivo,
                value: fila.pedidos,
                barColor: fila.sinMotivo ? "var(--pc-text-soft)" : "var(--pc-bad)",
                dotColor: fila.sinMotivo ? "var(--pc-text-soft)" : "var(--pc-bad)",
                onSelect: () =>
                  openDrilldown(
                    grupos.de("rechazados", `Rechazos · ${fila.motivo}`, {
                      tipo: "rechazado",
                      motivo: fila.motivo,
                    }),
                  ),
              }))}
            />
          )}
        </ContractBlock>
      </div>
      <ContractBlock
        state={state}
        titulo="Despachos por día"
        subtitulo="Pedidos que salieron con courier cada día, por fecha de despacho (incluye pedidos ingresados antes del periodo). Clic o Enter abre los pedidos."
        skeleton="grafico"
      >
        {(data) => {
          const dias = data.actual.despachosPorDia;
          return (
            <BarChart
              ariaLabel="Despachos por día"
              formatAxis={axisNumber}
              color="var(--pc-series-7)"
              height={220}
              width={1000}
              data={dias.map((dia) => ({
                key: dia.dia,
                label: dias.length > 2 ? String(Number(dia.dia.slice(8))) : formatDayKey(dia.dia),
                value: dia.despachados,
                description: `${formatDayKey(dia.dia)}: ${formatNumber(dia.despachados)} despachados`,
                onSelect: dia.despachados
                  ? () => openDrilldown(grupos.despachadosDia(dia.dia))
                  : undefined,
              }))}
            />
          );
        }}
      </ContractBlock>
    </div>
  );
}
