import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import {
  bucketAntiguedadCola,
  cumpleAccion,
  despachadoEl,
  diasDelRango,
  ETAPA_META_HORAS,
  enColaOperativa,
  entregaMedible,
  horasEtapa,
  inicioEstadoCola,
  instanteAnterior,
  inventarioDemo,
  mapaProductos,
  mediana,
  type PedidoConEstado,
  pedidosActuales,
  pedidosEnRango,
  productosAgotados,
} from "../../shared/data/demo/demo-consultas";
import {
  COURIER_SIN_PLAZO,
  obtenerUniversoDemo,
  SIN_MOTIVO,
  type UniversoDemo,
} from "../../shared/data/demo/demo-universe";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import {
  ACCION_POR_ESTADO_COLA,
  BUCKETS_ANTIGUEDAD,
  type BucketAntiguedad,
  type ColaPanel,
  ESTADOS_COLA,
  type EstadoCola,
  ETAPAS_OPERATIVAS,
} from "../models/cola.model";
import type {
  CourierFila,
  CouriersPanel,
  EfectividadDepartamentoFila,
  ScoreCourier,
  TipoCourier,
} from "../models/couriers.model";
import type { InventarioFila, InventarioPanel } from "../models/inventario.model";

const DIA = 24 * 3_600_000;
const META_EFECTIVIDAD = METAS_ESPECIFICACION.indicadores.efectividad_entrega.valor;

const division = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const redondear = (valor: number) => Math.round(valor * 100) / 100;

export const TIPO_COURIER_DEMO: Record<string, TipoCourier> = {
  "Motorizado demo": "propio",
  "Courier demo A": "api",
  "Courier demo B": "manual",
  [COURIER_SIN_PLAZO]: "manual",
  "Fulfillment marketplace": "marketplace",
};

export function scoreCourier(efectividad: number | null): ScoreCourier | null {
  if (efectividad === null) return null;
  if (efectividad >= 0.9) return "A";
  if (efectividad >= META_EFECTIVIDAD) return "B";
  if (efectividad >= META_EFECTIVIDAD - 0.07) return "C";
  return "D";
}

function actualesHasta(universo: UniversoDemo, query: PanelQuery, t: number) {
  return pedidosActuales(universo, query, t).filter(({ pedido }) => pedido.ts <= t);
}

function construirCola(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
  t: number,
): ColaPanel {
  const actuales = actualesHasta(universo, query, t);
  const agotados = productosAgotados(universo, query);
  const cola = actuales.filter(enColaOperativa);
  const periodo = pedidosEnRango(universo, query, desde, hasta, t);
  const entregas = periodo.filter(entregaMedible);
  const ciclos = entregas
    .map(({ pedido }) => horasEtapa(pedido, "ciclo_total"))
    .filter((horas): horas is number => horas !== null);
  const conCourier = periodo.filter(({ pedido, estado }) => estado.venta && pedido.usaCourier);
  const entregados = conCourier.filter(({ estado }) => estado.operativo === "entregado").length;
  const rechazados = conCourier.filter(({ estado }) => estado.operativo === "rechazado");
  const cicloMediano = mediana(ciclos);

  const motivos = new Map<string, number>();
  for (const { pedido } of rechazados) {
    const motivo = pedido.motivoRechazo ?? SIN_MOTIVO;
    motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1);
  }

  return {
    kpis: {
      colaActiva: cola.length,
      sinGuiaMas24h: actuales.filter((item) => cumpleAccion("ventas_sin_guia", item, t, agotados))
        .length,
      enviosRetrasados: actuales.filter((item) =>
        cumpleAccion("envios_retrasados", item, t, agotados),
      ).length,
      enviosSinTiempoNormal: cola.filter(
        ({ pedido, estado }) => estado.estado === "EN_ENVIO" && pedido.tiempoNormalDias === null,
      ).length,
      diasConfirmadoAEntregado: cicloMediano === null ? null : cicloMediano / 24,
      entregasMedidas: ciclos.length,
      entregados,
      rechazados: rechazados.length,
      incidenciaRechazo: division(rechazados.length, entregados + rechazados.length),
    },
    matriz: ESTADOS_COLA.map((estado) => {
      const enEstado = cola.filter((item) => item.estado.estado === estado);
      const porAntiguedad = Object.fromEntries(
        BUCKETS_ANTIGUEDAD.map((bucket) => [bucket, 0]),
      ) as Record<BucketAntiguedad, number>;
      let sinFecha = 0;
      for (const { pedido } of enEstado) {
        const inicio = inicioEstadoCola(pedido, estado as EstadoCola);
        if (inicio === null) sinFecha += 1;
        else porAntiguedad[bucketAntiguedadCola((t - inicio) / DIA)] += 1;
      }
      return {
        estado,
        accion: ACCION_POR_ESTADO_COLA[estado],
        porAntiguedad,
        total: enEstado.length,
        sinFecha,
      };
    }),
    tiemposPorEtapa: ETAPAS_OPERATIVAS.map((etapa) => {
      const horas = entregas
        .map(({ pedido }) => horasEtapa(pedido, etapa))
        .filter((valor): valor is number => valor !== null);
      return {
        etapa,
        medianaHoras: mediana(horas),
        metaHoras: ETAPA_META_HORAS[etapa],
        pedidosMedidos: horas.length,
        sobreMeta: horas.filter((valor) => valor > ETAPA_META_HORAS[etapa]).length,
        sinFechas: entregas.length - horas.length,
      };
    }),
    despachosPorDia: diasDelRango(desde, hasta).map((dia) => ({
      dia,
      despachados: actuales.filter(
        ({ pedido, estado }) => estado.venta && pedido.usaCourier && despachadoEl(pedido, dia, t),
      ).length,
    })),
    motivosRechazo: [...motivos.entries()]
      .map(([motivo, pedidos]) => ({ motivo, sinMotivo: motivo === SIN_MOTIVO, pedidos }))
      .sort((a, b) => Number(a.sinMotivo) - Number(b.sinMotivo) || b.pedidos - a.pedidos),
  };
}

interface AgregadoEnvios {
  envios: number;
  entregados: number;
  rechazados: number;
  enTransito: number;
  primerIntentoOk: number;
  primerIntentoConocido: number;
  dias: number[];
  flete: number;
  fleteRechazos: number;
  neto: number;
}

function agregarEnvios(items: PedidoConEstado[]): AgregadoEnvios {
  const agregado: AgregadoEnvios = {
    envios: 0,
    entregados: 0,
    rechazados: 0,
    enTransito: 0,
    primerIntentoOk: 0,
    primerIntentoConocido: 0,
    dias: [],
    flete: 0,
    fleteRechazos: 0,
    neto: 0,
  };
  for (const { pedido, estado } of items) {
    const operativo = estado.operativo;
    if (operativo !== "en_envio" && operativo !== "entregado" && operativo !== "rechazado")
      continue;
    agregado.envios += 1;
    agregado.flete += estado.flete;
    agregado.neto += pedido.neto;
    if (operativo === "en_envio") agregado.enTransito += 1;
    if (operativo === "rechazado") {
      agregado.rechazados += 1;
      agregado.fleteRechazos += estado.flete;
    }
    if (operativo === "entregado") {
      agregado.entregados += 1;
      if (pedido.primerIntento !== null) {
        agregado.primerIntentoConocido += 1;
        if (pedido.primerIntento) agregado.primerIntentoOk += 1;
      }
      if (pedido.tDesp !== null && pedido.tEnt !== null) {
        agregado.dias.push((pedido.tEnt - pedido.tDesp) / DIA);
      }
    }
  }
  return agregado;
}

const efectividad = (agregado: AgregadoEnvios) =>
  division(agregado.entregados, agregado.entregados + agregado.rechazados);

const promedio = (valores: number[]) =>
  valores.length ? valores.reduce((total, valor) => total + valor, 0) / valores.length : null;

function agrupar<K>(items: PedidoConEstado[], clave: (item: PedidoConEstado) => K) {
  const mapa = new Map<K, PedidoConEstado[]>();
  for (const item of items) mapa.set(clave(item), [...(mapa.get(clave(item)) ?? []), item]);
  return mapa;
}

function construirCouriers(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
  t: number,
  verCostos: boolean,
): CouriersPanel {
  const conCourier = pedidosEnRango(universo, query, desde, hasta, t).filter(
    ({ pedido, estado }) => estado.venta && pedido.usaCourier && pedido.courier !== null,
  );
  const total = agregarEnvios(conCourier);
  const porLiquidar = actualesHasta(universo, query, t).filter(
    ({ estado }) => estado.cobro === "por_liquidar",
  );
  const suma = (items: PedidoConEstado[]) =>
    items.reduce((acumulado, { pedido }) => acumulado + pedido.neto, 0);
  const vencidos = porLiquidar.filter(({ estado }) => estado.vencido);

  const kpis: CouriersPanel["kpis"] = {
    envios: total.envios,
    entregados: total.entregados,
    rechazados: total.rechazados,
    enTransito: total.enTransito,
    efectividadEntrega: efectividad(total),
    primerIntento: division(total.primerIntentoOk, total.primerIntentoConocido),
    entregasSinDatoPrimerIntento: total.entregados - total.primerIntentoConocido,
    diasEntrega: promedio(total.dias),
    porLiquidar: suma(porLiquidar),
    pedidosPorLiquidar: porLiquidar.length,
    liquidacionVencida: suma(vencidos),
    pedidosVencidos: vencidos.length,
    porLiquidarSinPlazo: suma(
      porLiquidar.filter(({ pedido }) => pedido.plazoLiquidacionDias === null),
    ),
  };
  if (verCostos) {
    kpis.fleteTotal = total.flete;
    kpis.fletePromedio = division(total.flete, total.envios);
  }

  const porCourier = agrupar(conCourier, ({ pedido }) => pedido.courier as string);
  const liquidarPorCourier = agrupar(porLiquidar, ({ pedido }) => pedido.courier ?? "Sin courier");
  const nombres = [...new Set([...porCourier.keys(), ...liquidarPorCourier.keys()])];

  const couriers: CourierFila[] = nombres
    .map((nombre) => {
      const grupo = porCourier.get(nombre) ?? [];
      const pendiente = liquidarPorCourier.get(nombre) ?? [];
      const muestra = grupo[0]?.pedido ?? pendiente[0]?.pedido;
      const agregado = agregarEnvios(grupo);
      const plazo = muestra?.plazoLiquidacionDias ?? null;
      const fila: CourierFila = {
        courierId: nombre,
        nombre,
        tipo: TIPO_COURIER_DEMO[nombre] ?? null,
        plazoLiquidacionDias: plazo,
        tiempoNormalDias: muestra?.tiempoNormalDias ?? null,
        envios: agregado.envios,
        entregados: agregado.entregados,
        rechazados: agregado.rechazados,
        enTransito: agregado.enTransito,
        efectividad: efectividad(agregado),
        primerIntento: division(agregado.primerIntentoOk, agregado.primerIntentoConocido),
        diasPromedio: promedio(agregado.dias),
        porLiquidar: suma(pendiente),
        vencido: plazo === null ? null : suma(pendiente.filter(({ estado }) => estado.vencido)),
        score: scoreCourier(efectividad(agregado)),
      };
      if (verCostos) {
        fila.fleteTotal = agregado.flete;
        fila.fletePromedio = division(agregado.flete, agregado.envios);
        fila.costoRechazos = agregado.fleteRechazos;
      }
      return fila;
    })
    .sort((a, b) => b.envios - a.envios);

  const departamentos: EfectividadDepartamentoFila[] = [
    ...agrupar(conCourier, ({ pedido }) => pedido.departamento).entries(),
  ]
    .map(([departamento, grupo]) => {
      const agregado = agregarEnvios(grupo);
      const principal = [
        ...agrupar(grupo, ({ pedido }) => pedido.courier as string).entries(),
      ].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
      const fila: EfectividadDepartamentoFila = {
        departamento,
        envios: agregado.envios,
        entregados: agregado.entregados,
        rechazados: agregado.rechazados,
        efectividad: efectividad(agregado),
        courierPrincipal: principal ?? null,
        ticket: division(agregado.neto, agregado.envios),
      };
      if (verCostos) fila.fletePromedio = division(agregado.flete, agregado.envios);
      return fila;
    })
    .filter((fila) => fila.envios > 0)
    .sort((a, b) => b.envios - a.envios);

  return { kpis, couriers, departamentos };
}

function construirInventario(
  universo: UniversoDemo,
  query: PanelQuery,
  t: number,
  verCostos: boolean,
): InventarioPanel {
  const agotados = productosAgotados(universo, query);
  const esperando = actualesHasta(universo, query, t).filter((item) =>
    cumpleAccion("productos_agotados", item, t, agotados),
  );
  const productos: InventarioFila[] = inventarioDemo(universo, query, t)
    .map((fila) => {
      const resultado: InventarioFila = {
        productoId: fila.producto.id,
        sku: fila.producto.sku,
        nombre: fila.producto.nombre,
        tiendaId: fila.producto.tiendaId,
        stock: fila.producto.stock,
        reservado: fila.reservado,
        disponible: fila.disponible,
        unidades30Dias: fila.unidades30Dias,
        ventaDiaria: fila.ventaDiaria,
        coberturaDias: fila.estado === "error_datos" ? null : fila.coberturaDias,
        estado: fila.estado,
      };
      if (verCostos) {
        resultado.costoUnitario = fila.producto.costo;
        resultado.valor =
          fila.producto.costo === null || fila.estado === "error_datos"
            ? null
            : redondear(Math.max(0, fila.producto.stock) * fila.producto.costo);
      }
      return resultado;
    })
    .sort(
      (a, b) =>
        Number(b.estado === "error_datos") - Number(a.estado === "error_datos") ||
        (a.coberturaDias ?? Number.POSITIVE_INFINITY) -
          (b.coberturaDias ?? Number.POSITIVE_INFINITY),
    );

  const kpis: InventarioPanel["kpis"] = {
    productos: productos.length,
    sinCosto: [...mapaProductos(universo).values()].filter(
      (producto) =>
        (!query.tienda || producto.tiendaId === query.tienda) && producto.costo === null,
    ).length,
    agotados: productos.filter((fila) => fila.estado === "agotado").length,
    criticos: productos.filter((fila) => fila.estado === "critico").length,
    erroresDatos: productos.filter((fila) => fila.estado === "error_datos").length,
    ventasEsperandoStock: esperando.length,
  };
  if (verCostos) {
    kpis.valorAlCosto = redondear(productos.reduce((total, fila) => total + (fila.valor ?? 0), 0));
  }
  return { kpis, productos };
}

export const operacionesColaDemoSource: PanelSource<"operaciones-cola"> = {
  contractId: "operaciones-cola",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/operaciones?sub=cola no existe todavía. La cola y la matriz son el estado actual del mismo conjunto de pedidos demo",
  fetch: async (query, context) => {
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const tAnterior = instanteAnterior(query, context.now);
    return {
      actual: construirCola(universo, query, query.desde, query.hasta, context.now),
      anterior_misma_antiguedad: construirCola(
        universo,
        query,
        query.anterior_desde,
        query.anterior_hasta,
        tAnterior,
      ),
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};

export const operacionesCouriersDemoSource: PanelSource<"operaciones-couriers"> = {
  contractId: "operaciones-couriers",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/operaciones?sub=couriers no existe todavía. Envíos por fecha de ingreso; por liquidar y vencido son estado actual",
  fetch: async (query, context) => {
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const verCostos = context.capabilities.has("ver_costos");
    const tAnterior = instanteAnterior(query, context.now);
    return {
      actual: construirCouriers(universo, query, query.desde, query.hasta, context.now, verCostos),
      anterior_misma_antiguedad: construirCouriers(
        universo,
        query,
        query.anterior_desde,
        query.anterior_hasta,
        tAnterior,
        verCostos,
      ),
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};

export const operacionesInventarioDemoSource: PanelSource<"operaciones-inventario"> = {
  contractId: "operaciones-inventario",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/operaciones?sub=inventario no existe todavía. Stock demo por tienda; reservado y venta diaria salen de los pedidos demo",
  fetch: async (query, context) => {
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    return {
      actual: construirInventario(
        universo,
        query,
        context.now,
        context.capabilities.has("ver_costos"),
      ),
      anterior_misma_antiguedad: null,
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
