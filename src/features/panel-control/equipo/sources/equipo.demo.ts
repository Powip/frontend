import {
  metaMensualConfirmadora,
  resumirLeads,
  tasaConfirmacion,
} from "../../call-center/sources/call-center.demo";
import { ZONA_LABEL } from "../../shared/config/filter-labels.config";
import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import {
  instanteAnterior,
  mediana,
  type PedidoConEstado,
  pedidosEnRango,
} from "../../shared/data/demo/demo-consultas";
import { obtenerUniversoDemo, type UniversoDemo } from "../../shared/data/demo/demo-universe";
import { hashSeed } from "../../shared/data/demo/seeded-random";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import { diffDays } from "../../shared/utils/lima-time";
import type {
  AgrupacionEquipo,
  ConfirmadoraEquipoFila,
  EquipoConfirmadorasPanel,
  EquipoVendedorasPanel,
  ModoUpsell,
  VendedoraGrupo,
  VendedoraMetricas,
} from "../models/equipo.model";

export const COMISION_VENDEDORA = { porcentajePagado: 0.03, porcentajeUpsell: 0.1 };
export const COMISION_CONFIRMADORA = { porEntrega: 1.5, porcentajeUpsell: 0.1 };

const division = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const redondear = (valor: number) => Math.round(valor * 100) / 100;

export function metaMensualVendedora(asesorId: string): number {
  return 50000 + (hashSeed(`meta-vendedora|${asesorId}`) % 11) * 2000;
}

const upsellDe = ({ pedido }: PedidoConEstado) =>
  pedido.items.filter((linea) => linea.esUpsell).reduce((total, linea) => total + linea.neto, 0);

function monto(item: PedidoConEstado, upsell: ModoUpsell): number {
  return upsell === "con" ? item.pedido.neto : item.pedido.neto - upsellDe(item);
}

function metricas(
  items: PedidoConEstado[],
  totalPedidos: number,
  upsell: ModoUpsell,
  metaPeriodo: number | null,
  verComisiones: boolean,
): VendedoraMetricas {
  const sumar = (filtro: (item: PedidoConEstado) => boolean) =>
    items.filter(filtro).reduce((total, item) => total + monto(item, upsell), 0);
  const entregados = items.filter(({ estado }) => estado.operativo === "entregado");
  const rechazados = items.filter(({ estado }) => estado.operativo === "rechazado").length;
  const pagado = sumar(({ estado }) => estado.cobro === "pagado");
  const pendiente = sumar(
    ({ estado }) => estado.cobro === "por_liquidar" || estado.cobro === "en_curso",
  );
  const perdido = sumar(
    ({ estado }) => estado.cobro === "perdido" || estado.cobro === "reembolsado",
  );
  const total = pagado + pendiente + perdido;
  const conUpsell = items.filter((item) => upsellDe(item) > 0);
  const upsellPagado = conUpsell
    .filter(({ estado }) => estado.cobro === "pagado")
    .reduce((acumulado, item) => acumulado + upsellDe(item), 0);
  const entregadosConUpsell = conUpsell.filter(
    ({ estado }) => estado.operativo === "entregado",
  ).length;
  const rechazadosConUpsell = conUpsell.filter(
    ({ estado }) => estado.operativo === "rechazado",
  ).length;
  const resultado: VendedoraMetricas = {
    pedidos: items.length,
    participacion: division(items.length, totalPedidos),
    entregados: entregados.length,
    efectividadEntrega: division(entregados.length, entregados.length + rechazados),
    pagado,
    pendiente,
    perdido,
    total,
    porcentajePagado: division(pagado, total),
    upsellPagado,
    conUpsell: conUpsell.length,
    tasaUpsell: division(conUpsell.length, items.length),
    entregaConUpsell: division(entregadosConUpsell, entregadosConUpsell + rechazadosConUpsell),
    ticketEntregado: division(
      entregados.reduce((acumulado, item) => acumulado + monto(item, upsell), 0),
      entregados.length,
    ),
    metaPeriodo,
    avanceMeta: metaPeriodo ? division(total, metaPeriodo) : null,
  };
  if (verComisiones) {
    resultado.comisionEstimada = redondear(
      pagado * COMISION_VENDEDORA.porcentajePagado +
        upsellPagado * COMISION_VENDEDORA.porcentajeUpsell,
    );
  }
  return resultado;
}

function agrupar<K>(items: PedidoConEstado[], clave: (item: PedidoConEstado) => K) {
  const mapa = new Map<K, PedidoConEstado[]>();
  for (const item of items) mapa.set(clave(item), [...(mapa.get(clave(item)) ?? []), item]);
  return mapa;
}

export function ventasDeVendedoras(items: PedidoConEstado[]): PedidoConEstado[] {
  return items.filter(({ pedido, estado }) => estado.venta && pedido.entrada !== "lead");
}

function construirVendedoras(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
  t: number,
  agrupacion: AgrupacionEquipo,
  upsell: ModoUpsell,
  verComisiones: boolean,
): EquipoVendedorasPanel {
  const ventas = ventasDeVendedoras(pedidosEnRango(universo, query, desde, hasta, t));
  const automaticas = ventas.filter(({ pedido }) => pedido.asesorId === null);
  const conAsesor = ventas.filter(({ pedido }) => pedido.asesorId !== null);
  const dias = diffDays(desde, hasta) + 1;
  const metaDe = (asesorId: string | null) =>
    asesorId ? Math.round((metaMensualVendedora(asesorId) * dias) / 30) : null;
  const rolDe = (grupo: PedidoConEstado[]): VendedoraGrupo["rol"] =>
    grupo.filter(({ pedido }) => pedido.entrada === "presencial").length * 2 > grupo.length
      ? "caja"
      : "vendedora";
  const nombreDe = (grupo: PedidoConEstado[]) => grupo[0]?.pedido.asesorNombre ?? "Sin asesora";

  const porZona = (grupo: PedidoConEstado[]) =>
    [...agrupar(grupo, ({ pedido }) => pedido.zona).entries()].sort(
      (a, b) => b[1].length - a[1].length,
    );
  const porAsesora = (grupo: PedidoConEstado[]) =>
    [...agrupar(grupo, ({ pedido }) => pedido.asesorId as string).entries()].sort(
      (a, b) => b[1].length - a[1].length,
    );

  const grupos: VendedoraGrupo[] =
    agrupacion === "zona"
      ? porZona(conAsesor).map(([zona, grupo]) => ({
          clave: zona,
          etiqueta: ZONA_LABEL[zona],
          asesorId: null,
          rol: null,
          metricas: metricas(grupo, conAsesor.length, upsell, null, verComisiones),
          hijos: porAsesora(grupo).map(([asesorId, hijos]) => ({
            clave: `${zona}|${asesorId}`,
            etiqueta: nombreDe(hijos),
            asesorId,
            rol: rolDe(hijos),
            metricas: metricas(hijos, conAsesor.length, upsell, null, verComisiones),
          })),
        }))
      : porAsesora(conAsesor).map(([asesorId, grupo]) => ({
          clave: asesorId,
          etiqueta: nombreDe(grupo),
          asesorId,
          rol: rolDe(grupo),
          metricas: metricas(grupo, conAsesor.length, upsell, metaDe(asesorId), verComisiones),
          hijos: porZona(grupo).map(([zona, hijos]) => ({
            clave: `${asesorId}|${zona}`,
            etiqueta: ZONA_LABEL[zona],
            asesorId,
            rol: null,
            metricas: metricas(hijos, conAsesor.length, upsell, null, verComisiones),
          })),
        }));

  const total = metricas(conAsesor, conAsesor.length, upsell, null, verComisiones);
  const sumarCobro = (cobro: string) =>
    conAsesor
      .filter(({ estado }) => estado.cobro === cobro)
      .reduce((acumulado, item) => acumulado + monto(item, upsell), 0);
  return {
    agrupacion,
    upsell,
    kpis: {
      pagado: total.pagado,
      pendiente: total.pendiente,
      enCurso: sumarCobro("en_curso"),
      porLiquidar: sumarCobro("por_liquidar"),
      perdido: total.perdido,
      total: total.total,
      ventas: total.pedidos,
      upsell: conAsesor.reduce((acumulado, item) => acumulado + upsellDe(item), 0),
    },
    grupos,
    total,
    automaticas: {
      ventas: automaticas.length,
      facturacion: automaticas.reduce((acumulado, { pedido }) => acumulado + pedido.neto, 0),
    },
  };
}

function construirConfirmadoras(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
  t: number,
  verComisiones: boolean,
): EquipoConfirmadorasPanel {
  const leads = pedidosEnRango(universo, query, desde, hasta, t).filter(
    ({ pedido }) => pedido.entrada === "lead",
  );
  const dias = diffDays(desde, hasta) + 1;
  const upsellPagadoDe = (grupo: PedidoConEstado[]) =>
    grupo
      .filter(({ estado }) => estado.venta && estado.cobro === "pagado")
      .reduce((total, item) => total + upsellDe(item), 0);

  const fila = (
    grupo: PedidoConEstado[],
    metaPeriodo: number | null,
  ): Omit<ConfirmadoraEquipoFila, "asesorId" | "asesorNombre"> => {
    const resumen = resumirLeads(grupo, t);
    const upsellPagado = upsellPagadoDe(grupo);
    const resultado: Omit<ConfirmadoraEquipoFila, "asesorId" | "asesorNombre"> = {
      asignados: resumen.leads,
      contactacion: division(resumen.contactados, resumen.trabajados),
      confirmados: resumen.confirmados,
      confirmacion: tasaConfirmacion(resumen),
      tiempoPrimeraLlamadaMin: mediana(resumen.minutos),
      entregados: resumen.entregados,
      efectividadEntrega: division(resumen.entregados, resumen.entregados + resumen.rechazados),
      anulados: resumen.anulados,
      upsellTasa: division(resumen.conUpsell, resumen.confirmados),
      upsellPagado,
      metaPeriodo,
      avanceMeta: metaPeriodo ? division(resumen.confirmados, metaPeriodo) : null,
    };
    if (verComisiones) {
      resultado.comisionEstimada = redondear(
        resumen.entregados * COMISION_CONFIRMADORA.porEntrega +
          upsellPagado * COMISION_CONFIRMADORA.porcentajeUpsell,
      );
    }
    return resultado;
  };

  const filas: ConfirmadoraEquipoFila[] = [
    ...agrupar(
      leads.filter(({ pedido }) => pedido.asesorId !== null),
      ({ pedido }) => pedido.asesorId as string,
    ).entries(),
  ]
    .map(([asesorId, grupo]) => ({
      asesorId,
      asesorNombre: grupo[0].pedido.asesorNombre ?? asesorId,
      ...fila(grupo, Math.round((metaMensualConfirmadora(asesorId) * dias) / 30)),
    }))
    .sort((a, b) => (b.confirmacion ?? -1) - (a.confirmacion ?? -1));

  const metaTotal = filas.reduce((total, item) => total + (item.metaPeriodo ?? 0), 0);
  const total = fila(leads, metaTotal || null);
  const resumen = resumirLeads(leads, t);
  const panel: EquipoConfirmadorasPanel = {
    kpis: {
      asignados: resumen.leads,
      porConfirmar: resumen.abiertos,
      confirmados: resumen.confirmados,
      confirmacion: tasaConfirmacion(resumen),
      efectividadEntrega: division(resumen.entregados, resumen.entregados + resumen.rechazados),
      upsellMonto: resumen.upsellMonto,
      upsellTasa: division(resumen.conUpsell, resumen.confirmados),
    },
    filas,
    total,
  };
  if (verComisiones) panel.reglaComision = { ...COMISION_CONFIRMADORA };
  return panel;
}

export const equipoVendedorasDemoSource: PanelSource<"equipo-vendedoras"> = {
  contractId: "equipo-vendedoras",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/equipo?tipo=vendedoras no existe todavía. Ventas directas y POS del mismo conjunto de pedidos; metas y comisiones de ejemplo",
  fetch: async (query, context) => {
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const verComisiones = context.capabilities.has("ver_comisiones");
    return {
      actual: construirVendedoras(
        universo,
        query,
        query.desde,
        query.hasta,
        context.now,
        query.agrupar,
        query.upsell,
        verComisiones,
      ),
      anterior_misma_antiguedad: construirVendedoras(
        universo,
        query,
        query.anterior_desde,
        query.anterior_hasta,
        instanteAnterior(query, context.now),
        query.agrupar,
        query.upsell,
        verComisiones,
      ),
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};

export const equipoConfirmadorasDemoSource: PanelSource<"equipo-confirmadoras"> = {
  contractId: "equipo-confirmadoras",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/equipo?tipo=confirmadoras no existe todavía. Mismo cálculo de leads que Call center; comisión de ejemplo",
  fetch: async (query, context) => {
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const verComisiones = context.capabilities.has("ver_comisiones");
    return {
      actual: construirConfirmadoras(
        universo,
        query,
        query.desde,
        query.hasta,
        context.now,
        verComisiones,
      ),
      anterior_misma_antiguedad: construirConfirmadoras(
        universo,
        query,
        query.anterior_desde,
        query.anterior_hasta,
        instanteAnterior(query, context.now),
        verComisiones,
      ),
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
