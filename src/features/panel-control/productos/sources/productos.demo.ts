import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import {
  instanteAnterior,
  mapaProductos,
  type PedidoConEstado,
  pedidosEnRango,
  ventasDiariasDemo,
} from "../../shared/data/demo/demo-consultas";
import { obtenerUniversoDemo, type UniversoDemo } from "../../shared/data/demo/demo-universe";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import type {
  CategoriaFila,
  CuponFila,
  ProductoFila,
  ProductosKpis,
  ProductosPanel,
} from "../models/productos.model";

const division = (a: number, b: number): number | null => (b > 0 ? a / b : null);

function kpis(items: PedidoConEstado[]): ProductosKpis {
  const ventas = items.filter(({ estado }) => estado.venta);
  const facturacion = ventas.reduce((total, { pedido }) => total + pedido.neto, 0);
  const unidades = ventas.reduce((total, { pedido }) => total + pedido.unidades, 0);
  const lineas = ventas.flatMap(({ pedido }) => pedido.items);
  const descuentos = lineas.reduce((total, linea) => total + linea.descuento, 0);
  const upsell = lineas
    .filter((linea) => linea.esUpsell)
    .reduce((total, linea) => total + linea.neto, 0);
  const perdidos = items.filter(
    ({ estado }) => estado.estado === "ANULADO" || estado.operativo === "rechazado",
  ).length;
  return {
    facturacionNeta: facturacion,
    ventas: ventas.length,
    unidades,
    ticket: division(facturacion, ventas.length),
    unidadesPorVenta: division(unidades, ventas.length),
    descuentos,
    descuentoSobreLista: division(descuentos, facturacion + descuentos),
    upsell,
    ventasConUpsell: ventas.filter(({ pedido }) => pedido.items.some((linea) => linea.esUpsell))
      .length,
    anuladosMasRechazados: perdidos,
    ingresados: items.length,
    tasaPerdida: division(perdidos, items.length),
  };
}

function construir(
  universo: UniversoDemo,
  query: PanelQuery,
  items: PedidoConEstado[],
  anteriores: PedidoConEstado[] | null,
  verCostos: boolean,
): ProductosPanel {
  const catalogo = mapaProductos(universo);
  const canalNombre = new Map(universo.canales.map((canal) => [canal.id, canal.nombre]));
  const ventas = items.filter(({ estado }) => estado.venta);
  const facturacion = ventas.reduce((total, { pedido }) => total + pedido.neto, 0);

  const porProducto = new Map<
    string,
    {
      unidades: number;
      neto: number;
      descuento: number;
      canales: Map<string | null, number>;
      entregados: number;
      rechazados: number;
    }
  >();
  const porCupon = new Map<string, PedidoConEstado[]>();
  const porCategoria = new Map<string, number>();

  for (const item of ventas) {
    const { pedido, estado } = item;
    if (pedido.cupon) porCupon.set(pedido.cupon, [...(porCupon.get(pedido.cupon) ?? []), item]);
    const vistos = new Set<string>();
    for (const linea of pedido.items) {
      const actual = porProducto.get(linea.productoId) ?? {
        unidades: 0,
        neto: 0,
        descuento: 0,
        canales: new Map<string | null, number>(),
        entregados: 0,
        rechazados: 0,
      };
      actual.unidades += linea.cantidad;
      actual.neto += linea.neto;
      actual.descuento += linea.descuento;
      actual.canales.set(
        pedido.canalId,
        (actual.canales.get(pedido.canalId) ?? 0) + linea.cantidad,
      );
      if (!vistos.has(linea.productoId)) {
        if (estado.operativo === "entregado") actual.entregados += 1;
        if (estado.operativo === "rechazado") actual.rechazados += 1;
        vistos.add(linea.productoId);
      }
      porProducto.set(linea.productoId, actual);
      const categoria = catalogo.get(linea.productoId)?.categoria ?? "Sin categoría";
      porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + linea.neto);
    }
  }

  const productos: ProductoFila[] = [...porProducto.entries()]
    .map(([productoId, valores]) => {
      const producto = catalogo.get(productoId);
      const principal = [...valores.canales.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const fila: ProductoFila = {
        productoId,
        sku: producto?.sku ?? productoId,
        productoBaseId: producto?.baseId ?? productoId,
        productoBaseNombre: producto?.baseNombre ?? productoId,
        variante: producto?.variante ?? null,
        nombre: producto?.nombre ?? productoId,
        categoria: producto?.categoria ?? null,
        unidades: valores.unidades,
        facturacionNeta: valores.neto,
        participacion: division(valores.neto, facturacion),
        canalPrincipalId: principal,
        canalPrincipalNombre: principal ? (canalNombre.get(principal) ?? null) : null,
        descuentoPromedio: division(valores.descuento, valores.neto + valores.descuento),
        tasaRechazo: division(valores.rechazados, valores.entregados + valores.rechazados),
        stock: producto?.stock ?? null,
      };
      if (verCostos) {
        const costo = producto?.costo ?? null;
        fila.costoUnitario = costo;
        fila.margen =
          costo === null || valores.neto === 0
            ? null
            : 1 - (costo * valores.unidades) / valores.neto;
      }
      return fila;
    })
    .sort((a, b) => b.facturacionNeta - a.facturacionNeta);

  const cupones: CuponFila[] = [...porCupon.entries()]
    .map(([cupon, grupo]) => {
      const entregados = grupo.filter(({ estado }) => estado.operativo === "entregado").length;
      const rechazados = grupo.filter(({ estado }) => estado.operativo === "rechazado").length;
      return {
        cupon,
        ventas: grupo.length,
        descuento: grupo.reduce(
          (total, { pedido }) =>
            total + pedido.items.reduce((suma, linea) => suma + linea.descuento, 0),
          0,
        ),
        facturacion: grupo.reduce((total, { pedido }) => total + pedido.neto, 0),
        efectividadEntrega: division(entregados, entregados + rechazados),
      };
    })
    .sort((a, b) => b.ventas - a.ventas);

  const categorias: CategoriaFila[] = [...porCategoria.entries()]
    .map(([categoria, facturacionNeta]) => ({ categoria, facturacionNeta }))
    .sort((a, b) => b.facturacionNeta - a.facturacionNeta);

  return {
    kpis: kpis(items),
    ventasDiarias: ventasDiariasDemo(query, items, anteriores),
    productos,
    cupones,
    categorias,
  };
}

export const productosDemoSource: PanelSource<"productos"> = {
  contractId: "productos",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/productos no existe todavía. Ítems, precios netos y cantidades salen del mismo conjunto de pedidos demo",
  fetch: async (query, context) => {
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const verCostos = context.capabilities.has("ver_costos");
    const tAnterior = instanteAnterior(query, context.now);
    const actuales = pedidosEnRango(universo, query, query.desde, query.hasta, context.now);
    const anteriores = pedidosEnRango(
      universo,
      query,
      query.anterior_desde,
      query.anterior_hasta,
      tAnterior,
    );
    const anteriorQuery = { ...query, desde: query.anterior_desde, hasta: query.anterior_hasta };
    return {
      actual: construir(universo, query, actuales, anteriores, verCostos),
      anterior_misma_antiguedad: construir(universo, anteriorQuery, anteriores, null, verCostos),
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
