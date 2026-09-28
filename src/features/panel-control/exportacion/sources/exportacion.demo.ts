import { canalesComparativoDemoSource } from "../../canales/sources/canales.demo";
import { clientesZonasDemoSource } from "../../clientes-zonas/sources/clientes-zonas.demo";
import { calcularCuadresDemo } from "../../configuracion/sources/configuracion.demo";
import {
  equipoConfirmadorasDemoSource,
  equipoVendedorasDemoSource,
} from "../../equipo/sources/equipo.demo";
import { operacionesCouriersDemoSource } from "../../operaciones/sources/operaciones.demo";
import { productosDemoSource } from "../../productos/sources/productos.demo";
import { publicidadDemoSource } from "../../publicidad/sources/publicidad.demo";
import { resumenDemoSource } from "../../resumen/sources/resumen.demo";
import {
  COBRO_LABEL,
  ENTRADA_CHIP_LABEL,
  TURNO_LABEL,
  ZONA_LABEL,
} from "../../shared/config/filter-labels.config";
import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import { mapaProductos, pedidosEnRango } from "../../shared/data/demo/demo-consultas";
import { costoPedido, obtenerUniversoDemo } from "../../shared/data/demo/demo-universe";
import { autorizarContrato } from "../../shared/data/panel-autorizacion";
import type { PanelSource, PanelSourceContext } from "../../shared/data/panel-source";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import { calcularDelta } from "../../shared/utils/delta";
import { formatRange, formatSoles } from "../../shared/utils/format";
import { toLimaDayKey } from "../../shared/utils/lima-time";
import type {
  CompartirReporteResponse,
  ExportCellValue,
  ExportColumn,
  ExportTablaRequest,
  HojaLibroCompleto,
} from "../models/exportacion.model";
import { buildLibroWorkbook, libroFileName, workbookBlob } from "../services/export-table.service";

const division = (a: number, b: number): number | null => (b > 0 ? a / b : null);

type Formato = ExportColumn["formato"];

interface Hoja {
  nombre: HojaLibroCompleto;
  columnas: [string, Formato][];
  filas: ExportCellValue[][];
}

export function describirFiltros(query: PanelQuery, context: PanelSourceContext): string {
  const { catalogo } = context;
  const partes: string[] = [];
  if (query.tienda) {
    partes.push(
      `Tienda: ${catalogo.tiendas.find((tienda) => tienda.id === query.tienda)?.nombre ?? query.tienda}`,
    );
  }
  if (query.canal) {
    partes.push(
      `Canal: ${catalogo.canales.find((canal) => canal.id === query.canal)?.nombre ?? query.canal}`,
    );
  }
  if (query.entrada) partes.push(`Entrada: ${ENTRADA_CHIP_LABEL[query.entrada]}`);
  if (query.cobro) partes.push(`Cobro: ${COBRO_LABEL[query.cobro]}`);
  if (query.zona) partes.push(`Zona: ${ZONA_LABEL[query.zona]}`);
  if (query.turno) partes.push(`Turno: ${TURNO_LABEL[query.turno]}`);
  if (query.asesor) {
    partes.push(
      `Asesor(a): ${catalogo.asesores.find((asesor) => asesor.id === query.asesor)?.nombre ?? query.asesor}`,
    );
  }
  return partes.length ? partes.join(" · ") : "Sin filtros";
}

const horaLima = (ts: number) => new Date(ts - 5 * 3_600_000).toISOString().slice(11, 16);

export async function construirHojasLibro(
  query: PanelQuery,
  context: PanelSourceContext,
): Promise<Hoja[]> {
  autorizarContrato("exportacion-libro", context);
  const verCostos = context.capabilities.has("ver_costos");
  const universo = obtenerUniversoDemo(context.catalogo, context.now);
  const productosCatalogo = mapaProductos(universo);
  const [
    resumen,
    ventasCanal,
    entregasCanal,
    productos,
    vendedoras,
    confirmadoras,
    couriers,
    clientes,
  ] = await Promise.all([
    resumenDemoSource.fetch(query, context),
    canalesComparativoDemoSource.fetch({ ...query, vista: "ventas" }, context),
    canalesComparativoDemoSource.fetch({ ...query, vista: "entregas" }, context),
    productosDemoSource.fetch(query, context),
    equipoVendedorasDemoSource.fetch({ ...query, agrupar: "asesora", upsell: "con" }, context),
    equipoConfirmadorasDemoSource.fetch(query, context),
    operacionesCouriersDemoSource.fetch(query, context),
    clientesZonasDemoSource.fetch(query, context),
  ]);
  const publicidad = await publicidadDemoSource.fetch(query, context);
  const actual = resumen.actual;
  const anterior = resumen.anterior_misma_antiguedad;
  const metas = METAS_ESPECIFICACION.indicadores;

  const indicador = (
    nombre: string,
    unidad: string,
    valor: number | null,
    previo: number | null | undefined,
    meta: number | null = null,
  ): ExportCellValue[] => [
    nombre,
    unidad,
    valor,
    previo ?? null,
    previo === undefined ? null : calcularDelta(valor, previo).variacion,
    meta,
  ];
  const filasResumen: ExportCellValue[][] = [
    indicador("Facturación", "S/", actual.vendi.facturacion, anterior?.vendi.facturacion),
    indicador("Ventas", "N°", actual.vendi.ventas, anterior?.vendi.ventas),
    indicador("Ticket promedio", "S/", actual.vendi.ticket, anterior?.vendi.ticket),
    indicador("Leads", "N°", actual.vendi.leads, anterior?.vendi.leads),
    indicador(
      "Confirmados",
      "%",
      actual.vendi.confirmacion,
      anterior?.vendi.confirmacion,
      metas.confirmacion.valor,
    ),
    indicador("Entregado", "S/", actual.entregado.entregado, anterior?.entregado.entregado),
    indicador(
      "Efectividad de entrega",
      "%",
      actual.entregado.efectividadEntrega,
      anterior?.entregado.efectividadEntrega,
      metas.efectividad_entrega.valor,
    ),
    indicador("Me deben", "S/", actual.meDeben.total, anterior?.meDeben.total),
    indicador(
      "Retorno de publicidad",
      "x",
      publicidad.actual.kpis.retornoPublicidad,
      publicidad.anterior_misma_antiguedad?.kpis.retornoPublicidad,
      metas.retorno_publicidad.valor,
    ),
  ];
  if (verCostos && actual.gane) {
    filasResumen.push(indicador("Ganancia", "S/", actual.gane.ganancia, anterior?.gane?.ganancia));
  }

  const fichas = new Map(ventasCanal.actual.canales.map((ficha) => [ficha.id, ficha.nombre]));
  const entregasPorCanal = new Map(
    entregasCanal.actual.vista === "entregas"
      ? entregasCanal.actual.filas.map((fila) => [fila.canalId, fila])
      : [],
  );
  const filasCanales: ExportCellValue[][] =
    ventasCanal.actual.vista === "ventas"
      ? ventasCanal.actual.filas.map((fila) => {
          const entrega = entregasPorCanal.get(fila.canalId);
          const base: ExportCellValue[] = [
            fila.canalId ? (fichas.get(fila.canalId) ?? fila.canalId) : "Sin canal",
            fila.leads,
            fila.confirmacion,
            fila.ventas,
            fila.facturacion,
            fila.participacion,
            fila.ticket,
            fila.metaPeriodo,
            fila.avanceMeta,
            entrega?.entregados ?? null,
            entrega?.rechazados ?? null,
            entrega?.efectividadEntrega ?? null,
            entrega?.pagado ?? null,
            entrega?.porCobrar ?? null,
          ];
          if (verCostos) base.push(entrega?.flete ?? null);
          return base;
        })
      : [];

  const items = pedidosEnRango(universo, query, query.desde, query.hasta, context.now);
  const tiendaNombre = new Map(
    context.catalogo.tiendas.map((tienda) => [tienda.id, tienda.nombre]),
  );
  const filasPedidos: ExportCellValue[][] = items.map(({ pedido, estado }) => {
    const lista = pedido.items.reduce(
      (total, linea) => total + linea.precioLista * linea.cantidad,
      0,
    );
    const fila: ExportCellValue[] = [
      pedido.numero,
      toLimaDayKey(pedido.ts),
      horaLima(pedido.ts),
      tiendaNombre.get(pedido.tiendaId) ?? pedido.tiendaId,
      pedido.canalNombre ?? "Sin canal",
      pedido.canalCierreNombre,
      ENTRADA_CHIP_LABEL[pedido.entrada],
      COBRO_LABEL[pedido.cobro],
      pedido.clienteNombre,
      pedido.departamento,
      ZONA_LABEL[pedido.zona],
      pedido.turno ? TURNO_LABEL[pedido.turno] : null,
      pedido.asesorNombre,
      estado.estado,
      estado.cobro,
      estado.vencido ? "Sí" : "No",
      pedido.listaNegra ? "Sí" : "No",
      estado.estado === "ANULADO"
        ? (pedido.motivoAnulacion ?? "Sin motivo")
        : estado.operativo === "rechazado"
          ? pedido.motivoRechazo
          : null,
      pedido.items
        .map(
          (linea) =>
            `${productosCatalogo.get(linea.productoId)?.nombre ?? linea.productoId} ×${linea.cantidad}`,
        )
        .join(" + "),
      pedido.unidades,
      lista,
      pedido.items.reduce((total, linea) => total + linea.descuento, 0),
      pedido.neto,
      pedido.items
        .filter((linea) => linea.esUpsell)
        .reduce((total, linea) => total + linea.neto, 0),
      pedido.courier,
    ];
    if (verCostos) {
      const costo = costoPedido(pedido, productosCatalogo);
      fila.push(estado.flete, costo.completo ? costo.costo : null);
    }
    return fila;
  });

  const filasProductos = productos.actual.productos.map((fila) => {
    const base: ExportCellValue[] = [
      fila.nombre,
      fila.sku,
      fila.categoria,
      fila.unidades,
      fila.facturacionNeta,
      fila.participacion,
      fila.canalPrincipalNombre ?? "Sin canal",
      fila.descuentoPromedio,
      fila.tasaRechazo,
      fila.stock,
    ];
    if (verCostos) base.push(fila.costoUnitario ?? null, fila.margen ?? null);
    return base;
  });

  const filasVendedoras = vendedoras.actual.grupos.map((grupo) => {
    const m = grupo.metricas;
    const base: ExportCellValue[] = [
      grupo.etiqueta,
      grupo.rol === "caja" ? "Caja" : "Vendedora",
      m.pedidos,
      m.participacion,
      m.entregados,
      m.efectividadEntrega,
      m.pagado,
      m.pendiente,
      m.perdido,
      m.total,
      m.porcentajePagado,
      m.upsellPagado,
      m.tasaUpsell,
      m.ticketEntregado,
      m.metaPeriodo,
      m.avanceMeta,
    ];
    if (context.capabilities.has("ver_comisiones")) base.push(m.comisionEstimada ?? null);
    return base;
  });

  const filasConfirmadoras = confirmadoras.actual.filas.map((fila) => {
    const base: ExportCellValue[] = [
      fila.asesorNombre,
      fila.asignados,
      fila.contactacion,
      fila.confirmados,
      fila.confirmacion,
      fila.tiempoPrimeraLlamadaMin,
      fila.entregados,
      fila.efectividadEntrega,
      fila.anulados,
      fila.upsellTasa,
      fila.upsellPagado,
      fila.metaPeriodo,
      fila.avanceMeta,
    ];
    if (context.capabilities.has("ver_comisiones")) base.push(fila.comisionEstimada ?? null);
    return base;
  });

  const filasCouriers = couriers.actual.couriers.map((fila) => {
    const base: ExportCellValue[] = [
      fila.nombre,
      fila.envios,
      fila.entregados,
      fila.rechazados,
      fila.enTransito,
      fila.efectividad,
      fila.primerIntento,
      fila.diasPromedio,
      fila.plazoLiquidacionDias,
      fila.porLiquidar,
      fila.vencido,
      fila.score,
    ];
    if (verCostos) base.push(fila.fleteTotal ?? null, fila.costoRechazos ?? null);
    return base;
  });

  const cuadres = calcularCuadresDemo(universo, query, context.now);

  return [
    {
      nombre: "Resumen",
      columnas: [
        ["Indicador", "texto"],
        ["Unidad", "texto"],
        ["Periodo", "numero"],
        ["Periodo anterior", "numero"],
        ["Variación", "porcentaje"],
        ["Meta", "numero"],
      ],
      filas: filasResumen,
    },
    {
      nombre: "Canales",
      columnas: [
        ["Canal", "texto"],
        ["Leads", "numero"],
        ["Confirmación", "porcentaje"],
        ["Ventas", "numero"],
        ["Facturación", "soles"],
        ["Part.", "porcentaje"],
        ["Ticket", "soles"],
        ["Meta del periodo", "soles"],
        ["Avance", "porcentaje"],
        ["Entregados", "numero"],
        ["Rechazados", "numero"],
        ["Efectividad", "porcentaje"],
        ["Pagado", "soles"],
        ["Por cobrar", "soles"],
        ...(verCostos ? ([["Flete", "soles"]] as [string, Formato][]) : []),
      ],
      filas: filasCanales,
    },
    {
      nombre: "Pedidos",
      columnas: [
        ["Pedido", "texto"],
        ["Fecha de ingreso", "texto"],
        ["Hora (Lima)", "texto"],
        ["Tienda", "texto"],
        ["Canal de origen", "texto"],
        ["Cerrado por", "texto"],
        ["Entrada", "texto"],
        ["Cobro", "texto"],
        ["Cliente", "texto"],
        ["Departamento", "texto"],
        ["Zona", "texto"],
        ["Turno", "texto"],
        ["Asesor(a)", "texto"],
        ["Estado", "texto"],
        ["Estado de cobro", "texto"],
        ["Vencido", "texto"],
        ["Lista negra", "texto"],
        ["Motivo", "texto"],
        ["Productos", "texto"],
        ["Unidades", "numero"],
        ["Precio de lista", "soles"],
        ["Descuento", "soles"],
        ["Neto", "soles"],
        ["Upsell", "soles"],
        ["Courier", "texto"],
        ...(verCostos
          ? ([
              ["Flete", "soles"],
              ["Costo de producto", "soles"],
            ] as [string, Formato][])
          : []),
      ],
      filas: filasPedidos,
    },
    {
      nombre: "Productos",
      columnas: [
        ["Producto", "texto"],
        ["SKU", "texto"],
        ["Categoría", "texto"],
        ["Unidades", "numero"],
        ["Facturación neta", "soles"],
        ["Part.", "porcentaje"],
        ["Canal principal", "texto"],
        ["Descuento promedio", "porcentaje"],
        ["Tasa de rechazo", "porcentaje"],
        ["Stock", "numero"],
        ...(verCostos
          ? ([
              ["Costo unitario", "soles"],
              ["Margen", "porcentaje"],
            ] as [string, Formato][])
          : []),
      ],
      filas: filasProductos,
    },
    {
      nombre: "Vendedoras",
      columnas: [
        ["Asesora", "texto"],
        ["Rol", "texto"],
        ["Pedidos", "numero"],
        ["Part.", "porcentaje"],
        ["Entregados", "numero"],
        ["Efectividad", "porcentaje"],
        ["Pagado", "soles"],
        ["Pendiente", "soles"],
        ["Perdido", "soles"],
        ["Total", "soles"],
        ["% pagado", "porcentaje"],
        ["Upsell pagado", "soles"],
        ["Tasa de upsell", "porcentaje"],
        ["Ticket entregado", "soles"],
        ["Meta del periodo", "soles"],
        ["Avance", "porcentaje"],
        ...(context.capabilities.has("ver_comisiones")
          ? ([["Comisión estimada", "soles"]] as [string, Formato][])
          : []),
      ],
      filas: filasVendedoras,
    },
    {
      nombre: "Confirmadoras",
      columnas: [
        ["Confirmadora", "texto"],
        ["Asignados", "numero"],
        ["Contactados", "porcentaje"],
        ["Confirmados", "numero"],
        ["% confirmación", "porcentaje"],
        ["1ª llamada (min)", "numero"],
        ["Entregados", "numero"],
        ["Entrega de lo confirmado", "porcentaje"],
        ["Anulados", "numero"],
        ["Tasa de upsell", "porcentaje"],
        ["Upsell pagado", "soles"],
        ["Meta de confirmados", "numero"],
        ["Avance", "porcentaje"],
        ...(context.capabilities.has("ver_comisiones")
          ? ([["Comisión estimada", "soles"]] as [string, Formato][])
          : []),
      ],
      filas: filasConfirmadoras,
    },
    {
      nombre: "Couriers",
      columnas: [
        ["Courier", "texto"],
        ["Envíos", "numero"],
        ["Entregados", "numero"],
        ["Rechazados", "numero"],
        ["En tránsito", "numero"],
        ["Efectividad", "porcentaje"],
        ["1er intento", "porcentaje"],
        ["Días promedio", "numero"],
        ["Plazo de liquidación", "numero"],
        ["Por liquidar", "soles"],
        ["Vencido", "soles"],
        ["Score", "texto"],
        ...(verCostos
          ? ([
              ["Flete total", "soles"],
              ["Costo de rechazos", "soles"],
            ] as [string, Formato][])
          : []),
      ],
      filas: filasCouriers,
    },
    {
      nombre: "Departamentos",
      columnas: [
        ["Departamento", "texto"],
        ["Zona", "texto"],
        ["Ventas", "numero"],
        ["Facturación", "soles"],
        ["Part.", "porcentaje"],
        ["Ticket", "soles"],
        ["Efectividad", "porcentaje"],
      ],
      filas: clientes.actual.departamentos.map((fila) => [
        fila.departamento,
        ZONA_LABEL[fila.zona],
        fila.ventas,
        fila.facturacion,
        fila.participacion,
        fila.ticket,
        fila.efectividadEntrega,
      ]),
    },
    {
      nombre: "Cuadres",
      columnas: [
        ["Cuadre", "texto"],
        ["Valor", "numero"],
        ["Total", "numero"],
        ["Cuadra", "texto"],
        ["Nota", "texto"],
      ],
      filas: cuadres.cuadres.map((fila) => [
        fila.descripcion,
        fila.valor,
        fila.total,
        fila.cuadra ? "✓" : "✗",
        fila.nota,
      ]),
    },
  ];
}

export function periodoTexto(query: PanelQuery): string {
  return `${formatRange(query.desde, query.hasta)} (hora Lima)`;
}

export const exportacionLibroDemoSource: PanelSource<"exportacion-libro"> = {
  contractId: "exportacion-libro",
  kind: "demo",
  descripcion:
    "Libro demo generado en el navegador con los mismos datos demo de cada pestaña. En producción lo genera GET /panel/export.xlsx",
  fetch: async ({ formato: _formato, ...query }, context) => {
    const hojas = await construirHojasLibro(query, context);
    const comun = {
      periodo: periodoTexto(query),
      filtros: describirFiltros(query, context),
      origen: "demo" as const,
      generadoEn: new Date(context.now).toLocaleString("es-PE", { timeZone: "America/Lima" }),
      nombreBase: "panel",
      desde: query.desde,
      hasta: query.hasta,
    };
    const workbook = buildLibroWorkbook(
      hojas.map((hoja) => {
        const request: ExportTablaRequest = {
          ...comun,
          titulo: hoja.nombre,
          columnas: hoja.columnas.map(([encabezado, formato], index) => ({
            id: `c${index}`,
            encabezado,
            formato,
          })),
          filas: hoja.filas,
        };
        return { nombre: hoja.nombre, request };
      }),
    );
    return {
      archivo: workbookBlob(workbook),
      nombreArchivo: libroFileName(query.desde, query.hasta, true),
    };
  },
};

export const compartirReporteDemoSource: PanelSource<"compartir-reporte"> = {
  contractId: "compartir-reporte",
  kind: "demo",
  descripcion:
    "Reporte demo con el formato del equipo para WhatsApp. En producción lo arma GET /panel/compartir",
  fetch: async (query, context): Promise<CompartirReporteResponse> => {
    autorizarContrato("compartir-reporte", context);
    const verCostos = context.capabilities.has("ver_costos");
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const productosCatalogo = mapaProductos(universo);
    const [{ actual }, publicidad] = await Promise.all([
      resumenDemoSource.fetch(query, context),
      publicidadDemoSource.fetch(query, context),
    ]);
    const ventas = pedidosEnRango(universo, query, query.desde, query.hasta, context.now).filter(
      ({ estado }) => estado.venta,
    );
    const costos = ventas.map(({ pedido }) => costoPedido(pedido, productosCatalogo));
    const producto = costos.reduce((total, costo) => total + costo.costo, 0);
    const productoIncompleto = costos.some((costo) => !costo.completo);
    const envios = actual.gane?.flete ?? null;
    const invertido = publicidad.actual.kpis.invertido;
    const periodo = periodoTexto(query);
    const reporte: CompartirReporteResponse = {
      periodo,
      ventaTotal: actual.vendi.facturacion,
      pedidos: actual.vendi.ventas,
      publicidad: invertido,
      costoPorVenta: division(invertido, actual.vendi.ventas),
      entregado: actual.entregado.entregado,
      efectividadEntrega: actual.entregado.efectividadEntrega,
      meDeben: actual.meDeben.total,
      vencido: actual.meDeben.vencido,
      texto: "",
    };
    if (verCostos && actual.gane && envios !== null) {
      reporte.producto = producto;
      reporte.productoIncompleto = productoIncompleto;
      reporte.envios = envios;
      reporte.gananciaSobreVentaTotal = actual.vendi.facturacion - producto - invertido - envios;
      reporte.gananciaSobreEntregado = actual.gane.ganancia;
    }
    const lineas = [
      `*Reporte POWIP · ${periodo}*`,
      describirFiltros(query, context) === "Sin filtros"
        ? null
        : `_${describirFiltros(query, context)}_`,
      `Venta total: ${formatSoles(reporte.ventaTotal)} (${reporte.pedidos} pedidos)`,
      reporte.producto !== undefined
        ? `Producto: ${formatSoles(reporte.producto)}${reporte.productoIncompleto ? " (hay productos sin costo)" : ""}`
        : null,
      `Publicidad: ${formatSoles(reporte.publicidad)}`,
      reporte.envios !== undefined ? `Envíos: ${formatSoles(reporte.envios)}` : null,
      `CPA: ${formatSoles(reporte.costoPorVenta)}`,
      reporte.gananciaSobreVentaTotal !== undefined
        ? `Ganancia sobre venta total (venta − producto − publicidad − envíos): ${formatSoles(reporte.gananciaSobreVentaTotal)}`
        : null,
      "—",
      `Entregado: ${formatSoles(reporte.entregado)} (efectividad ${
        reporte.efectividadEntrega === null
          ? "—"
          : `${Math.round(reporte.efectividadEntrega * 100)}%`
      })`,
      reporte.gananciaSobreEntregado !== undefined
        ? `Ganancia real sobre entregado (entregado − costo − publicidad − envíos − comisiones): ${formatSoles(reporte.gananciaSobreEntregado)}`
        : null,
      `Me deben: ${formatSoles(reporte.meDeben)}${reporte.vencido ? ` (vencido ${formatSoles(reporte.vencido)})` : ""}`,
      "_Cifras de demostración_",
    ];
    reporte.texto = lineas.filter((linea): linea is string => linea !== null).join("\n");
    return reporte;
  },
};
