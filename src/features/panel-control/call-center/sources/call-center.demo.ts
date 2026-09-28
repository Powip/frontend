import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import {
  bucketEsperaLead,
  horaLimaDe,
  instanteAnterior,
  leadContactado,
  leadTrabajado,
  mediana,
  minutosPrimeraLlamada,
  type PedidoConEstado,
  pedidosActuales,
  pedidosEnRango,
} from "../../shared/data/demo/demo-consultas";
import {
  obtenerUniversoDemo,
  SIN_MOTIVO,
  type UniversoDemo,
} from "../../shared/data/demo/demo-universe";
import { hashSeed } from "../../shared/data/demo/seeded-random";
import { asesorForzado, consultaConIdentidad } from "../../shared/data/panel-identidad";
import type { PanelSource } from "../../shared/data/panel-source";
import type { MetasPanel } from "../../shared/models/goal.model";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import { diffDays } from "../../shared/utils/lima-time";
import {
  BUCKETS_ESPERA,
  type CallCenterKpis,
  type CallCenterPanel,
  type CeldaMapaCalor,
  type ConfirmadoraRankingFila,
  type MiDiaConfirmadora,
  type MotivoAnulacionFila,
} from "../models/call-center.model";

const HORA = 3_600_000;
const META_PRIMERA_LLAMADA = METAS_ESPECIFICACION.indicadores.tiempo_primera_llamada.valor;

const division = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function metaMensualConfirmadora(asesorId: string): number {
  return 60 + (hashSeed(`meta-confirmadora|${asesorId}`) % 7) * 5;
}

interface ResumenLeads {
  leads: number;
  trabajados: number;
  contactados: number;
  confirmados: number;
  anulados: number;
  abiertos: number;
  minutos: number[];
  conUpsell: number;
  upsellMonto: number;
  entregados: number;
  rechazados: number;
}

export function resumirLeads(items: PedidoConEstado[], t: number): ResumenLeads {
  const resumen: ResumenLeads = {
    leads: 0,
    trabajados: 0,
    contactados: 0,
    confirmados: 0,
    anulados: 0,
    abiertos: 0,
    minutos: [],
    conUpsell: 0,
    upsellMonto: 0,
    entregados: 0,
    rechazados: 0,
  };
  for (const { pedido, estado } of items) {
    if (pedido.entrada !== "lead") continue;
    resumen.leads += 1;
    if (leadTrabajado(pedido, t)) resumen.trabajados += 1;
    if (leadContactado(pedido, t)) resumen.contactados += 1;
    const minutos = minutosPrimeraLlamada(pedido, t);
    if (minutos !== null) resumen.minutos.push(minutos);
    if (estado.leadAbierto) resumen.abiertos += 1;
    if (estado.estado === "ANULADO") resumen.anulados += 1;
    if (!estado.venta) continue;
    resumen.confirmados += 1;
    const upsell = pedido.items.filter((linea) => linea.esUpsell);
    if (upsell.length) {
      resumen.conUpsell += 1;
      resumen.upsellMonto += upsell.reduce((total, linea) => total + linea.neto, 0);
    }
    if (estado.operativo === "entregado") resumen.entregados += 1;
    if (estado.operativo === "rechazado") resumen.rechazados += 1;
  }
  return resumen;
}

export const tasaConfirmacion = (resumen: ResumenLeads) =>
  division(resumen.confirmados, resumen.confirmados + resumen.anulados);

function kpis(resumen: ResumenLeads, valorLeads: number, cola: PedidoConEstado[]): CallCenterKpis {
  return {
    leadsRecibidos: resumen.leads,
    valorLeads,
    porLlamarAhora: cola.length,
    sinIntentoAhora: cola.filter(({ estado }) => estado.sinIntento).length,
    tiempoPrimeraLlamadaMin: mediana(resumen.minutos),
    leadsConPrimeraLlamada: resumen.minutos.length,
    llamadasTardias: resumen.minutos.filter((minutos) => minutos > META_PRIMERA_LLAMADA).length,
    trabajados: resumen.trabajados,
    contactados: resumen.contactados,
    contactacion: division(resumen.contactados, resumen.trabajados),
    confirmados: resumen.confirmados,
    anulados: resumen.anulados,
    abiertos: resumen.abiertos,
    confirmacion: tasaConfirmacion(resumen),
    confirmadosConUpsell: resumen.conUpsell,
    upsellTasa: division(resumen.conUpsell, resumen.confirmados),
    upsellMonto: resumen.upsellMonto,
  };
}

function agruparPorAsesor(items: PedidoConEstado[]): Map<string | null, PedidoConEstado[]> {
  const grupos = new Map<string | null, PedidoConEstado[]>();
  for (const item of items) {
    const clave = item.pedido.asesorId;
    grupos.set(clave, [...(grupos.get(clave) ?? []), item]);
  }
  return grupos;
}

function ranking(
  leads: PedidoConEstado[],
  t: number,
  diasPeriodo: number,
): ConfirmadoraRankingFila[] {
  return [...agruparPorAsesor(leads).entries()]
    .map(([asesorId, grupo]) => {
      const resumen = resumirLeads(grupo, t);
      return {
        asesorId,
        asesorNombre: asesorId ? (grupo[0].pedido.asesorNombre ?? asesorId) : "Sin asignar",
        asignados: resumen.leads,
        trabajados: resumen.trabajados,
        contactacion: division(resumen.contactados, resumen.trabajados),
        confirmados: resumen.confirmados,
        anulados: resumen.anulados,
        confirmacion: tasaConfirmacion(resumen),
        tiempoPrimeraLlamadaMin: mediana(resumen.minutos),
        upsellTasa: division(resumen.conUpsell, resumen.confirmados),
        upsellMonto: resumen.upsellMonto,
        entregadosDeConfirmados: resumen.entregados,
        rechazadosDeConfirmados: resumen.rechazados,
        entregaDeLoConfirmado: division(
          resumen.entregados,
          resumen.entregados + resumen.rechazados,
        ),
        metaPeriodo: asesorId
          ? Math.round((metaMensualConfirmadora(asesorId) * diasPeriodo) / 30)
          : null,
      };
    })
    .sort(
      (a, b) => (b.confirmacion ?? -1) - (a.confirmacion ?? -1) || b.confirmados - a.confirmados,
    );
}

function motivos(leads: PedidoConEstado[]): MotivoAnulacionFila[] {
  const conteo = new Map<string, number>();
  for (const { pedido, estado } of leads) {
    if (estado.estado !== "ANULADO") continue;
    const motivo = pedido.motivoAnulacion ?? SIN_MOTIVO;
    conteo.set(motivo, (conteo.get(motivo) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([motivo, cantidad]) => ({ motivo, sinMotivo: motivo === SIN_MOTIVO, leads: cantidad }))
    .sort((a, b) => Number(a.sinMotivo) - Number(b.sinMotivo) || b.leads - a.leads);
}

function mapaCalor(leads: PedidoConEstado[]): CeldaMapaCalor[] {
  const celdas = new Map<string, CeldaMapaCalor>();
  for (const { pedido, estado } of leads) {
    const { diaSemana, hora } = horaLimaDe(pedido.ts);
    const clave = `${diaSemana}-${hora}`;
    const celda = celdas.get(clave) ?? {
      diaSemana: diaSemana as CeldaMapaCalor["diaSemana"],
      hora,
      leads: 0,
      confirmados: 0,
      anulados: 0,
      confirmacion: null,
    };
    celda.leads += 1;
    if (estado.venta) celda.confirmados += 1;
    if (estado.estado === "ANULADO") celda.anulados += 1;
    celdas.set(clave, celda);
  }
  return [...celdas.values()]
    .map((celda) => ({
      ...celda,
      confirmacion: division(celda.confirmados, celda.confirmados + celda.anulados),
    }))
    .sort((a, b) => a.diaSemana - b.diaSemana || a.hora - b.hora);
}

function colaLeads(universo: UniversoDemo, query: PanelQuery, t: number): PedidoConEstado[] {
  return pedidosActuales(universo, query, t).filter(
    ({ pedido, estado }) => pedido.ts <= t && estado.leadAbierto,
  );
}

function construir(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
  t: number,
  asesorPropio: string | null,
): CallCenterPanel {
  const leads = pedidosEnRango(universo, query, desde, hasta, t).filter(
    ({ pedido }) => pedido.entrada === "lead",
  );
  const resumen = resumirLeads(leads, t);
  const cola = colaLeads(universo, query, t);
  const diasPeriodo = diffDays(desde, hasta) + 1;
  const listaNegra = leads.filter(({ pedido }) => pedido.listaNegra);
  const resumenListaNegra = resumirLeads(listaNegra, t);

  let miDia: MiDiaConfirmadora | null = null;
  if (asesorPropio) {
    const { asesor: _omitido, ...consultaEquipo } = query;
    const equipo = pedidosEnRango(universo, consultaEquipo, desde, hasta, t).filter(
      ({ pedido }) => pedido.entrada === "lead" && pedido.asesorId !== null,
    );
    const resumenEquipo = resumirLeads(equipo, t);
    const posiciones = ranking(equipo, t, diasPeriodo).filter((fila) => fila.asesorId !== null);
    const indice = posiciones.findIndex((fila) => fila.asesorId === asesorPropio);
    const nombre =
      universo.pedidos.find((pedido) => pedido.asesorId === asesorPropio)?.asesorNombre ??
      asesorPropio;
    miDia = {
      asesorId: asesorPropio,
      asesorNombre: nombre,
      puesto: indice >= 0 ? indice + 1 : null,
      totalConfirmadoras: posiciones.length,
      miCola: cola.length,
      miConfirmacion: tasaConfirmacion(resumen),
      confirmacionEquipo: tasaConfirmacion(resumenEquipo),
      confirmados: resumen.confirmados,
      metaPeriodo: Math.round((metaMensualConfirmadora(asesorPropio) * diasPeriodo) / 30),
      upsellMonto: resumen.upsellMonto,
      upsellTasa: division(resumen.conUpsell, resumen.confirmados),
      upsellTasaEquipo: division(resumenEquipo.conUpsell, resumenEquipo.confirmados),
    };
  }

  return {
    kpis: kpis(
      resumen,
      leads.reduce((total, { pedido }) => total + pedido.neto, 0),
      cola,
    ),
    colaEspera: BUCKETS_ESPERA.map((bucket) => {
      const enBucket = cola.filter(
        ({ pedido }) => bucketEsperaLead((t - pedido.ts) / HORA) === bucket,
      );
      return {
        bucket,
        leads: enBucket.length,
        sinIntento: enBucket.filter(({ estado }) => estado.sinIntento).length,
      };
    }),
    motivosAnulacion: motivos(leads),
    calidad: {
      duplicados: leads.filter(({ pedido }) => pedido.duplicadoDe !== null).length,
      listaNegra: listaNegra.length,
      confirmacionListaNegra: tasaConfirmacion(resumenListaNegra),
      entregaListaNegra: division(
        resumenListaNegra.entregados,
        resumenListaNegra.entregados + resumenListaNegra.rechazados,
      ),
      confirmacionTotal: tasaConfirmacion(resumen),
      entregaTotal: division(resumen.entregados, resumen.entregados + resumen.rechazados),
      anuladosSinMotivo: leads.filter(
        ({ pedido, estado }) => estado.estado === "ANULADO" && pedido.motivoAnulacion === null,
      ).length,
    },
    mapaCalor: mapaCalor(leads),
    ranking: ranking(leads, t, diasPeriodo),
    miDia,
  };
}

function metasDemo(universo: UniversoDemo, asesorPropio: string | null): MetasPanel {
  const asesores = asesorPropio
    ? [asesorPropio]
    : [...new Set(universo.pedidos.map((pedido) => pedido.asesorId))].filter(
        (id): id is string => id !== null,
      );
  return {
    ...METAS_ESPECIFICACION,
    mensuales: {
      ...METAS_ESPECIFICACION.mensuales,
      porConfirmadora: Object.fromEntries(asesores.map((id) => [id, metaMensualConfirmadora(id)])),
    },
  };
}

export const callCenterDemoSource: PanelSource<"callcenter"> = {
  contractId: "callcenter",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/callcenter no existe todavía. Leads del mismo conjunto de pedidos demo que Resumen",
  fetch: async (consulta, context) => {
    const query = consultaConIdentidad(consulta, context);
    const asesorPropio = asesorForzado(context);
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const tAnterior = instanteAnterior(query, context.now);
    return {
      actual: construir(universo, query, query.desde, query.hasta, context.now, asesorPropio),
      anterior_misma_antiguedad: construir(
        universo,
        query,
        query.anterior_desde,
        query.anterior_hasta,
        tAnterior,
        asesorPropio,
      ),
      metas: metasDemo(universo, asesorPropio),
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
