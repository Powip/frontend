import { canalesComparativoDemoSource } from "../../canales/sources/canales.demo";
import { resumenDemoSource } from "../../resumen/sources/resumen.demo";
import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import {
  bucketDeuda,
  type ConceptoCaja,
  GASTOS_FIJOS_MENSUALES_DEMO_POR_TIENDA,
  movimientosCaja,
} from "../../shared/data/demo/demo-caja";
import {
  canalCoincideFiltros,
  diasDelRango,
  fechaEnRango,
  instanteAnterior,
  type PedidoConEstado,
  pedidosActuales,
  pedidosEnRango,
  repartirPauta,
} from "../../shared/data/demo/demo-consultas";
import { obtenerUniversoDemo, type UniversoDemo } from "../../shared/data/demo/demo-universe";
import type { PanelSource, PanelSourceContext } from "../../shared/data/panel-source";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import {
  addMonthsToMonthStart,
  diffDays,
  endOfMonthKey,
  minDayKey,
  startOfMonthKey,
  toLimaDayKey,
} from "../../shared/utils/lima-time";
import {
  type CajaMovimiento,
  type CajaPanel,
  CONCEPTOS_EGRESO_CAJA,
  type ConceptoEgresoCaja,
  FUENTES_INGRESO_CAJA,
  type FuenteIngresoCaja,
} from "../models/caja.model";
import {
  BUCKETS_DEUDA,
  type CobranzaPanel,
  type LiquidacionPendienteFila,
} from "../models/cobranza.model";
import type { ResultadoPanel } from "../models/resultado.model";

const DIA = 24 * 3_600_000;
const MESES_EVOLUCION = 6;

const division = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const redondear = (valor: number) => Math.round(valor * 100) / 100;
const suma = (items: PedidoConEstado[]) =>
  items.reduce((total, { pedido }) => total + pedido.neto, 0);

export function filtrosSinGastosFijos(query: PanelQuery): boolean {
  return !!(
    query.canal ||
    query.entrada ||
    query.cobro ||
    query.zona ||
    query.turno ||
    query.asesor
  );
}

export function gastosFijosMensualesDemo(
  context: PanelSourceContext,
  query: PanelQuery,
): number | null {
  if (filtrosSinGastosFijos(query)) return null;
  const tiendas = query.tienda ? 1 : Math.max(1, context.catalogo.tiendas.length);
  return GASTOS_FIJOS_MENSUALES_DEMO_POR_TIENDA * tiendas;
}

function facturadoAlDinero(items: PedidoConEstado[]): ResultadoPanel["facturadoAlDinero"] {
  const ventas = items.filter(({ estado }) => estado.venta);
  const porCobro = (cobro: string) => ventas.filter(({ estado }) => estado.cobro === cobro);
  return {
    facturado: suma(ventas),
    entregado: suma(ventas.filter(({ estado }) => estado.operativo === "entregado")),
    pagado: suma(porCobro("pagado")),
    porLiquidar: suma(porCobro("por_liquidar")),
    vencido: suma(porCobro("por_liquidar").filter(({ estado }) => estado.vencido)),
    enCurso: suma(porCobro("en_curso")),
    perdido: suma(porCobro("perdido")),
    reembolsado: suma(porCobro("reembolsado")),
    adelantosRecibidos: null,
  };
}

function evolucionMensual(
  universo: UniversoDemo,
  query: PanelQuery,
  t: number,
): ResultadoPanel["evolucionMensual"] {
  const hoy = toLimaDayKey(t);
  const mesActual = startOfMonthKey(hoy);
  return Array.from({ length: MESES_EVOLUCION }, (_, index) => {
    const inicio = addMonthsToMonthStart(mesActual, index - (MESES_EVOLUCION - 1));
    const fin = minDayKey(endOfMonthKey(inicio), hoy);
    const items = pedidosEnRango(universo, query, inicio, fin, t);
    const dinero = facturadoAlDinero(items);
    return {
      mes: inicio.slice(0, 7),
      enCurso: inicio === mesActual,
      facturado: dinero.facturado,
      entregado: dinero.entregado,
      pagado: dinero.pagado,
    };
  });
}

async function construirResultado(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
  t: number,
  context: PanelSourceContext,
  anterior: boolean,
): Promise<ResultadoPanel | null> {
  const consulta = anterior
    ? { ...query, desde: query.anterior_desde, hasta: query.anterior_hasta }
    : query;
  const resumen = await resumenDemoSource.fetch(query, context);
  const gane = anterior ? resumen.anterior_misma_antiguedad?.gane : resumen.actual.gane;
  if (!gane) return null;
  const comparativo = await canalesComparativoDemoSource.fetch(
    { ...query, vista: "ganancia" },
    context,
  );
  const ganancia = anterior ? comparativo.anterior_misma_antiguedad : comparativo.actual;
  const items = pedidosEnRango(universo, consulta, desde, hasta, t);
  const reparto = repartirPauta(universo, consulta, desde, hasta, items);
  let directa = 0;
  let general = 0;
  for (const valor of reparto.porCanal.values()) {
    directa += valor.directa;
    general += valor.general;
  }
  const diasPeriodo = diffDays(desde, hasta) + 1;
  const mensual = gastosFijosMensualesDemo(context, query);
  const gastosFijos = mensual === null ? null : redondear((mensual * diasPeriodo) / 30);
  const entregados = items.filter(({ estado }) => estado.operativo === "entregado").length;
  const rechazados = items.filter(({ estado }) => estado.operativo === "rechazado");
  const gananciaPorEntrega = division(gane.ganancia, entregados);
  const entregasNecesarias =
    gastosFijos !== null && gananciaPorEntrega !== null && gananciaPorEntrega > 0
      ? Math.ceil(gastosFijos / gananciaPorEntrega)
      : null;
  const nombres = new Map(
    (ganancia?.canales ?? []).map((ficha) => [ficha.id, ficha.nombre] as const),
  );

  return {
    diasPeriodo,
    facturadoAlDinero: facturadoAlDinero(items),
    estadoResultados: {
      ventaEntregada: gane.entregado,
      costoProducto: gane.costoProducto,
      entregasSinCosto: gane.entregasSinCosto,
      publicidadDirecta: redondear(directa),
      publicidadGeneralEstimada: redondear(general),
      envios: gane.flete,
      comisiones: gane.comisiones,
      ganancia: gane.ganancia,
      gananciaParcial: gane.entregasSinCosto > 0,
      gastosFijos,
      gastosFijosMensuales: mensual,
      utilidadOperativa: gastosFijos === null ? null : redondear(gane.ganancia - gastosFijos),
    },
    puntoEquilibrio: {
      gananciaPorEntrega,
      entregasNecesarias,
      entregasLogradas: entregados,
      margenSeguridad:
        entregasNecesarias !== null ? division(entregados - entregasNecesarias, entregados) : null,
      fletePromedioPorRechazo: division(
        rechazados.reduce((total, { estado }) => total + estado.flete, 0),
        rechazados.length,
      ),
    },
    evolucionMensual: anterior ? [] : evolucionMensual(universo, query, t),
    rentabilidadPorCanal:
      ganancia?.vista === "ganancia"
        ? ganancia.filas.map((fila) => ({
            canalId: fila.canalId,
            canalNombre: fila.canalId ? (nombres.get(fila.canalId) ?? fila.canalId) : "Sin canal",
            entregado: fila.entregado,
            ganancia: fila.ganancia,
            gananciaParcial: fila.gananciaParcial,
            margen: fila.margen,
            retornoPublicidad: fila.retornoPublicidad,
          }))
        : [],
  };
}

function pautaEnRango(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
): { dia: string; monto: number }[] {
  const soloCanales = !!(query.canal || query.entrada || query.cobro);
  return universo.pauta
    .filter((registro) => {
      if (registro.dia < desde || registro.dia > hasta) return false;
      if (query.tienda && registro.tiendaId !== query.tienda) return false;
      if (registro.canalId === null) return !soloCanales;
      const canal = universo.canales.find((item) => item.id === registro.canalId);
      return canal ? canalCoincideFiltros(canal, query) : false;
    })
    .map((registro) => ({ dia: registro.dia, monto: registro.monto }));
}

function construirCaja(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
  t: number,
  context: PanelSourceContext,
): CajaPanel {
  const pedidos = pedidosActuales(universo, query, t).filter(({ pedido }) => pedido.ts <= t);
  const dias = diasDelRango(desde, hasta).filter((dia) => dia <= toLimaDayKey(t));
  const entroPorDia = new Map(dias.map((dia) => [dia, 0]));
  const salioPorDia = new Map(dias.map((dia) => [dia, 0]));

  const acumular = (concepto: ConceptoCaja, destino: Map<string, number>) => {
    let monto = 0;
    let conteo = 0;
    for (const { pedido } of pedidos) {
      let tiene = false;
      for (const movimiento of movimientosCaja(pedido, concepto)) {
        if (!fechaEnRango(movimiento.fecha, desde, hasta, t)) continue;
        monto += movimiento.monto;
        tiene = true;
        const dia = toLimaDayKey(movimiento.fecha);
        destino.set(dia, (destino.get(dia) ?? 0) + movimiento.monto);
      }
      if (tiene) conteo += 1;
    }
    return { monto: redondear(monto), pedidos: conteo };
  };

  const entradas: CajaMovimiento<FuenteIngresoCaja>[] = FUENTES_INGRESO_CAJA.map((concepto) =>
    concepto === "adelantos"
      ? { concepto, monto: null, pedidos: null }
      : { concepto, ...acumular(concepto, entroPorDia) },
  );

  const noSeparable = !!(query.zona || query.turno || query.asesor);
  const mensual = gastosFijosMensualesDemo(context, query);
  const salidas: CajaMovimiento<ConceptoEgresoCaja>[] = CONCEPTOS_EGRESO_CAJA.map((concepto) => {
    if (concepto === "publicidad") {
      if (noSeparable) return { concepto, monto: null, pedidos: null };
      const registros = pautaEnRango(universo, query, desde, hasta);
      for (const registro of registros) {
        salioPorDia.set(registro.dia, (salioPorDia.get(registro.dia) ?? 0) + registro.monto);
      }
      return {
        concepto,
        monto: redondear(registros.reduce((total, registro) => total + registro.monto, 0)),
        pedidos: null,
      };
    }
    if (concepto === "gastos_fijos") {
      if (mensual === null) return { concepto, monto: null, pedidos: null };
      const diario = mensual / 30;
      for (const dia of dias) salioPorDia.set(dia, (salioPorDia.get(dia) ?? 0) + diario);
      return { concepto, monto: redondear(diario * dias.length), pedidos: null };
    }
    return { concepto, ...acumular(concepto, salioPorDia) };
  });

  const totalEntro = redondear(entradas.reduce((total, fila) => total + (fila.monto ?? 0), 0));
  const totalSalio = redondear(salidas.reduce((total, fila) => total + (fila.monto ?? 0), 0));
  return {
    entradas,
    salidas,
    totalEntro,
    totalSalio,
    netoCaja: redondear(totalEntro - totalSalio),
    promedioDiarioEntra: division(totalEntro, dias.length),
    dias: dias.length,
    porDia: dias.map((dia) => ({
      dia,
      entro: redondear(entroPorDia.get(dia) ?? 0),
      salio: redondear(salioPorDia.get(dia) ?? 0),
    })),
    incluyeComprasMercaderia: false,
  };
}

function construirCobranza(universo: UniversoDemo, query: PanelQuery, t: number): CobranzaPanel {
  const actuales = pedidosActuales(universo, query, t).filter(({ pedido }) => pedido.ts <= t);
  const porLiquidar = actuales.filter(({ estado }) => estado.cobro === "por_liquidar");
  const vencidos = porLiquidar.filter(({ estado }) => estado.vencido);
  const enCurso = actuales.filter(({ estado }) => estado.cobro === "en_curso");
  const antiguedadDias = ({ pedido }: PedidoConEstado) =>
    pedido.tEnt === null ? 0 : Math.floor((t - pedido.tEnt) / DIA);

  const porCourier = new Map<string, PedidoConEstado[]>();
  for (const item of porLiquidar) {
    const clave = item.pedido.courier ?? "Sin courier";
    porCourier.set(clave, [...(porCourier.get(clave) ?? []), item]);
  }
  const liquidacionesPendientes: LiquidacionPendienteFila[] = [...porCourier.entries()]
    .map(([courier, grupo]) => {
      const plazo = grupo[0].pedido.plazoLiquidacionDias;
      return {
        courierId: courier,
        courier,
        plazoDias: plazo,
        pedidos: grupo.length,
        monto: suma(grupo),
        diasMasAntiguo: Math.max(...grupo.map(antiguedadDias)),
        vencido: plazo === null ? null : suma(grupo.filter(({ estado }) => estado.vencido)),
      };
    })
    .sort((a, b) => b.monto - a.monto);

  return {
    kpis: {
      porLiquidar: suma(porLiquidar),
      pedidosPorLiquidar: porLiquidar.length,
      vencido: suma(vencidos),
      pedidosVencidos: vencidos.length,
      enCurso: suma(enCurso),
      pedidosEnCurso: enCurso.length,
      adelantosDeNoEntregadas: null,
      porLiquidarSinPlazo: suma(
        porLiquidar.filter(({ pedido }) => pedido.plazoLiquidacionDias === null),
      ),
    },
    liquidacionesPendientes,
    antiguedad: BUCKETS_DEUDA.map((bucket) => {
      const grupo = porLiquidar.filter((item) => bucketDeuda(antiguedadDias(item)) === bucket);
      return { bucket, monto: suma(grupo), pedidos: grupo.length };
    }),
  };
}

export const finanzasResultadoDemoSource: PanelSource<"finanzas-resultado"> = {
  contractId: "finanzas-resultado",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/finanzas?reloj=pedido no existe todavía. Mismo cálculo que «Gané» de Resumen; gastos fijos de demostración",
  fetch: async (query, context) => {
    if (!context.capabilities.has("ver_finanzas")) {
      throw new Error("403: Finanzas es solo para el Dueño");
    }
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const actual = await construirResultado(
      universo,
      query,
      query.desde,
      query.hasta,
      context.now,
      context,
      false,
    );
    if (!actual) throw new Error("Sin datos de ganancia para este periodo");
    return {
      actual,
      anterior_misma_antiguedad: await construirResultado(
        universo,
        query,
        query.anterior_desde,
        query.anterior_hasta,
        instanteAnterior(query, context.now),
        context,
        true,
      ),
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};

export const finanzasCajaDemoSource: PanelSource<"finanzas-caja"> = {
  contractId: "finanzas-caja",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/finanzas?reloj=caja no existe todavía. Cada movimiento va en la fecha en que entró o salió el dinero",
  fetch: async (query, context) => {
    if (!context.capabilities.has("ver_finanzas")) {
      throw new Error("403: Finanzas es solo para el Dueño");
    }
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const tAnterior = instanteAnterior(query, context.now);
    return {
      actual: construirCaja(universo, query, query.desde, query.hasta, context.now, context),
      anterior_misma_antiguedad: construirCaja(
        universo,
        query,
        query.anterior_desde,
        query.anterior_hasta,
        tAnterior,
        context,
      ),
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};

export const finanzasCobranzaDemoSource: PanelSource<"finanzas-cobranza"> = {
  contractId: "finanzas-cobranza",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/finanzas?reloj=cobranza no existe todavía. Estado actual: no depende del periodo",
  fetch: async (query, context) => {
    if (!context.capabilities.has("ver_finanzas")) {
      throw new Error("403: Finanzas es solo para el Dueño");
    }
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    return {
      actual: construirCobranza(universo, query, context.now),
      anterior_misma_antiguedad: null,
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
