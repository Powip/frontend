import { metaMensualConfirmadora } from "../../call-center/sources/call-center.demo";
import { metaMensualVendedora } from "../../equipo/sources/equipo.demo";
import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import {
  mapaProductos,
  type PedidoConEstado,
  pedidosEnRango,
  repartirPauta,
} from "../../shared/data/demo/demo-consultas";
import {
  costoPedido,
  obtenerUniversoDemo,
  type UniversoDemo,
} from "../../shared/data/demo/demo-universe";
import type { PanelSource } from "../../shared/data/panel-source";
import { ESTADOS_PANEL } from "../../shared/models/estado-pedido.model";
import type { MetasPanel } from "../../shared/models/goal.model";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import { formatSoles } from "../../shared/utils/format";
import type {
  CalidadDatos,
  ConfigCuadres,
  ConfigEstados,
  CuadreId,
  CuadreResultado,
} from "../models/configuracion.model";

const TOLERANCIA_SOLES = 1;
const redondear = (valor: number) => Math.round(valor * 100) / 100;

export function metasMensualesDemo(universo: UniversoDemo): MetasPanel {
  const confirmadoras = new Set<string>();
  const vendedoras = new Set<string>();
  for (const pedido of universo.pedidos) {
    if (!pedido.asesorId) continue;
    if (pedido.entrada === "lead") confirmadoras.add(pedido.asesorId);
    else vendedoras.add(pedido.asesorId);
  }
  return {
    ...METAS_ESPECIFICACION,
    mensuales: {
      porCanal: Object.fromEntries(universo.canales.map((canal) => [canal.id, canal.metaMensual])),
      porVendedora: Object.fromEntries([...vendedoras].map((id) => [id, metaMensualVendedora(id)])),
      porConfirmadora: Object.fromEntries(
        [...confirmadoras].map((id) => [id, metaMensualConfirmadora(id)]),
      ),
    },
  };
}

function sumarPor<K>(items: PedidoConEstado[], clave: (item: PedidoConEstado) => K): number {
  const grupos = new Map<K, number>();
  for (const item of items) {
    grupos.set(clave(item), (grupos.get(clave(item)) ?? 0) + item.pedido.neto);
  }
  let total = 0;
  for (const valor of grupos.values()) total += valor;
  return total;
}

function cuadre(
  id: CuadreId,
  descripcion: string,
  valor: number,
  total: number,
  unidad: CuadreResultado["unidad"],
  nota: string | null = null,
): CuadreResultado {
  const diferencia = Math.abs(valor - total);
  return {
    id,
    descripcion,
    valor: unidad === "soles" ? redondear(valor) : valor,
    total: unidad === "soles" ? redondear(total) : total,
    unidad,
    cuadra: unidad === "soles" ? diferencia < TOLERANCIA_SOLES : diferencia === 0,
    nota,
  };
}

export function calidadDatosDemo(
  universo: UniversoDemo,
  query: PanelQuery,
  items: PedidoConEstado[],
): CalidadDatos {
  const productos = mapaProductos(universo);
  const deTienda = universo.productos.filter(
    (producto) => !query.tienda || producto.tiendaId === query.tienda,
  );
  const sinMotivo = items.filter(
    ({ pedido, estado }) => estado.estado === "ANULADO" && pedido.motivoAnulacion === null,
  );
  const sinCanal = items.filter(({ pedido }) => pedido.canalId === null);
  const sinCosto = items.filter(
    ({ pedido, estado }) => estado.venta && !costoPedido(pedido, productos).completo,
  );
  const incompletos = new Set(
    [...sinMotivo, ...sinCanal, ...sinCosto].map(({ pedido }) => pedido.id),
  );
  return {
    porcentajeCompleto: items.length ? 1 - incompletos.size / items.length : null,
    pedidosRevisados: items.length,
    anulacionesSinMotivo: sinMotivo.length,
    importadosSinCanal: sinCanal.length,
    ventasConProductoSinCosto: sinCosto.length,
    productosSinCosto: deTienda
      .filter((producto) => producto.costo === null)
      .map((producto) => ({ productoId: producto.id, nombre: producto.nombre })),
    productosStockNegativo: deTienda
      .filter((producto) => producto.stock < 0)
      .map((producto) => ({
        productoId: producto.id,
        nombre: producto.nombre,
        stock: producto.stock,
      })),
  };
}

export function calcularCuadresDemo(
  universo: UniversoDemo,
  query: PanelQuery,
  t: number,
): ConfigCuadres {
  const items = pedidosEnRango(universo, query, query.desde, query.hasta, t);
  const ventas = items.filter(({ estado }) => estado.venta);
  const facturado = ventas.reduce((total, { pedido }) => total + pedido.neto, 0);
  const porOperativo = (operativos: string[]) =>
    ventas
      .filter(({ estado }) => estado.operativo !== null && operativos.includes(estado.operativo))
      .reduce((total, { pedido }) => total + pedido.neto, 0);
  const porCobro = (cobros: string[]) =>
    ventas
      .filter(({ estado }) => cobros.includes(estado.cobro))
      .reduce((total, { pedido }) => total + pedido.neto, 0);
  const leads = items.filter(({ pedido }) => pedido.entrada === "lead");
  const unidadesPorProducto = new Map<string, number>();
  for (const { pedido } of ventas) {
    for (const linea of pedido.items) {
      unidadesPorProducto.set(
        linea.productoId,
        (unidadesPorProducto.get(linea.productoId) ?? 0) + linea.cantidad,
      );
    }
  }
  const reparto = repartirPauta(universo, query, query.desde, query.hasta, items);
  let prorrateada = 0;
  for (const valor of reparto.porCanal.values()) prorrateada += valor.total;
  const registrada = universo.pauta
    .filter(
      (registro) =>
        registro.dia >= query.desde &&
        registro.dia <= query.hasta &&
        (!query.tienda || registro.tiendaId === query.tienda),
    )
    .reduce((total, registro) => total + registro.monto, 0);
  const filtroCanal = !!(query.canal || query.entrada || query.cobro);
  const notaPauta = filtroCanal
    ? "Con filtro de canal, entrada o cobro no se incluye la pauta de los demás canales: no puede cuadrar (contradicción de §12, ver README)."
    : reparto.generalSinAsignar > 0
      ? `${formatSoles(reparto.generalSinAsignar)} de pauta general sin canal que la reciba: ningún canal receptor vendió.`
      : null;

  return {
    cuadres: [
      cuadre(
        "canales_facturacion",
        "Σ facturación por canal = facturación total",
        sumarPor(ventas, ({ pedido }) => pedido.canalId),
        facturado,
        "soles",
      ),
      cuadre(
        "asesores_facturacion",
        "Σ facturación por asesor(a) = facturación total",
        sumarPor(ventas, ({ pedido }) => pedido.asesorId),
        facturado,
        "soles",
      ),
      cuadre(
        "zonas_facturacion",
        "Σ facturación por zona = facturación total",
        sumarPor(ventas, ({ pedido }) => pedido.zona),
        facturado,
        "soles",
      ),
      cuadre(
        "facturado_entregado_curso_rechazado",
        "Facturado = Entregado + En curso + Rechazado",
        porOperativo(["entregado", "rechazado", "pendiente", "preparado", "con_guia", "en_envio"]),
        facturado,
        "soles",
      ),
      cuadre(
        "facturado_cobranza",
        "Facturado = Pagado + Por liquidar + En curso + Perdido + Reembolsado",
        porCobro(["pagado", "por_liquidar", "en_curso", "perdido", "reembolsado"]),
        facturado,
        "soles",
      ),
      cuadre(
        "leads_estados",
        "Leads = Confirmados + Anulados + Pendientes",
        leads.filter(
          ({ estado }) => estado.venta || estado.estado === "ANULADO" || estado.leadAbierto,
        ).length,
        leads.length,
        "cantidad",
      ),
      cuadre(
        "estados_pedidos",
        "Σ pedidos por estado = pedidos ingresados",
        ESTADOS_PANEL.reduce(
          (total, estado) => total + items.filter((item) => item.estado.estado === estado).length,
          0,
        ),
        items.length,
        "cantidad",
      ),
      cuadre(
        "unidades_productos",
        "Σ unidades por producto = unidades totales",
        [...unidadesPorProducto.values()].reduce((total, valor) => total + valor, 0),
        ventas.reduce((total, { pedido }) => total + pedido.unidades, 0),
        "cantidad",
      ),
      cuadre(
        "pauta_prorrateada",
        "Pauta directa + general prorrateada = pauta registrada",
        prorrateada,
        registrada,
        "soles",
        notaPauta,
      ),
    ],
    calidad: calidadDatosDemo(universo, query, items),
  };
}

export const configEstadosDemoSource: PanelSource<"config-estados"> = {
  contractId: "config-estados",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/config/estados no existe todavía. Pedidos ingresados en el periodo por su estado actual",
  fetch: async (query, context): Promise<ConfigEstados> => {
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const items = pedidosEnRango(universo, query, query.desde, query.hasta, context.now);
    return {
      conteoActual: ESTADOS_PANEL.map((estado) => ({
        estado,
        pedidos: items.filter((item) => item.estado.estado === estado).length,
      })),
    };
  },
};

export const configCuadresDemoSource: PanelSource<"config-cuadres"> = {
  contractId: "config-cuadres",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/config/cuadres no existe todavía. Los 9 cuadres de §12 con los mismos filtros del panel",
  fetch: async (query, context) =>
    calcularCuadresDemo(obtenerUniversoDemo(context.catalogo, context.now), query, context.now),
};
