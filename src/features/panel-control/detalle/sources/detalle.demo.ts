import {
  mapaProductos,
  movimientoCajaEnPeriodo,
  type PedidoConEstado,
  seleccionarGrupo,
} from "../../shared/data/demo/demo-consultas";
import { obtenerUniversoDemo } from "../../shared/data/demo/demo-universe";
import { consultaConIdentidad, parametrosConIdentidad } from "../../shared/data/panel-identidad";
import type { PanelSource } from "../../shared/data/panel-source";
import { ESTADOS_PANEL } from "../../shared/models/estado-pedido.model";
import { toLimaDayKey } from "../../shared/utils/lima-time";
import type {
  DetalleEstadoFila,
  DetallePedidoFila,
  DetalleProductoFila,
  DetalleResponse,
} from "../models/detalle.model";

function horaLima(ts: number): string {
  const lima = new Date(ts - 5 * 3_600_000);
  const hh = String(lima.getUTCHours()).padStart(2, "0");
  const mm = String(lima.getUTCMinutes()).padStart(2, "0");
  return `${toLimaDayKey(ts)}T${hh}:${mm}:00-05:00`;
}

export function aFila({ pedido, estado }: PedidoConEstado): DetallePedidoFila {
  return {
    id: pedido.id,
    numero: pedido.numero,
    ingreso: horaLima(pedido.ts),
    canalOrigenId: pedido.canalId,
    canalOrigenNombre: pedido.canalNombre,
    canalCierreNombre: pedido.canalCierreNombre,
    cliente: pedido.clienteNombre,
    departamento: pedido.departamento,
    asesor: pedido.asesorNombre,
    estado: estado.estado,
    cobro: estado.cobro,
    vencido: estado.vencido,
    listaNegra: pedido.listaNegra,
    motivo:
      estado.estado === "ANULADO"
        ? pedido.motivoAnulacion
        : estado.operativo === "rechazado"
          ? pedido.motivoRechazo
          : null,
    neto: pedido.neto,
  };
}

function coincideBusqueda({ pedido }: PedidoConEstado, termino: string): boolean {
  return [
    pedido.numero,
    pedido.clienteNombre,
    pedido.canalNombre ?? "sin canal",
    pedido.asesorNombre ?? "",
    pedido.departamento,
  ]
    .join(" ")
    .toLowerCase()
    .includes(termino);
}

export const detalleDemoSource: PanelSource<"detalle"> = {
  contractId: "detalle",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: el contrato GET /panel/detalle no existe todavía. Las filas salen del mismo grupo que la cifra clickeada",
  fetch: async (query, context): Promise<DetalleResponse> => {
    const { grupo, grupo_params, pagina, tamano_pagina, buscar, ...consulta } = query;
    const panelQuery = consultaConIdentidad(consulta, context);
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const params = parametrosConIdentidad(
      JSON.parse(grupo_params || "{}") as Record<string, string>,
      context,
    );
    const grupoCompleto = seleccionarGrupo(universo, panelQuery, grupo, params, context.now);
    const verCostos = context.capabilities.has("ver_costos");

    const ventas = grupoCompleto.filter(({ estado }) => estado.venta);
    const facturacion = ventas.reduce((total, { pedido }) => total + pedido.neto, 0);

    const productos = new Map<
      string,
      { unidades: number; facturacion: number; costo: number | null }
    >();
    const catalogo = mapaProductos(universo);
    for (const { pedido } of ventas) {
      for (const linea of pedido.items) {
        const actual = productos.get(linea.productoId) ?? { unidades: 0, facturacion: 0, costo: 0 };
        const unitario = catalogo.get(linea.productoId)?.costo ?? null;
        productos.set(linea.productoId, {
          unidades: actual.unidades + linea.cantidad,
          facturacion: actual.facturacion + linea.neto,
          costo:
            actual.costo === null || unitario === null
              ? null
              : actual.costo + unitario * linea.cantidad,
        });
      }
    }
    const porProducto: DetalleProductoFila[] = [...productos.entries()]
      .map(([productoId, valores]) => {
        const fila: DetalleProductoFila = {
          productoId,
          nombre:
            universo.productos.find((producto) => producto.id === productoId)?.nombre ?? productoId,
          unidades: valores.unidades,
          facturacionNeta: valores.facturacion,
          precioNetoPromedio: valores.unidades ? valores.facturacion / valores.unidades : null,
        };
        if (verCostos) {
          fila.margen =
            valores.costo === null || valores.facturacion === 0
              ? null
              : 1 - valores.costo / valores.facturacion;
        }
        return fila;
      })
      .sort((a, b) => b.facturacionNeta - a.facturacionNeta);

    const porEstado: DetalleEstadoFila[] = ESTADOS_PANEL.map((estado) => ({
      estado,
      pedidos: grupoCompleto.filter((item) => item.estado.estado === estado).length,
    })).filter((fila) => fila.pedidos > 0);

    const movimientos =
      grupo === "movimientos_caja"
        ? new Map(
            grupoCompleto.map(({ pedido }) => [
              pedido.id,
              movimientoCajaEnPeriodo(pedido, params, panelQuery, context.now),
            ]),
          )
        : null;
    const orden = (item: PedidoConEstado) =>
      movimientos?.get(item.pedido.id)?.fecha ?? item.pedido.ts;

    const termino = (buscar ?? "").trim().toLowerCase();
    const coincidentes = (
      termino ? grupoCompleto.filter((item) => coincideBusqueda(item, termino)) : grupoCompleto
    )
      .slice()
      .sort((a, b) => orden(b) - orden(a));
    const fila = (item: PedidoConEstado): DetallePedidoFila => {
      const base = aFila(item);
      const movimiento = movimientos?.get(item.pedido.id);
      return movimiento
        ? {
            ...base,
            movimientoFecha: horaLima(movimiento.fecha),
            movimientoMonto: movimiento.monto,
          }
        : base;
    };
    const tamanoPagina = Math.max(1, tamano_pagina);
    const paginaSegura = Math.max(
      1,
      Math.min(pagina, Math.max(1, Math.ceil(coincidentes.length / tamanoPagina))),
    );
    const inicio = (paginaSegura - 1) * tamanoPagina;

    return {
      resumen: {
        facturacion,
        ventas: ventas.length,
        unidades: ventas.reduce((total, { pedido }) => total + pedido.unidades, 0),
        ticket: ventas.length ? facturacion / ventas.length : null,
        ...(movimientos
          ? {
              movimientoCaja:
                Math.round(
                  [...movimientos.values()].reduce(
                    (total, movimiento) => total + (movimiento?.monto ?? 0),
                    0,
                  ) * 100,
                ) / 100,
            }
          : {}),
      },
      pedidos: {
        filas: coincidentes.slice(inicio, inicio + tamanoPagina).map(fila),
        total: coincidentes.length,
        pagina: paginaSegura,
        tamanoPagina,
      },
      porProducto,
      porEstado,
    };
  },
};
