"use client";

import { BarChart } from "@/components/panel-control/charts/BarChart";
import { HBarList } from "@/components/panel-control/charts/HBarList";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import type {
  CuponFila,
  ProductoFila,
} from "@/features/panel-control/productos/models/productos.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { axisSoles, seriesColor } from "@/features/panel-control/shared/utils/chart";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatDayKey,
  formatNumber,
  formatPercent,
  formatSoles,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";
import { CeldaDrill } from "./CeldaDrill";
import { ContractBlock, KpiRow } from "./ContractBlock";
import { OrigenCanalesNota } from "./OrigenCanalesNota";

const KPI_LABELS = [
  "Facturación neta",
  "Unidades",
  "Descuentos",
  "Upsell",
  "Anulados y rechazados",
];

export function ProductosSubtab() {
  const { view, openDrilldown } = usePanel();
  const state = usePanelContract("productos", view.access === "permitido" ? view.query : null);

  const columnasProductos: DataTableColumn<ProductoFila>[] = [
    {
      id: "producto",
      header: "Producto",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver ventas de ${fila.nombre}`}
          onSelect={() =>
            openDrilldown(
              grupos.de("ventas", `${fila.nombre} · ventas`, { producto: fila.productoId }),
            )
          }
        >
          <span className="truncate">{fila.nombre}</span>
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.nombre,
      exportValue: (fila) => fila.nombre,
    },
    {
      id: "sku",
      header: "SKU",
      align: "left",
      cell: (fila) => <span className="text-pc-text-muted">{fila.sku}</span>,
      sortValue: (fila) => fila.sku,
      exportValue: (fila) => fila.sku,
    },
    {
      id: "base",
      header: "Producto base",
      align: "left",
      cell: (fila) =>
        fila.variante ? (
          <span>
            {fila.productoBaseNombre} <span className="text-pc-text-muted">· {fila.variante}</span>
          </span>
        ) : (
          <span className="text-pc-text-muted">{SIN_DATO}</span>
        ),
      sortValue: (fila) => fila.productoBaseNombre,
      exportValue: (fila) =>
        fila.variante ? `${fila.productoBaseNombre} · ${fila.variante}` : null,
    },
    {
      id: "categoria",
      header: "Categoría",
      align: "left",
      cell: (fila) => fila.categoria ?? SIN_DATO,
      sortValue: (fila) => fila.categoria,
      exportValue: (fila) => fila.categoria,
    },
    {
      id: "unidades",
      header: "Unidades",
      cell: (fila) => formatNumber(fila.unidades),
      sortValue: (fila) => fila.unidades,
      exportValue: (fila) => fila.unidades,
      exportFormat: "numero",
    },
    {
      id: "facturacion",
      header: "Facturación neta",
      cell: (fila) => formatSoles(fila.facturacionNeta),
      sortValue: (fila) => fila.facturacionNeta,
      exportValue: (fila) => fila.facturacionNeta,
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
      id: "canal",
      header: "Canal principal",
      align: "left",
      cell: (fila) => fila.canalPrincipalNombre ?? "Sin canal",
      sortValue: (fila) => fila.canalPrincipalNombre,
      exportValue: (fila) => fila.canalPrincipalNombre ?? "Sin canal",
    },
    {
      id: "descuento",
      header: "Desc. prom.",
      cell: (fila) => formatPercent(fila.descuentoPromedio),
      sortValue: (fila) => fila.descuentoPromedio,
      exportValue: (fila) => fila.descuentoPromedio,
      exportFormat: "porcentaje",
    },
    {
      id: "costo",
      header: "Costo unit.",
      capability: "ver_costos",
      cell: (fila) =>
        fila.costoUnitario === null || fila.costoUnitario === undefined ? (
          <span className="text-pc-warn" title="Sin costo cargado">
            {SIN_DATO}
          </span>
        ) : (
          formatSoles(fila.costoUnitario)
        ),
      sortValue: (fila) => fila.costoUnitario ?? null,
      exportValue: (fila) => fila.costoUnitario ?? null,
      exportFormat: "soles",
    },
    {
      id: "margen",
      header: "Margen",
      capability: "ver_costos",
      cell: (fila) => formatPercent(fila.margen ?? null),
      sortValue: (fila) => fila.margen ?? null,
      exportValue: (fila) => fila.margen ?? null,
      exportFormat: "porcentaje",
    },
    {
      id: "rechazo",
      header: "Rechazo",
      cell: (fila) => formatPercent(fila.tasaRechazo),
      sortValue: (fila) => fila.tasaRechazo,
      exportValue: (fila) => fila.tasaRechazo,
      exportFormat: "porcentaje",
    },
    {
      id: "stock",
      header: "Stock",
      cell: (fila) => formatNumber(fila.stock),
      sortValue: (fila) => fila.stock,
      exportValue: (fila) => fila.stock,
      exportFormat: "numero",
    },
  ];

  const columnasCupones: DataTableColumn<CuponFila>[] = [
    {
      id: "cupon",
      header: "Cupón",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver ventas con el cupón ${fila.cupon}`}
          onSelect={() =>
            openDrilldown(grupos.de("ventas", `Cupón ${fila.cupon}`, { cupon: fila.cupon }))
          }
        >
          {fila.cupon}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.cupon,
      exportValue: (fila) => fila.cupon,
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
      id: "descuento",
      header: "Descuento",
      cell: (fila) => formatSoles(fila.descuento),
      sortValue: (fila) => fila.descuento,
      exportValue: (fila) => fila.descuento,
      exportFormat: "soles",
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
      id: "efectividad",
      header: "Efectividad",
      cell: (fila) => formatPercent(fila.efectividadEntrega),
      sortValue: (fila) => fila.efectividadEntrega,
      exportValue: (fila) => fila.efectividadEntrega,
      exportFormat: "porcentaje",
    },
  ];

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <KpiRow
        state={state}
        labels={KPI_LABELS}
        titulo="Indicadores de productos"
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {(data, origin) => {
          const k = data.actual.kpis;
          const a = data.anterior_misma_antiguedad?.kpis;
          return [
            <KpiCard
              key="facturacion"
              label="Facturación neta"
              glosario="venta"
              value={formatSoles(k.facturacionNeta)}
              origin={origin}
              delta={a ? calcularDelta(k.facturacionNeta, a.facturacionNeta) : undefined}
              sub={`${formatNumber(k.ventas)} ventas · ticket ${formatSoles(k.ticket)}`}
              onDrill={() => openDrilldown(grupos.ventas())}
            />,
            <KpiCard
              key="unidades"
              label="Unidades"
              value={formatNumber(k.unidades)}
              origin={origin}
              delta={a ? calcularDelta(k.unidades, a.unidades) : undefined}
              sub={`${k.unidadesPorVenta === null ? SIN_DATO : k.unidadesPorVenta.toFixed(2)} unidades por venta`}
              onDrill={() => openDrilldown(grupos.ventas())}
            />,
            <KpiCard
              key="descuentos"
              label="Descuentos"
              value={formatSoles(k.descuentos)}
              origin={origin}
              delta={a ? calcularDelta(k.descuentos, a.descuentos, "menos_es_mejor") : undefined}
              sub={`${formatPercent(k.descuentoSobreLista, 1)} sobre el precio de lista`}
            />,
            <KpiCard
              key="upsell"
              label="Upsell"
              value={formatSoles(k.upsell)}
              origin={origin}
              delta={a ? calcularDelta(k.upsell, a.upsell) : undefined}
              sub={`${formatNumber(k.ventasConUpsell)} ventas con producto adicional`}
              onDrill={() => openDrilldown(grupos.de("con_upsell", "Ventas con upsell"))}
            />,
            <KpiCard
              key="perdidos"
              label="Anulados y rechazados"
              glosario="perdido"
              value={formatNumber(k.anuladosMasRechazados)}
              origin={origin}
              delta={
                a
                  ? calcularDelta(
                      k.anuladosMasRechazados,
                      a.anuladosMasRechazados,
                      "menos_es_mejor",
                    )
                  : undefined
              }
              sub={`${formatPercent(k.tasaPerdida)} de ${formatNumber(k.ingresados)} pedidos ingresados`}
              onDrill={() =>
                openDrilldown(grupos.de("anulados_rechazados", "Anulados y rechazados"))
              }
            />,
          ];
        }}
      </KpiRow>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[2fr_1fr]">
        <ContractBlock
          state={state}
          titulo="Ventas diarias"
          subtitulo="Facturación neta por día de ingreso (hora Lima). Clic o Enter abre los pedidos del día."
          skeleton="grafico"
        >
          {(data) => {
            const dias = data.actual.ventasDiarias;
            const conComparacion =
              dias.some((dia) => dia.facturacionAnterior !== null) && dias.length > 1;
            return (
              <BarChart
                ariaLabel="Ventas diarias de productos"
                formatAxis={axisSoles}
                height={240}
                width={620}
                data={dias.map((dia) => ({
                  key: dia.dia,
                  label: dias.length > 2 ? String(Number(dia.dia.slice(8))) : formatDayKey(dia.dia),
                  value: dia.facturacion,
                  comparison: conComparacion ? dia.facturacionAnterior : null,
                  description: `${formatDayKey(dia.dia)}: ${formatSoles(dia.facturacion)} · ${formatNumber(dia.ventas)} ventas`,
                  onSelect: () => openDrilldown(grupos.ventasDia(dia.dia)),
                }))}
              />
            );
          }}
        </ContractBlock>
        <ContractBlock
          state={state}
          titulo="Facturación por categoría"
          subtitulo="Precio neto de cada ítem vendido"
        >
          {(data) => (
            <HBarList
              ariaLabel="Facturación por categoría"
              formatValue={formatSoles}
              rows={data.actual.categorias.map((fila, index) => ({
                key: fila.categoria,
                label: fila.categoria,
                value: fila.facturacionNeta,
                barColor: seriesColor(index),
                dotColor: seriesColor(index),
                onSelect: () =>
                  openDrilldown(
                    grupos.de("ventas", `${fila.categoria} · ventas`, {
                      categoria: fila.categoria,
                    }),
                  ),
              }))}
            />
          )}
        </ContractBlock>
      </div>
      <ContractBlock
        state={state}
        titulo="Productos vendidos"
        subtitulo="Cada variante es un producto propio con su SKU; «Producto base» indica de cuál deriva."
      >
        {(data, origin) => (
          <div className="space-y-2">
            <DataTable
              caption="Productos vendidos"
              columns={columnasProductos}
              rows={data.actual.productos}
              getRowKey={(fila) => fila.productoId}
              exportar={{
                titulo: "Productos vendidos",
                nombreBase: "productos",
                origen: origin.kind,
              }}
              emptyMessage="Sin productos vendidos con estos filtros"
              maxHeight={520}
            />
            {data.actual.productos.some((fila) => fila.costoUnitario === null) && (
              <p role="note" className="text-xs text-pc-text-muted">
                Productos sin costo cargado muestran margen «{SIN_DATO}»: no se asume 0 % ni 100 %.
              </p>
            )}
          </div>
        )}
      </ContractBlock>
      <ContractBlock
        state={state}
        titulo="Cupones"
        subtitulo="Ventas que usaron cada cupón y el descuento que entregó"
      >
        {(data, origin) => (
          <DataTable
            caption="Cupones usados"
            columns={columnasCupones}
            rows={data.actual.cupones}
            getRowKey={(fila) => fila.cupon}
            exportar={{ titulo: "Cupones", nombreBase: "cupones", origen: origin.kind }}
            emptyMessage="Ninguna venta usó cupón en el periodo"
          />
        )}
      </ContractBlock>
    </div>
  );
}
