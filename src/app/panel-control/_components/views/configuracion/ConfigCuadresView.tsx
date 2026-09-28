"use client";

import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import type { CuadreResultado } from "@/features/panel-control/configuracion/models/configuracion.model";
import { SIN_CANAL } from "@/features/panel-control/detalle/models/detalle.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import {
  formatNumber,
  formatPercent,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";
import { ContractBlock, KpiRow } from "../ventas/ContractBlock";

const formatear = (fila: CuadreResultado, valor: number) =>
  fila.unidad === "soles" ? formatSoles(valor) : formatNumber(valor);

const COLUMNAS: DataTableColumn<CuadreResultado>[] = [
  {
    id: "estado",
    header: "",
    align: "left",
    cell: (fila) => (
      <span
        role="img"
        aria-label={fila.cuadra ? "Cuadra" : "No cuadra"}
        className={cn("font-bold", fila.cuadra ? "text-pc-ok" : "text-pc-bad")}
      >
        {fila.cuadra ? "✓" : "✗"}
      </span>
    ),
    sortValue: (fila) => (fila.cuadra ? 1 : 0),
    exportValue: (fila) => (fila.cuadra ? "✓" : "✗"),
  },
  {
    id: "cuadre",
    header: "Cuadre",
    align: "left",
    cell: (fila) => (
      <span className="whitespace-normal">
        {fila.descripcion}
        {fila.nota && <span className="block text-[11px] text-pc-warn">{fila.nota}</span>}
      </span>
    ),
    sortValue: (fila) => fila.descripcion,
    exportValue: (fila) => fila.descripcion,
  },
  {
    id: "valor",
    header: "Suma",
    cell: (fila) => formatear(fila, fila.valor),
    sortValue: (fila) => fila.valor,
    exportValue: (fila) => fila.valor,
    exportFormat: "numero",
  },
  {
    id: "total",
    header: "Total",
    cell: (fila) => formatear(fila, fila.total),
    sortValue: (fila) => fila.total,
    exportValue: (fila) => fila.total,
    exportFormat: "numero",
  },
  {
    id: "diferencia",
    header: "Diferencia",
    cell: (fila) => formatear(fila, fila.valor - fila.total),
    sortValue: (fila) => fila.valor - fila.total,
    exportValue: (fila) => fila.valor - fila.total,
    exportFormat: "numero",
  },
];

export function ConfigCuadresView() {
  const { view, openDrilldown } = usePanel();
  const state = usePanelContract("config-cuadres", view.access === "permitido" ? view.query : null);

  return (
    <div className="space-y-3.5">
      <KpiRow
        state={state}
        labels={[
          "Datos completos",
          "Anulaciones sin motivo",
          "Importados sin canal",
          "Ventas con producto sin costo",
        ]}
        titulo="Calidad de datos"
      >
        {(data, origin) => {
          const c = data.calidad;
          return [
            <KpiCard
              key="completo"
              label="Datos completos"
              value={formatPercent(c.porcentajeCompleto)}
              origin={origin}
              sub={`${formatNumber(c.pedidosRevisados)} pedidos del periodo revisados`}
            />,
            <KpiCard
              key="sin_motivo"
              label="Anulaciones sin motivo"
              value={formatNumber(c.anulacionesSinMotivo)}
              origin={origin}
              sub="El motivo es obligatorio; en datos históricos es un error de registro"
              onDrill={
                c.anulacionesSinMotivo
                  ? () =>
                      openDrilldown(
                        grupos.accion(
                          "anulaciones_sin_motivo",
                          "Anulaciones sin motivo",
                          "completar_motivo",
                        ),
                      )
                  : undefined
              }
              drillLabel="Completar motivo"
            />,
            <KpiCard
              key="sin_canal"
              label="Importados sin canal"
              value={formatNumber(c.importadosSinCanal)}
              origin={origin}
              sub="Sin canal de origen: no se atribuyen a ningún canal"
              onDrill={
                c.importadosSinCanal
                  ? () =>
                      openDrilldown(
                        grupos.de(
                          "pedidos",
                          "Pedidos sin canal",
                          { canal: SIN_CANAL },
                          "asignar_canal",
                        ),
                      )
                  : undefined
              }
              drillLabel="Asignar canal"
            />,
            <KpiCard
              key="sin_costo"
              label="Ventas con producto sin costo"
              value={formatNumber(c.ventasConProductoSinCosto)}
              origin={origin}
              sub={`${formatNumber(c.productosSinCosto.length)} productos sin costo cargado`}
              onDrill={
                c.ventasConProductoSinCosto
                  ? () =>
                      openDrilldown(grupos.de("ventas_sin_costo", "Ventas con productos sin costo"))
                  : undefined
              }
            />,
          ];
        }}
      </KpiRow>
      <ContractBlock
        state={state}
        titulo="Cuadres automáticos"
        subtitulo="Los 9 cuadres de §12 con los mismos filtros del panel. Todos deberían dar ✓; los que no, explican por qué."
      >
        {(data, origin) => (
          <DataTable
            caption="Cuadres automáticos"
            columns={COLUMNAS}
            rows={data.cuadres}
            getRowKey={(fila) => fila.id}
            exportar={{ titulo: "Cuadres", nombreBase: "cuadres", origen: origin.kind }}
          />
        )}
      </ContractBlock>
      <ContractBlock
        state={state}
        titulo="Productos a corregir"
        subtitulo="Del catálogo de la tienda filtrada"
      >
        {(data) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <section aria-label="Productos sin costo">
              <h4 className="mb-1 text-xs font-semibold">
                Sin costo cargado ({data.calidad.productosSinCosto.length})
              </h4>
              {data.calidad.productosSinCosto.length ? (
                <ul className="space-y-1 text-xs text-pc-text-muted">
                  {data.calidad.productosSinCosto.map((producto) => (
                    <li key={producto.productoId}>{producto.nombre}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-pc-text-muted">Ninguno.</p>
              )}
            </section>
            <section aria-label="Productos con stock negativo">
              <h4 className="mb-1 text-xs font-semibold">
                Stock negativo ({data.calidad.productosStockNegativo.length})
              </h4>
              {data.calidad.productosStockNegativo.length ? (
                <ul className="space-y-1 text-xs text-pc-bad">
                  {data.calidad.productosStockNegativo.map((producto) => (
                    <li key={producto.productoId}>
                      {producto.nombre}: {formatNumber(producto.stock)} (error de datos)
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-pc-text-muted">Ninguno.</p>
              )}
            </section>
          </div>
        )}
      </ContractBlock>
    </div>
  );
}
