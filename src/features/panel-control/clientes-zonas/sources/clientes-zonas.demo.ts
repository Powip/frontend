import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import {
  esClienteNuevo,
  esRecurrente,
  type PedidoConEstado,
  pedidosEnRango,
} from "../../shared/data/demo/demo-consultas";
import { estadoDemoEn, obtenerUniversoDemo } from "../../shared/data/demo/demo-universe";
import type { PanelSource } from "../../shared/data/panel-source";
import type {
  ClientesZonasPanel,
  DepartamentoFila,
  MejorClienteFila,
  MetodoPagoFila,
  ZonaFila,
} from "../models/clientes-zonas.model";

const division = (a: number, b: number): number | null => (b > 0 ? a / b : null);

interface Resumen {
  ventas: number;
  facturacion: number;
  entregados: number;
  rechazados: number;
}

function resumir(items: PedidoConEstado[]): Resumen {
  return items.reduce(
    (acumulado, { pedido, estado }) => ({
      ventas: acumulado.ventas + 1,
      facturacion: acumulado.facturacion + pedido.neto,
      entregados: acumulado.entregados + (estado.operativo === "entregado" ? 1 : 0),
      rechazados: acumulado.rechazados + (estado.operativo === "rechazado" ? 1 : 0),
    }),
    { ventas: 0, facturacion: 0, entregados: 0, rechazados: 0 },
  );
}

function agrupar<K>(
  items: PedidoConEstado[],
  clave: (item: PedidoConEstado) => K,
): Map<K, PedidoConEstado[]> {
  const mapa = new Map<K, PedidoConEstado[]>();
  for (const item of items) mapa.set(clave(item), [...(mapa.get(clave(item)) ?? []), item]);
  return mapa;
}

export const clientesZonasDemoSource: PanelSource<"clientes-zonas"> = {
  contractId: "clientes-zonas",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/clientes no existe todavía. El historial demo cubre los últimos 400 días",
  fetch: async (query, context) => {
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const ventas = pedidosEnRango(universo, query, query.desde, query.hasta, context.now).filter(
      ({ estado }) => estado.venta,
    );
    const total = resumir(ventas);
    const clientes = new Set(ventas.map(({ pedido }) => pedido.clienteId));
    const muestra = new Map(ventas.map((item) => [item.pedido.clienteId, item.pedido]));
    const nuevos = [...clientes].filter((id) => {
      const pedido = muestra.get(id);
      return pedido ? esClienteNuevo(universo, pedido, query.desde) : false;
    });
    const recurrentes = [...clientes].filter((id) => {
      const pedido = muestra.get(id);
      return pedido ? esRecurrente(universo, pedido, query.desde) : false;
    });

    const historial = new Map<string, PedidoConEstado[]>();
    for (const pedido of universo.pedidos) {
      if (pedido.ts > context.now || !clientes.has(pedido.clienteId)) continue;
      const estado = estadoDemoEn(pedido, context.now);
      if (!estado.venta) continue;
      historial.set(pedido.clienteId, [
        ...(historial.get(pedido.clienteId) ?? []),
        { pedido, estado },
      ]);
    }
    const conRecompra = [...clientes].filter((id) => (historial.get(id)?.length ?? 0) > 1);
    const entregadoHistorico = [...historial.values()]
      .flat()
      .filter(({ estado }) => estado.operativo === "entregado")
      .reduce((suma, { pedido }) => suma + pedido.neto, 0);

    const listaNegra = ventas.filter(({ pedido }) => pedido.listaNegra);
    const resumenListaNegra = resumir(listaNegra);

    const zonas: ZonaFila[] = [...agrupar(ventas, ({ pedido }) => pedido.zona).entries()]
      .map(([zona, grupo]) => {
        const valores = resumir(grupo);
        return {
          zona,
          ventas: valores.ventas,
          facturacion: valores.facturacion,
          participacion: division(valores.facturacion, total.facturacion),
          ticket: division(valores.facturacion, valores.ventas),
          efectividadEntrega: division(valores.entregados, valores.entregados + valores.rechazados),
        };
      })
      .sort((a, b) => b.facturacion - a.facturacion);

    const departamentos: DepartamentoFila[] = [
      ...agrupar(ventas, ({ pedido }) => pedido.departamento).entries(),
    ]
      .map(([departamento, grupo]) => {
        const valores = resumir(grupo);
        return {
          departamento,
          zona: grupo[0].pedido.zona,
          ventas: valores.ventas,
          facturacion: valores.facturacion,
          participacion: division(valores.facturacion, total.facturacion),
          ticket: division(valores.facturacion, valores.ventas),
          efectividadEntrega: division(valores.entregados, valores.entregados + valores.rechazados),
        };
      })
      .sort((a, b) => b.ventas - a.ventas);

    const metodosPago: MetodoPagoFila[] = [
      ...agrupar(ventas, ({ pedido }) => pedido.metodoPago).entries(),
    ]
      .map(([metodo, grupo]) => ({
        metodo,
        pedidos: grupo.length,
        facturacion: grupo.reduce((suma, { pedido }) => suma + pedido.neto, 0),
      }))
      .sort((a, b) => b.facturacion - a.facturacion);

    const mejoresClientes: MejorClienteFila[] = [...historial.entries()]
      .map(([clienteId, grupo]) => ({
        clienteId,
        nombre: grupo[0].pedido.clienteNombre,
        departamento: grupo[0].pedido.departamento,
        pedidos: grupo.length,
        entregado: grupo
          .filter(({ estado }) => estado.operativo === "entregado")
          .reduce((suma, { pedido }) => suma + pedido.neto, 0),
        rechazosPrevios: grupo.filter(({ estado }) => estado.operativo === "rechazado").length,
      }))
      .sort((a, b) => b.entregado - a.entregado || b.pedidos - a.pedidos)
      .slice(0, 10);

    const panel: ClientesZonasPanel = {
      historial: { disponible: true, desde: universo.inicio },
      kpis: {
        conCompra: clientes.size,
        nuevos: nuevos.length,
        recurrentes: recurrentes.length,
        recompra: division(conRecompra.length, clientes.size),
        valorHistoricoPorCliente: division(entregadoHistorico, clientes.size),
        listaNegraPedidos: listaNegra.length,
        efectividadListaNegra: division(
          resumenListaNegra.entregados,
          resumenListaNegra.entregados + resumenListaNegra.rechazados,
        ),
        efectividadTotal: division(total.entregados, total.entregados + total.rechazados),
      },
      zonas,
      departamentos,
      metodosPago,
      mejoresClientes,
    };

    return {
      actual: panel,
      anterior_misma_antiguedad: null,
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
