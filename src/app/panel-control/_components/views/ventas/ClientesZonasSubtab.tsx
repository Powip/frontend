"use client";

import { HBarList } from "@/components/panel-control/charts/HBarList";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import type {
  DepartamentoFila,
  MejorClienteFila,
} from "@/features/panel-control/clientes-zonas/models/clientes-zonas.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { ZONA_LABEL } from "@/features/panel-control/shared/config/filter-labels.config";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { seriesColor } from "@/features/panel-control/shared/utils/chart";
import {
  formatDayKeyWithYear,
  formatNumber,
  formatPercent,
  formatSoles,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";
import { CeldaDrill } from "./CeldaDrill";
import { ContractBlock, KpiRow } from "./ContractBlock";
import { OrigenCanalesNota } from "./OrigenCanalesNota";

const KPI_LABELS = [
  "Clientes con compra",
  "Nuevos",
  "Recurrentes",
  "Recompra",
  "Valor histórico por cliente",
  "Lista negra",
];

const SIN_HISTORIAL = "Pendiente: requiere el historial de compras por cliente";

export function ClientesZonasSubtab() {
  const { view, openDrilldown } = usePanel();
  const state = usePanelContract("clientes-zonas", view.access === "permitido" ? view.query : null);

  const columnasDepartamentos: DataTableColumn<DepartamentoFila>[] = [
    {
      id: "departamento",
      header: "Departamento",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver ventas en ${fila.departamento}`}
          onSelect={() =>
            openDrilldown(
              grupos.de("ventas", `${fila.departamento} · ventas`, {
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
      id: "zona",
      header: "Zona",
      align: "left",
      cell: (fila) => ZONA_LABEL[fila.zona],
      sortValue: (fila) => fila.zona,
      exportValue: (fila) => ZONA_LABEL[fila.zona],
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
      id: "participacion",
      header: "Part.",
      cell: (fila) => formatPercent(fila.participacion),
      sortValue: (fila) => fila.participacion,
      exportValue: (fila) => fila.participacion,
      exportFormat: "porcentaje",
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
      id: "efectividad",
      header: "Efectividad",
      cell: (fila) => formatPercent(fila.efectividadEntrega),
      sortValue: (fila) => fila.efectividadEntrega,
      exportValue: (fila) => fila.efectividadEntrega,
      exportFormat: "porcentaje",
    },
  ];

  const columnasClientes: DataTableColumn<MejorClienteFila>[] = [
    {
      id: "cliente",
      header: "Cliente",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver historial de compras de ${fila.nombre}`}
          onSelect={() => openDrilldown(grupos.historialCliente(fila.clienteId, fila.nombre))}
        >
          {fila.nombre}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.nombre,
      exportValue: (fila) => fila.nombre,
    },
    {
      id: "departamento",
      header: "Departamento",
      align: "left",
      cell: (fila) => fila.departamento ?? SIN_DATO,
      sortValue: (fila) => fila.departamento,
      exportValue: (fila) => fila.departamento,
    },
    {
      id: "pedidos",
      header: "Pedidos",
      cell: (fila) => formatNumber(fila.pedidos),
      sortValue: (fila) => fila.pedidos,
      exportValue: (fila) => fila.pedidos,
      exportFormat: "numero",
    },
    {
      id: "entregado",
      header: "Entregado histórico",
      cell: (fila) => formatSoles(fila.entregado),
      sortValue: (fila) => fila.entregado,
      exportValue: (fila) => fila.entregado,
      exportFormat: "soles",
    },
    {
      id: "rechazos",
      header: "Rechazos",
      cell: (fila) =>
        fila.rechazosPrevios > 0 ? (
          <span className="text-pc-bad">{formatNumber(fila.rechazosPrevios)}</span>
        ) : (
          formatNumber(0)
        ),
      sortValue: (fila) => fila.rechazosPrevios,
      exportValue: (fila) => fila.rechazosPrevios,
      exportFormat: "numero",
    },
  ];

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <KpiRow
        state={state}
        labels={KPI_LABELS}
        titulo="Indicadores de clientes"
        className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6"
      >
        {(data, origin) => {
          const { kpis, historial } = data.actual;
          const pendiente = (valor: number | null) => !historial.disponible && valor === null;
          const desde = historial.desde
            ? `Historial desde ${formatDayKeyWithYear(historial.desde)}`
            : null;
          return [
            <KpiCard
              key="con_compra"
              label="Clientes con compra"
              value={formatNumber(kpis.conCompra)}
              origin={origin}
              sub={`Efectividad de entrega ${formatPercent(kpis.efectividadTotal)}`}
              onDrill={() => openDrilldown(grupos.ventas())}
            />,
            <KpiCard
              key="nuevos"
              label="Nuevos"
              value={pendiente(kpis.nuevos) ? "Pendiente" : formatNumber(kpis.nuevos)}
              origin={origin}
              sub={pendiente(kpis.nuevos) ? SIN_HISTORIAL : "Primera compra dentro del periodo"}
              onDrill={
                pendiente(kpis.nuevos) ? undefined : () => openDrilldown(grupos.clientesNuevos())
              }
            />,
            <KpiCard
              key="recurrentes"
              label="Recurrentes"
              value={pendiente(kpis.recurrentes) ? "Pendiente" : formatNumber(kpis.recurrentes)}
              origin={origin}
              sub={
                pendiente(kpis.recurrentes) ? SIN_HISTORIAL : "Ya habían comprado antes del periodo"
              }
              onDrill={
                pendiente(kpis.recurrentes)
                  ? undefined
                  : () => openDrilldown(grupos.de("recurrentes", "Clientes recurrentes"))
              }
            />,
            <KpiCard
              key="recompra"
              label="Recompra"
              value={pendiente(kpis.recompra) ? "Pendiente" : formatPercent(kpis.recompra)}
              origin={origin}
              sub={
                pendiente(kpis.recompra)
                  ? SIN_HISTORIAL
                  : `Clientes del periodo con más de una compra en su historial${desde ? `. ${desde}` : ""}`
              }
            />,
            <KpiCard
              key="valor"
              label="Valor histórico por cliente"
              value={
                pendiente(kpis.valorHistoricoPorCliente)
                  ? "Pendiente"
                  : formatSoles(kpis.valorHistoricoPorCliente)
              }
              origin={origin}
              sub={
                pendiente(kpis.valorHistoricoPorCliente)
                  ? SIN_HISTORIAL
                  : "Entregado acumulado por cliente del periodo"
              }
            />,
            <KpiCard
              key="lista_negra"
              label="Lista negra"
              value={
                pendiente(kpis.listaNegraPedidos)
                  ? "Pendiente"
                  : formatNumber(kpis.listaNegraPedidos)
              }
              origin={origin}
              sub={
                pendiente(kpis.listaNegraPedidos)
                  ? SIN_HISTORIAL
                  : `Ventas a clientes con rechazos previos · efectividad ${formatPercent(kpis.efectividadListaNegra)} (total ${formatPercent(kpis.efectividadTotal)})`
              }
              onDrill={
                pendiente(kpis.listaNegraPedidos)
                  ? undefined
                  : () => openDrilldown(grupos.listaNegra())
              }
            />,
          ];
        }}
      </KpiRow>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ContractBlock
          state={state}
          titulo="Lima y provincia"
          subtitulo="Facturación por zona de entrega"
        >
          {(data) => (
            <div className="space-y-2">
              <HBarList
                ariaLabel="Facturación por zona"
                formatValue={formatSoles}
                rows={data.actual.zonas.map((fila, index) => ({
                  key: fila.zona,
                  label: `${ZONA_LABEL[fila.zona]} · ${formatNumber(fila.ventas)}`,
                  value: fila.facturacion,
                  dotColor: seriesColor(index),
                  barColor: seriesColor(index),
                  description: `${ZONA_LABEL[fila.zona]}: ${formatSoles(fila.facturacion)} · ${formatNumber(fila.ventas)} ventas · ticket ${formatSoles(fila.ticket)} · efectividad ${formatPercent(fila.efectividadEntrega)}`,
                  onSelect: () =>
                    openDrilldown(
                      grupos.de("ventas", `${ZONA_LABEL[fila.zona]} · ventas`, { zona: fila.zona }),
                    ),
                }))}
              />
              <p className="text-xs text-pc-text-muted">
                {data.actual.zonas
                  .map(
                    (fila) =>
                      `${ZONA_LABEL[fila.zona]}: ticket ${formatSoles(fila.ticket)}, efectividad ${formatPercent(fila.efectividadEntrega)}`,
                  )
                  .join(" · ")}
              </p>
            </div>
          )}
        </ContractBlock>
        <ContractBlock
          state={state}
          titulo="Métodos de pago"
          subtitulo="Facturación según cómo pagó el cliente"
        >
          {(data) => (
            <HBarList
              ariaLabel="Facturación por método de pago"
              formatValue={formatSoles}
              rows={data.actual.metodosPago.map((fila, index) => ({
                key: fila.metodo,
                label: `${fila.metodo} · ${formatNumber(fila.pedidos)}`,
                value: fila.facturacion,
                dotColor: seriesColor(index),
                barColor: seriesColor(index),
                description: `${fila.metodo}: ${formatSoles(fila.facturacion)} · ${formatNumber(fila.pedidos)} pedidos`,
                onSelect: () =>
                  openDrilldown(
                    grupos.de("ventas", `${fila.metodo} · ventas`, { metodo: fila.metodo }),
                  ),
              }))}
            />
          )}
        </ContractBlock>
      </div>
      <ContractBlock
        state={state}
        titulo="Departamentos"
        subtitulo="Ventas por departamento de entrega"
      >
        {(data, origin) => (
          <DataTable
            caption="Ventas por departamento"
            columns={columnasDepartamentos}
            rows={data.actual.departamentos}
            getRowKey={(fila) => fila.departamento}
            exportar={{
              titulo: "Ventas por departamento",
              nombreBase: "departamentos",
              origen: origin.kind,
            }}
            emptyMessage="Sin ventas con estos filtros"
            maxHeight={480}
          />
        )}
      </ContractBlock>
      <ContractBlock
        state={state}
        titulo="Mejores clientes"
        subtitulo="Clientes del periodo ordenados por lo entregado en todo su historial"
      >
        {(data, origin) =>
          data.actual.mejoresClientes === null ? (
            <p
              role="note"
              className="rounded-lg bg-pc-surface-muted px-3 py-2 text-xs text-pc-text-muted"
            >
              {SIN_HISTORIAL}. No se calcula con los pedidos del periodo porque mostraría un
              historial incompleto.
            </p>
          ) : (
            <DataTable
              caption="Mejores clientes"
              columns={columnasClientes}
              rows={data.actual.mejoresClientes}
              getRowKey={(fila) => fila.clienteId}
              exportar={{
                titulo: "Mejores clientes",
                nombreBase: "mejores_clientes",
                origen: origin.kind,
              }}
              emptyMessage="Sin clientes con compra en el periodo"
            />
          )
        }
      </ContractBlock>
    </div>
  );
}
