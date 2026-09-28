"use client";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ACCION_PEDIDO_LABEL } from "@/features/panel-control/acciones/models/accion-pedido.model";
import {
  DETALLE_TAMANO_PAGINA,
  type DetallePedidoFila,
  type DetalleProductoFila,
  type DetalleQuery,
  type DetalleVista,
} from "@/features/panel-control/detalle/models/detalle.model";
import { textoAlcance } from "@/features/panel-control/detalle/utils/alcance-grupo";
import { exportTable } from "@/features/panel-control/exportacion/services/export-table.service";
import { ESTADOS_PANEL_DEFINICION } from "@/features/panel-control/shared/config/estados.config";
import {
  usePanelContract,
  usePanelContractFetcher,
} from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanelExportMeta } from "@/features/panel-control/shared/hooks/use-panel-export-meta";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import {
  formatDayKey,
  formatNumber,
  formatPercent,
  formatSoles,
  formatSolesDecimales,
} from "@/features/panel-control/shared/utils/format";
import { ContractView } from "./ContractView";
import { HBarList } from "./charts/HBarList";
import { DataOriginBadge } from "./DataOriginBadge";
import { DataTable, type DataTableColumn } from "./DataTable";
import { EstadoBadge } from "./EstadoBadge";
import { notifyPendingIntegration } from "./pending-integration";
import { SegmentedControl } from "./SegmentedControl";

const VISTAS: { value: DetalleVista; label: string }[] = [
  { value: "pedidos", label: "Pedidos" },
  { value: "producto", label: "Por producto" },
  { value: "estado", label: "Por estado" },
];

const TAMANO_EXPORTACION = 500;

function horaLima(iso: string): string {
  return `${formatDayKey(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
}

export function DetailDrawer() {
  const { drilldown, closeDrilldown, view } = usePanel();
  const exportMeta = usePanelExportMeta();
  const busquedaId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [vista, setVista] = useState<DetalleVista>("pedidos");
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    if (!drilldown) return;
    setVista("pedidos");
    setPagina(1);
    setBusqueda("");
    setBusquedaAplicada("");
  }, [drilldown]);

  useEffect(() => {
    const termino = busqueda.trim();
    if (termino === busquedaAplicada) return;
    const timer = setTimeout(() => {
      setBusquedaAplicada(termino);
      setPagina(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, busquedaAplicada]);

  const baseQuery = useMemo<Omit<DetalleQuery, "pagina" | "tamano_pagina"> | null>(() => {
    if (!drilldown || view.access !== "permitido") return null;
    return {
      ...view.query,
      grupo: drilldown.tipo,
      grupo_params: JSON.stringify(drilldown.params),
      ...(busquedaAplicada ? { buscar: busquedaAplicada } : {}),
    };
  }, [drilldown, view, busquedaAplicada]);

  const query = useMemo<DetalleQuery | null>(
    () => (baseQuery ? { ...baseQuery, pagina, tamano_pagina: DETALLE_TAMANO_PAGINA } : null),
    [baseQuery, pagina],
  );

  const detalle = usePanelContract("detalle", query);
  const fetcher = usePanelContractFetcher("detalle");
  const accion = drilldown?.accion ?? null;
  const porFechaDelDinero = drilldown?.alcance === "caja";
  const alcance = textoAlcance(drilldown, exportMeta.periodo);
  const periodoTexto = alcance.periodo;

  const pedidoColumns = useMemo<DataTableColumn<DetallePedidoFila>[]>(() => {
    const columns: DataTableColumn<DetallePedidoFila>[] = [
      {
        id: "pedido",
        header: "Pedido",
        align: "left",
        cell: (row) => (
          <span className="font-semibold">
            {row.numero}
            {row.listaNegra && (
              <span
                className="ml-1 rounded bg-pc-bad-soft px-1 text-[10px] text-pc-bad"
                title="Cliente con rechazos previos"
              >
                ⚑<span className="sr-only"> Cliente con rechazos previos</span>
              </span>
            )}
          </span>
        ),
        sortValue: (row) => row.numero,
        exportValue: (row) => row.numero,
      },
      {
        id: "ingreso",
        header: "Ingreso",
        align: "left",
        cell: (row) => <span className="text-pc-text-muted">{horaLima(row.ingreso)}</span>,
        sortValue: (row) => row.ingreso,
        exportValue: (row) => row.ingreso,
      },
      {
        id: "canal",
        header: "Canal de origen",
        align: "left",
        cell: (row) =>
          row.canalOrigenNombre ?? <span className="text-pc-text-soft">Sin canal</span>,
        sortValue: (row) => row.canalOrigenNombre,
        exportValue: (row) => row.canalOrigenNombre ?? "Sin canal",
      },
      {
        id: "cierre",
        header: "Cerrado por",
        align: "left",
        cell: (row) => row.canalCierreNombre ?? <span className="text-pc-text-soft">—</span>,
        sortValue: (row) => row.canalCierreNombre,
        exportValue: (row) => row.canalCierreNombre,
      },
      {
        id: "cliente",
        header: "Cliente",
        align: "left",
        cell: (row) => (
          <>
            {row.cliente}
            {row.departamento && <span className="text-pc-text-soft"> · {row.departamento}</span>}
          </>
        ),
        sortValue: (row) => row.cliente,
        exportValue: (row) => row.cliente,
      },
      {
        id: "asesor",
        header: "Asesor(a)",
        align: "left",
        cell: (row) => row.asesor ?? <span className="text-pc-text-soft">Automático</span>,
        sortValue: (row) => row.asesor,
        exportValue: (row) => row.asesor ?? "Automático",
      },
      {
        id: "estado",
        header: "Estado",
        align: "left",
        cell: (row) => (
          <span className="inline-flex items-center gap-1">
            <EstadoBadge estado={row.estado} />
            {row.vencido && (
              <span className="rounded-md bg-pc-bad-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-pc-bad">
                vencido
              </span>
            )}
          </span>
        ),
        sortValue: (row) => ESTADOS_PANEL_DEFINICION[row.estado].etiqueta,
        exportValue: (row) => ESTADOS_PANEL_DEFINICION[row.estado].etiqueta,
      },
      {
        id: "motivo",
        header: "Motivo",
        align: "left",
        cell: (row) => <span className="text-pc-text-muted">{row.motivo ?? ""}</span>,
        sortValue: (row) => row.motivo,
        exportValue: (row) => row.motivo,
      },
      {
        id: "neto",
        header: "Neto",
        cell: (row) => formatSoles(row.neto),
        sortValue: (row) => row.neto,
        exportValue: (row) => row.neto,
        exportFormat: "soles",
      },
    ];
    if (porFechaDelDinero) {
      columns.push(
        {
          id: "fecha_dinero",
          header: "Fecha del dinero",
          align: "left",
          cell: (row) => (row.movimientoFecha ? horaLima(row.movimientoFecha) : "—"),
          sortValue: (row) => row.movimientoFecha ?? null,
          exportValue: (row) => row.movimientoFecha ?? null,
        },
        {
          id: "monto_caja",
          header: "Movido en caja",
          cell: (row) => formatSoles(row.movimientoMonto ?? null),
          sortValue: (row) => row.movimientoMonto ?? null,
          exportValue: (row) => row.movimientoMonto ?? null,
          exportFormat: "soles",
        },
      );
    }
    if (accion) {
      columns.push({
        id: "accion",
        header: "Acción",
        cell: (row) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            aria-label={`${ACCION_PEDIDO_LABEL[accion]} ${row.numero}: pendiente de integración`}
            onClick={() =>
              notifyPendingIntegration(
                `${ACCION_PEDIDO_LABEL[accion]} · ${row.numero}`,
                "acciones-pedido",
              )
            }
          >
            {ACCION_PEDIDO_LABEL[accion]}
            <span className="text-[10px] font-normal text-pc-text-soft">(pendiente)</span>
          </Button>
        ),
      });
    }
    return columns;
  }, [accion, porFechaDelDinero]);

  const productoColumns: DataTableColumn<DetalleProductoFila>[] = [
    {
      id: "producto",
      header: "Producto",
      align: "left",
      cell: (row) => row.nombre,
      sortValue: (row) => row.nombre,
      exportValue: (row) => row.nombre,
    },
    {
      id: "unidades",
      header: "Unidades",
      cell: (row) => formatNumber(row.unidades),
      sortValue: (row) => row.unidades,
      exportValue: (row) => row.unidades,
      exportFormat: "numero",
    },
    {
      id: "facturacion",
      header: "Facturación neta",
      cell: (row) => formatSoles(row.facturacionNeta),
      sortValue: (row) => row.facturacionNeta,
      exportValue: (row) => row.facturacionNeta,
      exportFormat: "soles",
    },
    {
      id: "precio",
      header: "Precio neto prom.",
      cell: (row) => formatSolesDecimales(row.precioNetoPromedio),
      sortValue: (row) => row.precioNetoPromedio,
      exportValue: (row) => row.precioNetoPromedio,
      exportFormat: "soles",
    },
    {
      id: "margen",
      header: "Margen",
      capability: "ver_costos",
      cell: (row) => formatPercent(row.margen ?? null),
      sortValue: (row) => row.margen ?? null,
      exportValue: (row) => row.margen ?? null,
      exportFormat: "porcentaje",
    },
  ];

  const exportarTodos = async () => {
    if (!fetcher.fetch || !baseQuery || !drilldown) return;
    setExportando(true);
    try {
      const filas: DetallePedidoFila[] = [];
      let paginaActual = 1;
      let total = Number.POSITIVE_INFINITY;
      while (filas.length < total) {
        const respuesta = await fetcher.fetch({
          ...baseQuery,
          pagina: paginaActual,
          tamano_pagina: TAMANO_EXPORTACION,
        });
        total = respuesta.pedidos.total;
        filas.push(...respuesta.pedidos.filas);
        if (!respuesta.pedidos.filas.length) break;
        paginaActual += 1;
      }
      const columnas = pedidoColumns.filter((column) => column.exportValue);
      const nombre = exportTable({
        titulo: drilldown.titulo,
        nombreBase: `detalle_${drilldown.titulo}`,
        origen: fetcher.origin.kind,
        periodo: periodoTexto,
        filtros: exportMeta.filtros + (busquedaAplicada ? ` · Búsqueda: ${busquedaAplicada}` : ""),
        generadoEn: new Date().toLocaleString("es-PE"),
        desde: exportMeta.desde,
        hasta: exportMeta.hasta,
        columnas: columnas.map((column) => ({
          id: column.id,
          encabezado: column.header,
          formato: column.exportFormat ?? "texto",
        })),
        filas: filas.map((fila) => columnas.map((column) => column.exportValue?.(fila) ?? null)),
      });
      toast.success(`Excel descargado: ${nombre}`, {
        description: `${formatNumber(filas.length)} pedidos`,
      });
    } catch (error) {
      toast.error("No se pudo exportar el detalle", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setExportando(false);
    }
  };

  return (
    <Sheet open={!!drilldown} onOpenChange={(open) => !open && closeDrilldown()}>
      <SheetContent
        ref={panelRef}
        side="right"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          panelRef.current?.focus();
        }}
        className="flex w-full flex-col gap-0 bg-pc-card p-0 sm:max-w-[920px]"
      >
        <SheetHeader className="border-b border-pc-border px-5 py-4 pr-12">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-base text-pc-text">
            {drilldown?.titulo ?? "Detalle"}
            <DataOriginBadge origin={detalle.origin} mostrarReal />
          </SheetTitle>
          <SheetDescription className="text-xs text-pc-text-muted">
            {alcance.descripcion} Filtros: {exportMeta.filtros}.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-5 py-4">
          <ContractView state={detalle} label="detalle de pedidos" skeleton="tabla">
            {(data, origin) => {
              const desde = data.pedidos.total
                ? (data.pedidos.pagina - 1) * data.pedidos.tamanoPagina + 1
                : 0;
              const hasta = desde ? desde + data.pedidos.filas.length - 1 : 0;
              const paginas = Math.max(
                1,
                Math.ceil(data.pedidos.total / data.pedidos.tamanoPagina),
              );
              const completo = data.pedidos.total <= data.pedidos.filas.length;
              return (
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {[
                      ["Facturación", formatSoles(data.resumen.facturacion)],
                      ["N° ventas", formatNumber(data.resumen.ventas)],
                      ["Unidades", formatNumber(data.resumen.unidades)],
                      ["Ticket prom.", formatSoles(data.resumen.ticket)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-pc-surface-muted px-3 py-2.5">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-pc-text-muted">
                          {label}
                        </dt>
                        <dd className="mt-0.5 text-lg font-bold tabular-nums text-pc-text">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {data.resumen.movimientoCaja !== undefined && (
                    <p
                      role="note"
                      className="rounded-lg bg-pc-info-soft px-3 py-2 text-xs text-pc-info"
                    >
                      Movido en caja en el periodo:{" "}
                      <b className="tabular-nums">{formatSoles(data.resumen.movimientoCaja)}</b>. Es
                      lo que cuenta Caja; «Facturación» es el neto de estos pedidos, que puede ser
                      distinto (comisiones, pasarela, fletes o reembolsos).
                    </p>
                  )}
                  <SegmentedControl
                    ariaLabel="Vista del detalle"
                    options={VISTAS}
                    value={vista}
                    onChange={setVista}
                  />
                  {vista === "pedidos" && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={busquedaId} className="sr-only">
                          Buscar pedidos del grupo
                        </label>
                        <input
                          id={busquedaId}
                          type="search"
                          value={busqueda}
                          onChange={(event) => setBusqueda(event.target.value)}
                          placeholder="Buscar pedido, cliente, canal…"
                          className="h-8 w-full max-w-[280px] rounded-lg border border-pc-border bg-pc-card px-3 text-xs text-pc-text outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
                        />
                        <div className="grow" />
                        {exportMeta.capabilities.has("exportar_tabla") && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={exportando || !fetcher.fetch || data.pedidos.total === 0}
                            onClick={exportarTodos}
                          >
                            <Download aria-hidden />
                            {exportando
                              ? "Exportando…"
                              : `Excel · ${formatNumber(data.pedidos.total)} pedidos${origin.kind === "demo" ? " (demo)" : ""}`}
                          </Button>
                        )}
                      </div>
                      <DataTable
                        caption={`Pedidos · ${drilldown?.titulo ?? ""}`}
                        columns={pedidoColumns}
                        rows={data.pedidos.filas}
                        getRowKey={(row) => row.id}
                        maxHeight={460}
                        busquedaLocal={false}
                        ordenLocal={completo}
                        emptyMessage={
                          busquedaAplicada
                            ? `Ningún pedido coincide con «${busquedaAplicada}»`
                            : undefined
                        }
                      />
                      <nav
                        aria-label="Páginas del detalle"
                        className="flex flex-wrap items-center gap-2 text-xs text-pc-text-muted"
                      >
                        <span role="status">
                          Mostrando {formatNumber(desde)}–{formatNumber(hasta)} de{" "}
                          {formatNumber(data.pedidos.total)} pedidos
                          {busquedaAplicada ? " que coinciden" : ""}
                          {detalle.isFetching ? " · actualizando…" : ""}
                        </span>
                        {!completo && <span>· ordenar la tabla solo aplica a esta página</span>}
                        <div className="grow" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={data.pedidos.pagina <= 1}
                          onClick={() => setPagina((actualPagina) => Math.max(1, actualPagina - 1))}
                          aria-label="Página anterior"
                        >
                          <ChevronLeft aria-hidden />
                        </Button>
                        <span>
                          Página {data.pedidos.pagina} de {paginas}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={data.pedidos.pagina >= paginas}
                          onClick={() => setPagina((actualPagina) => actualPagina + 1)}
                          aria-label="Página siguiente"
                        >
                          <ChevronRight aria-hidden />
                        </Button>
                      </nav>
                    </div>
                  )}
                  {vista === "producto" && (
                    <DataTable
                      caption="Detalle por producto"
                      columns={productoColumns}
                      rows={data.porProducto}
                      getRowKey={(row) => row.productoId}
                      exportar={{
                        titulo: `${drilldown?.titulo ?? "Detalle"} · por producto`,
                        nombreBase: `detalle_productos_${drilldown?.titulo ?? ""}`,
                        origen: origin.kind,
                      }}
                    />
                  )}
                  {vista === "estado" && (
                    <HBarList
                      ariaLabel="Pedidos por estado"
                      formatValue={formatNumber}
                      rows={data.porEstado.map((fila) => {
                        const definicion = ESTADOS_PANEL_DEFINICION[fila.estado];
                        return {
                          key: fila.estado,
                          label: definicion.etiqueta,
                          value: fila.pedidos,
                          barColor:
                            definicion.tono === "bad"
                              ? "var(--pc-bad)"
                              : definicion.tono === "ok"
                                ? "var(--pc-ok)"
                                : "var(--pc-series-1)",
                        };
                      })}
                    />
                  )}
                </div>
              );
            }}
          </ContractView>
        </div>
      </SheetContent>
    </Sheet>
  );
}
