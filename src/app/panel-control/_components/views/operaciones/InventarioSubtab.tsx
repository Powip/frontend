"use client";

import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import {
  ESTADO_STOCK_LABEL,
  type EstadoStock,
  type InventarioFila,
} from "@/features/panel-control/operaciones/models/inventario.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import {
  formatNumber,
  formatSoles,
  formatSolesDecimales,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";
import { ContractBlock, KpiRow } from "../ventas/ContractBlock";
import { OrigenCanalesNota } from "../ventas/OrigenCanalesNota";

const TONO_STOCK: Record<EstadoStock, string> = {
  error_datos: "bg-pc-bad-soft text-pc-bad",
  agotado: "bg-pc-bad-soft text-pc-bad",
  critico: "bg-pc-bad-soft text-pc-bad",
  bajo: "bg-pc-warn-soft text-pc-warn",
  ok: "bg-pc-ok-soft text-pc-ok",
  sobrestock: "bg-pc-info-soft text-pc-info",
};

const ORDEN_ESTADO: Record<EstadoStock, number> = {
  error_datos: 0,
  agotado: 1,
  critico: 2,
  bajo: 3,
  ok: 4,
  sobrestock: 5,
};

export function InventarioSubtab() {
  const { view, openDrilldown } = usePanel();
  const { tiendaNombre } = usePanelOptions();
  const verCostos = view.access === "permitido" && view.capabilities.has("ver_costos");
  const state = usePanelContract(
    "operaciones-inventario",
    view.access === "permitido" ? view.query : null,
  );
  const labels = [
    "Productos",
    ...(verCostos ? ["Valor al costo"] : []),
    "Agotados",
    "Críticos",
    "Error de datos",
    "Ventas esperando stock",
  ];

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <KpiRow
        state={state}
        labels={labels}
        titulo="Indicadores de inventario"
        className={
          verCostos
            ? "grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6"
            : "grid grid-cols-2 gap-3 lg:grid-cols-5"
        }
      >
        {(data, origin) => {
          const k = data.actual.kpis;
          return [
            <KpiCard
              key="productos"
              label="Productos"
              value={formatNumber(k.productos)}
              origin={origin}
              sub={`${formatNumber(k.sinCosto)} sin costo cargado`}
            />,
            ...(k.valorAlCosto !== undefined
              ? [
                  <KpiCard
                    key="valor"
                    label="Valor al costo"
                    value={formatSoles(k.valorAlCosto)}
                    origin={origin}
                    sub="Stock × costo unitario; sin costo o con error de datos no suma"
                  />,
                ]
              : []),
            <KpiCard
              key="agotados"
              label="Agotados"
              value={<span className="text-pc-bad">{formatNumber(k.agotados)}</span>}
              origin={origin}
              sub="Disponible ≤ 0 con stock válido"
            />,
            <KpiCard
              key="criticos"
              label="Críticos"
              glosario="cobertura_stock"
              value={formatNumber(k.criticos)}
              origin={origin}
              sub="Menos de 7 días de cobertura"
            />,
            <KpiCard
              key="errores"
              label="Error de datos"
              value={
                <span className={k.erroresDatos ? "text-pc-bad" : ""}>
                  {formatNumber(k.erroresDatos)}
                </span>
              }
              origin={origin}
              sub="Stock negativo: se corrige en el inventario, no es «Agotado»"
            />,
            <KpiCard
              key="esperando"
              label="Ventas esperando stock"
              value={formatNumber(k.ventasEsperandoStock)}
              origin={origin}
              sub="LLAMADO o PREPARADO con un producto en stock 0 · estado actual"
              onDrill={() =>
                openDrilldown(
                  grupos.accion(
                    "productos_agotados",
                    "Ventas con productos agotados",
                    "avisar_cliente",
                  ),
                )
              }
              drillLabel="Avisar al cliente"
            />,
          ];
        }}
      </KpiRow>
      <ContractBlock
        state={state}
        titulo="Stock y cobertura"
        subtitulo="Un solo inventario para todos los canales: respeta el filtro de tienda, no los de canal o zona. Disponible = stock − reservado (LLAMADO, PREPARADO y CON_GUIA). Cobertura = disponible ÷ venta diaria de los últimos 30 días."
      >
        {(data, origin) => {
          const variasTiendas =
            new Set(data.actual.productos.map((fila) => fila.tiendaId)).size > 1;
          const columnas: DataTableColumn<InventarioFila>[] = [
            {
              id: "producto",
              header: "Producto",
              align: "left",
              cell: (fila) => (
                <span
                  className="inline-block max-w-[220px] truncate font-medium"
                  title={fila.nombre}
                >
                  {fila.nombre}
                </span>
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
            ...(variasTiendas
              ? [
                  {
                    id: "tienda",
                    header: "Tienda",
                    align: "left",
                    cell: (fila) => tiendaNombre(fila.tiendaId) ?? fila.tiendaId,
                    sortValue: (fila) => tiendaNombre(fila.tiendaId) ?? fila.tiendaId,
                    exportValue: (fila) => tiendaNombre(fila.tiendaId) ?? fila.tiendaId,
                  } satisfies DataTableColumn<InventarioFila>,
                ]
              : []),
            {
              id: "stock",
              header: "Stock",
              cell: (fila) => (
                <span className={cn(fila.stock < 0 && "font-bold text-pc-bad")}>
                  {formatNumber(fila.stock)}
                </span>
              ),
              sortValue: (fila) => fila.stock,
              exportValue: (fila) => fila.stock,
              exportFormat: "numero",
            },
            {
              id: "reservado",
              header: "Reservado",
              cell: (fila) =>
                fila.reservado === null ? (
                  <span className="text-pc-warn">Pendiente</span>
                ) : fila.reservado > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      openDrilldown(
                        grupos.actual("reservados", `${fila.nombre} · reservado`, {
                          producto: fila.productoId,
                        }),
                      )
                    }
                    aria-label={`Ver pedidos que reservan ${formatNumber(fila.reservado)} unidades de ${fila.nombre}`}
                    className="rounded font-semibold tabular-nums text-pc-primary underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
                  >
                    {formatNumber(fila.reservado)}
                  </button>
                ) : (
                  "0"
                ),
              sortValue: (fila) => fila.reservado,
              exportValue: (fila) => fila.reservado,
              exportFormat: "numero",
            },
            {
              id: "disponible",
              header: "Disponible",
              cell: (fila) => formatNumber(fila.disponible),
              sortValue: (fila) => fila.disponible,
              exportValue: (fila) => fila.disponible,
              exportFormat: "numero",
            },
            {
              id: "venta",
              header: "Venta diaria",
              cell: (fila) => (fila.ventaDiaria === null ? SIN_DATO : fila.ventaDiaria.toFixed(1)),
              sortValue: (fila) => fila.ventaDiaria,
              exportValue: (fila) => fila.ventaDiaria,
              exportFormat: "numero",
            },
            {
              id: "cobertura",
              header: "Cobertura",
              cell: (fila) =>
                fila.coberturaDias === null ? SIN_DATO : `${Math.floor(fila.coberturaDias)} días`,
              sortValue: (fila) => fila.coberturaDias,
              exportValue: (fila) => fila.coberturaDias,
              exportFormat: "numero",
            },
            {
              id: "estado",
              header: "Estado",
              align: "left",
              cell: (fila) => (
                <span
                  className={cn(
                    "whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold",
                    TONO_STOCK[fila.estado],
                  )}
                >
                  {ESTADO_STOCK_LABEL[fila.estado]}
                </span>
              ),
              sortValue: (fila) => ORDEN_ESTADO[fila.estado],
              exportValue: (fila) => ESTADO_STOCK_LABEL[fila.estado],
            },
            {
              id: "costo",
              header: "Costo unit.",
              capability: "ver_costos",
              cell: (fila) => formatSolesDecimales(fila.costoUnitario ?? null),
              sortValue: (fila) => fila.costoUnitario ?? null,
              exportValue: (fila) => fila.costoUnitario ?? null,
              exportFormat: "soles",
            },
            {
              id: "valor",
              header: "Valor",
              capability: "ver_costos",
              cell: (fila) => formatSoles(fila.valor ?? null),
              sortValue: (fila) => fila.valor ?? null,
              exportValue: (fila) => fila.valor ?? null,
              exportFormat: "soles",
            },
          ];
          return (
            <div className="space-y-2">
              <DataTable
                caption="Stock y cobertura"
                columns={columnas}
                rows={data.actual.productos}
                getRowKey={(fila) => fila.productoId}
                exportar={{ titulo: "Inventario", nombreBase: "inventario", origen: origin.kind }}
                emptyMessage="Sin productos para esta tienda"
                maxHeight={560}
              />
              {data.actual.kpis.erroresDatos > 0 && (
                <p role="note" className="text-xs text-pc-bad">
                  {data.actual.kpis.erroresDatos === 1
                    ? "1 producto con stock negativo"
                    : `${formatNumber(data.actual.kpis.erroresDatos)} productos con stock negativo`}
                  : es un error de datos, no un producto agotado. No se calcula su cobertura ni su
                  valor.
                </p>
              )}
            </div>
          );
        }}
      </ContractBlock>
    </div>
  );
}
