import { aFila } from "../../detalle/sources/detalle.demo";
import { metaMensualVendedora, ventasDeVendedoras } from "../../equipo/sources/equipo.demo";
import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import { instanteAnterior, pedidosEnRango } from "../../shared/data/demo/demo-consultas";
import { obtenerUniversoDemo, type UniversoDemo } from "../../shared/data/demo/demo-universe";
import { asesorForzado } from "../../shared/data/panel-identidad";
import type { PanelSource } from "../../shared/data/panel-source";
import { ESTADOS_PANEL } from "../../shared/models/estado-pedido.model";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import { diffDays } from "../../shared/utils/lima-time";
import type { MisVentasPanel } from "../models/mis-ventas.model";

const division = (a: number, b: number): number | null => (b > 0 ? a / b : null);

function construir(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
  t: number,
  asesorId: string,
): MisVentasPanel {
  const { asesor: _identidad, ...consultaEquipo } = query;
  const equipo = ventasDeVendedoras(
    pedidosEnRango(universo, consultaEquipo, desde, hasta, t),
  ).filter(({ pedido }) => pedido.asesorId !== null);
  const mias = equipo.filter(({ pedido }) => pedido.asesorId === asesorId);
  const facturacion = mias.reduce((total, { pedido }) => total + pedido.neto, 0);
  const entregados = mias.filter(({ estado }) => estado.operativo === "entregado").length;
  const rechazados = mias.filter(({ estado }) => estado.operativo === "rechazado").length;
  const metaPeriodo = Math.round(
    (metaMensualVendedora(asesorId) * (diffDays(desde, hasta) + 1)) / 30,
  );

  const porAsesora = new Map<string, number>();
  for (const { pedido } of equipo) {
    const clave = pedido.asesorId as string;
    porAsesora.set(clave, (porAsesora.get(clave) ?? 0) + pedido.neto);
  }
  if (!porAsesora.has(asesorId)) porAsesora.set(asesorId, 0);
  const ordenado = [...porAsesora.entries()].sort((a, b) => b[1] - a[1]);
  const puesto = ordenado.findIndex(([id]) => id === asesorId) + 1;

  return {
    asesorId,
    puesto: puesto || null,
    totalVendedoras: ordenado.length,
    vendi: { facturacion, ventas: mias.length, ticket: division(facturacion, mias.length) },
    meta: {
      metaPeriodo,
      avance: division(facturacion, metaPeriodo),
      falta: Math.max(0, metaPeriodo - facturacion),
    },
    pagado: {
      pagado: mias
        .filter(({ estado }) => estado.cobro === "pagado")
        .reduce((total, { pedido }) => total + pedido.neto, 0),
      efectividadEntrega: division(entregados, entregados + rechazados),
      perdido: mias
        .filter(({ estado }) => estado.cobro === "perdido" || estado.cobro === "reembolsado")
        .reduce((total, { pedido }) => total + pedido.neto, 0),
    },
    porEstado: ESTADOS_PANEL.map((estado) => ({
      estado,
      pedidos: mias.filter((item) => item.estado.estado === estado).length,
    })).filter((fila) => fila.pedidos > 0),
    ranking: ordenado.map(([id, monto], indice) => ({
      asesorId: id === asesorId ? id : `vendedora-${indice + 1}`,
      nombre: id === asesorId ? (mias[0]?.pedido.asesorNombre ?? "Yo") : `Vendedora ${indice + 1}`,
      facturacion: monto,
      esYo: id === asesorId,
    })),
    noCobrados: mias
      .filter(({ estado }) => estado.cobro === "por_liquidar" || estado.cobro === "en_curso")
      .sort((a, b) => b.pedido.ts - a.pedido.ts)
      .map(aFila),
  };
}

export const misVentasDemoSource: PanelSource<"mis-ventas"> = {
  contractId: "mis-ventas",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/mis-ventas no existe todavía. Ventas de la vendedora autenticada; el resto del ranking va anónimo",
  fetch: async (query, context) => {
    const asesorId = asesorForzado(context);
    if (!asesorId) throw new Error("403: Mis ventas requiere la identidad de una vendedora");
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const consulta = { ...query, asesor: asesorId };
    return {
      actual: construir(universo, consulta, query.desde, query.hasta, context.now, asesorId),
      anterior_misma_antiguedad: construir(
        universo,
        consulta,
        query.anterior_desde,
        query.anterior_hasta,
        instanteAnterior(query, context.now),
        asesorId,
      ),
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
