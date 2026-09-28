"use client";

import { LineChart } from "@/components/panel-control/charts/LineChart";
import { ProgressBar } from "@/components/panel-control/charts/ProgressBar";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import type {
  EstadoResultados,
  RentabilidadCanalFila,
} from "@/features/panel-control/finanzas/models/resultado.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { axisSoles } from "@/features/panel-control/shared/utils/chart";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatNumber,
  formatPercent,
  formatSoles,
  formatVeces,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";
import { endOfMonthKey } from "@/features/panel-control/shared/utils/lima-time";
import { cn } from "@/lib/utils";
import { CeldaDrill } from "../ventas/CeldaDrill";
import { ContractBlock, KpiRow } from "../ventas/ContractBlock";
import { OrigenCanalesNota } from "../ventas/OrigenCanalesNota";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const etiquetaMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`;

const DINERO = [
  "Facturado",
  "Entregado",
  "Pagado",
  "Por liquidar",
  "En curso",
  "Perdido",
  "Adelantos",
];

interface LineaResultado {
  clave: string;
  etiqueta: string;
  monto: number | null;
  signo: "+" | "−" | "=";
  nota?: string;
  estimado?: boolean;
  total?: boolean;
}

function lineas(er: EstadoResultados): LineaResultado[] {
  return [
    { clave: "venta", etiqueta: "Venta entregada", monto: er.ventaEntregada, signo: "+" },
    {
      clave: "costo",
      etiqueta: "Costo de producto",
      monto: er.costoProducto,
      signo: "−",
      nota:
        er.entregasSinCosto > 0
          ? `${formatNumber(er.entregasSinCosto)} entregas sin costo cargado: el costo real es mayor`
          : undefined,
    },
    {
      clave: "pauta_directa",
      etiqueta: "Publicidad directa",
      monto: er.publicidadDirecta,
      signo: "−",
    },
    {
      clave: "pauta_general",
      etiqueta: "Publicidad general (estimada)",
      monto: er.publicidadGeneralEstimada,
      signo: "−",
      estimado: true,
    },
    { clave: "envios", etiqueta: "Envíos (incluye retornos)", monto: er.envios, signo: "−" },
    { clave: "comisiones", etiqueta: "Comisiones y pasarela", monto: er.comisiones, signo: "−" },
    {
      clave: "ganancia",
      etiqueta: er.gananciaParcial ? "Ganancia (parcial, tope)" : "Ganancia",
      monto: er.ganancia,
      signo: "=",
      total: true,
    },
    {
      clave: "fijos",
      etiqueta: "Gastos fijos prorrateados",
      monto: er.gastosFijos,
      signo: "−",
      nota:
        er.gastosFijos === null
          ? "Pendiente: los gastos fijos no se reparten por canal, zona, turno ni asesora"
          : `${formatSoles(er.gastosFijosMensuales)} al mes (demo) × días ÷ 30`,
    },
    {
      clave: "utilidad",
      etiqueta: "Utilidad operativa",
      monto: er.utilidadOperativa,
      signo: "=",
      total: true,
    },
  ];
}

export function ResultadoSubtab() {
  const { view, openDrilldown } = usePanel();
  const state = usePanelContract(
    "finanzas-resultado",
    view.access === "permitido" ? view.query : null,
  );

  const columnasCanal: DataTableColumn<RentabilidadCanalFila>[] = [
    {
      id: "canal",
      header: "Canal",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver ventas de ${fila.canalNombre}`}
          onSelect={() => openDrilldown(grupos.ventasCanal(fila.canalId, fila.canalNombre))}
        >
          {fila.canalNombre}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.canalNombre,
      exportValue: (fila) => fila.canalNombre,
    },
    {
      id: "entregado",
      header: "Entregado",
      cell: (fila) => formatSoles(fila.entregado),
      sortValue: (fila) => fila.entregado,
      exportValue: (fila) => fila.entregado,
      exportFormat: "soles",
    },
    {
      id: "ganancia",
      header: "Ganancia",
      cell: (fila) =>
        fila.gananciaParcial ? (
          <span className="text-pc-text-muted" title="Tope: hay entregas sin costo cargado">
            ≤ {formatSoles(fila.ganancia)}
          </span>
        ) : (
          <b>{formatSoles(fila.ganancia)}</b>
        ),
      sortValue: (fila) => fila.ganancia,
      exportValue: (fila) => fila.ganancia,
      exportFormat: "soles",
    },
    {
      id: "margen",
      header: "Margen",
      cell: (fila) => formatPercent(fila.margen),
      sortValue: (fila) => fila.margen,
      exportValue: (fila) => fila.margen,
      exportFormat: "porcentaje",
    },
    {
      id: "retorno",
      header: "Retorno de publicidad",
      cell: (fila) => formatVeces(fila.retornoPublicidad),
      sortValue: (fila) => fila.retornoPublicidad,
      exportValue: (fila) => fila.retornoPublicidad,
      exportFormat: "numero",
    },
  ];

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <KpiRow
        state={state}
        labels={DINERO}
        titulo="Del facturado al dinero"
        className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7"
      >
        {(data, origin) => {
          const d = data.actual.facturadoAlDinero;
          const a = data.anterior_misma_antiguedad?.facturadoAlDinero;
          return [
            <KpiCard
              key="facturado"
              label="Facturado"
              glosario="venta"
              value={formatSoles(d.facturado)}
              origin={origin}
              delta={a ? calcularDelta(d.facturado, a.facturado) : undefined}
              onDrill={() => openDrilldown(grupos.ventas())}
            />,
            <KpiCard
              key="entregado"
              label="Entregado"
              glosario="efectividad_entrega"
              value={formatSoles(d.entregado)}
              origin={origin}
              delta={a ? calcularDelta(d.entregado, a.entregado) : undefined}
              onDrill={() => openDrilldown(grupos.entregados())}
            />,
            <KpiCard
              key="pagado"
              label="Pagado"
              glosario="pagado"
              value={formatSoles(d.pagado)}
              origin={origin}
              delta={a ? calcularDelta(d.pagado, a.pagado) : undefined}
              onDrill={() => openDrilldown(grupos.cobrado())}
            />,
            <KpiCard
              key="por_liquidar"
              label="Por liquidar"
              glosario="por_liquidar"
              value={formatSoles(d.porLiquidar)}
              origin={origin}
              sub={
                <span className={d.vencido ? "text-pc-bad" : undefined}>
                  {formatSoles(d.vencido)} vencido
                </span>
              }
              onDrill={() => openDrilldown(grupos.porLiquidar())}
            />,
            <KpiCard
              key="en_curso"
              label="En curso"
              value={formatSoles(d.enCurso)}
              origin={origin}
              sub="Aún no entregado ni cobrado"
              onDrill={() =>
                openDrilldown(
                  grupos.de("ventas", "En curso por cobrar", { estado_cobro: "en_curso" }),
                )
              }
            />,
            <KpiCard
              key="perdido"
              label="Perdido"
              glosario="perdido"
              value={formatSoles(d.perdido + d.reembolsado)}
              origin={origin}
              sub={`Rechazos ${formatSoles(d.perdido)} · reembolsos de prepago ${formatSoles(d.reembolsado)}`}
              onDrill={() => openDrilldown(grupos.rechazados())}
              drillLabel="Ver rechazados"
            />,
            <KpiCard
              key="adelantos"
              label="Adelantos"
              value={
                d.adelantosRecibidos === null ? "Pendiente" : formatSoles(d.adelantosRecibidos)
              }
              origin={origin}
              sub="Son caja, no ingreso: van fuera del estado de resultados. Falta registrar adelanto_monto y fecha_adelanto"
            />,
          ];
        }}
      </KpiRow>
      {state.data && (
        <p className="rounded-xl border border-pc-border bg-pc-card px-3 py-2 text-xs text-pc-text-muted">
          {(() => {
            const d = state.data.actual.facturadoAlDinero;
            const suma = d.pagado + d.porLiquidar + d.enCurso + d.perdido + d.reembolsado;
            const cuadra = Math.abs(suma - d.facturado) < 1;
            return (
              <>
                <b className={cuadra ? "text-pc-ok" : "text-pc-bad"}>
                  {cuadra ? "✓ Cuadra" : "✗ No cuadra"}
                </b>
                : Facturado {formatSoles(d.facturado)} = Pagado {formatSoles(d.pagado)} + Por
                liquidar {formatSoles(d.porLiquidar)} + En curso {formatSoles(d.enCurso)} + Perdido{" "}
                {formatSoles(d.perdido)} + Reembolsado {formatSoles(d.reembolsado)}. Todo por fecha
                de ingreso del pedido.
              </>
            );
          })()}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
        <ContractBlock
          state={state}
          titulo="Estado de resultados"
          subtitulo="Por fecha del pedido. La publicidad general es un reparto estimado; los adelantos no entran."
        >
          {(data) => {
            const er = data.actual.estadoResultados;
            const base = er.ventaEntregada;
            return (
              <table className="w-full border-collapse text-[12.5px]">
                <caption className="sr-only">Estado de resultados</caption>
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-pc-text-muted">
                    <th scope="col" className="py-1.5 text-left font-semibold">
                      Concepto
                    </th>
                    <th scope="col" className="py-1.5 text-right font-semibold">
                      S/
                    </th>
                    <th scope="col" className="py-1.5 text-right font-semibold">
                      % de lo entregado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineas(er).map((linea) => (
                    <tr
                      key={linea.clave}
                      className={cn(
                        "border-t border-pc-border-soft align-top",
                        linea.total && "bg-pc-surface-muted font-bold",
                      )}
                    >
                      <th scope="row" className="py-2 pl-1 text-left font-medium text-pc-text">
                        <span className={cn(linea.estimado && "italic text-pc-text-muted")}>
                          {linea.signo !== "=" && (
                            <span aria-hidden className="mr-1 text-pc-text-soft">
                              {linea.signo}
                            </span>
                          )}
                          {linea.etiqueta}
                        </span>
                        {linea.nota && (
                          <span className="block text-[11px] font-normal text-pc-warn">
                            {linea.nota}
                          </span>
                        )}
                      </th>
                      <td className="py-2 text-right tabular-nums">
                        {linea.monto === null ? (
                          <span className="text-pc-warn">Pendiente</span>
                        ) : linea.clave === "ganancia" && er.gananciaParcial ? (
                          `≤ ${formatSoles(linea.monto)}`
                        ) : (
                          formatSoles(linea.monto)
                        )}
                      </td>
                      <td className="py-2 pr-1 text-right tabular-nums text-pc-text-muted">
                        {linea.monto === null
                          ? SIN_DATO
                          : formatPercent(base ? linea.monto / base : null, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          }}
        </ContractBlock>
        <ContractBlock
          state={state}
          titulo="Punto de equilibrio"
          subtitulo="Entregas que cubren los gastos fijos del periodo con la ganancia por entrega actual"
        >
          {(data) => {
            const pe = data.actual.puntoEquilibrio;
            return (
              <div className="space-y-3 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-pc-text-muted">Ganancia por entrega</dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {formatSoles(pe.gananciaPorEntrega)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-pc-text-muted">Entregas necesarias</dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {pe.entregasNecesarias === null
                        ? "Pendiente"
                        : formatNumber(pe.entregasNecesarias)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-pc-text-muted">Entregas logradas</dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {formatNumber(pe.entregasLogradas)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-pc-text-muted">Margen de seguridad</dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {formatPercent(pe.margenSeguridad)}
                    </dd>
                  </div>
                </dl>
                {pe.entregasNecesarias !== null && (
                  <ProgressBar
                    logrado={pe.entregasLogradas}
                    meta={pe.entregasNecesarias}
                    etiqueta="Entregas logradas sobre el punto de equilibrio"
                  />
                )}
                <p className="text-xs text-pc-text-muted">
                  Cada rechazo cuesta en promedio {formatSoles(pe.fletePromedioPorRechazo)} de
                  flete.
                  {pe.entregasNecesarias === null &&
                    " Sin gastos fijos para estos filtros no se calcula el punto de equilibrio."}
                </p>
              </div>
            );
          }}
        </ContractBlock>
      </div>
      <ContractBlock
        state={state}
        titulo="Rentabilidad por canal"
        subtitulo="Ganancia por canal de origen con el mismo cálculo que el comparativo de canales"
      >
        {(data, origin) => (
          <DataTable
            caption="Rentabilidad por canal"
            columns={columnasCanal}
            rows={data.actual.rentabilidadPorCanal}
            getRowKey={(fila) => fila.canalId ?? "sin-canal"}
            exportar={{
              titulo: "Rentabilidad por canal",
              nombreBase: "rentabilidad_canal",
              origen: origin.kind,
            }}
          />
        )}
      </ContractBlock>
      <ContractBlock
        state={state}
        titulo="Evolución mensual"
        subtitulo="Últimos 6 meses por fecha de ingreso (no depende del periodo). El mes en curso está incompleto. Cada punto abre sus pedidos."
        skeleton="linea"
      >
        {(data) => {
          const meses = data.actual.evolucionMensual;
          const series = [
            { id: "facturado", nombre: "Facturado", color: "var(--pc-series-1)" },
            { id: "entregado", nombre: "Entregado", color: "var(--pc-series-3)" },
            { id: "pagado", nombre: "Pagado", color: "var(--pc-series-2)" },
          ] as const;
          return (
            <LineChart
              ariaLabel="Evolución mensual de facturado, entregado y pagado"
              etiquetas={meses.map((mes) => `${etiquetaMes(mes.mes)}${mes.enCurso ? "*" : ""}`)}
              series={series.map((serie) => ({
                ...serie,
                valores: meses.map((mes) => mes[serie.id]),
              }))}
              formatAxis={axisSoles}
              formatValue={formatSoles}
              height={240}
              width={1000}
              puntos={(serie, indice) => {
                const mes = meses[indice];
                if (!mes) return null;
                const desde = `${mes.mes}-01`;
                const extra: Record<string, string> =
                  serie.id === "entregado"
                    ? { operativo: "entregado" }
                    : serie.id === "pagado"
                      ? { estado_cobro: "pagado" }
                      : {};
                return {
                  accion: "Ver pedidos",
                  onSelect: () =>
                    openDrilldown(
                      grupos.rango(`${serie.nombre} · ${etiquetaMes(mes.mes)}`, {
                        desde,
                        hasta: endOfMonthKey(desde),
                        ...extra,
                      }),
                    ),
                };
              }}
            />
          );
        }}
      </ContractBlock>
    </div>
  );
}
