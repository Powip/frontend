import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import {
  mapaProductos,
  type PedidoConEstado,
  pedidosEnRango,
  repartirPauta,
  seleccionarGrupo,
} from "../../shared/data/demo/demo-consultas";
import {
  obtenerUniversoDemo,
  type ProductoDemo,
  SIN_MOTIVO,
} from "../../shared/data/demo/demo-universe";
import type { PanelSource } from "../../shared/data/panel-source";
import type {
  CanalBloqueEspecifico,
  CanalDetalle,
  CierreCajaDia,
  MotivoPerdida,
  VendedoraCanalFila,
} from "../models/canal-detalle.model";
import type {
  CanalEntregasFila,
  CanalesComparativo,
  CanalGananciaFila,
  CanalVentasFila,
} from "../models/canales-comparativo.model";
import {
  agregar,
  agruparPorCanal,
  division,
  efectividad,
  fichaDemo,
  gananciaCanal,
  metaPeriodo,
  participacionPauta,
  sesionesDemo,
  tendenciaSemanal,
} from "./canales-demo-calculos";

const redondear = (valor: number) => Math.round(valor * 100) / 100;

export const canalesComparativoDemoSource: PanelSource<"canales-comparativo"> = {
  contractId: "canales-comparativo",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/canales no existe todavía. Salen del mismo conjunto de pedidos demo que Resumen",
  fetch: async (query, context) => {
    const { vista, ...panelQuery } = query;
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const productos = mapaProductos(universo);
    const verCostos = context.capabilities.has("ver_costos");
    if (vista === "ganancia" && !verCostos) {
      throw new Error("403: la vista Ganancia solo está disponible para el Dueño");
    }
    const items = pedidosEnRango(
      universo,
      panelQuery,
      panelQuery.desde,
      panelQuery.hasta,
      context.now,
    );
    const porCanal = agruparPorCanal(items);
    const total = agregar(items, productos);
    const canalesById = new Map(universo.canales.map((canal) => [canal.id, canal]));
    const ids = [
      ...universo.canales.filter((canal) => porCanal.has(canal.id)).map((canal) => canal.id),
      ...(porCanal.has(null) ? [null] : []),
    ];
    const canales = universo.canales
      .filter((canal) => porCanal.has(canal.id))
      .map((canal) => fichaDemo(canal, context.capabilities.has("ver_comisiones"), true));
    const { series, semanaEnCurso } = tendenciaSemanal(universo, panelQuery, context.now);
    const base = { canales, tendencia: series, semanaEnCurso };

    if (vista === "ventas") {
      const filas: CanalVentasFila[] = ids.map((id) => {
        const canal = id ? canalesById.get(id) : undefined;
        const agregado = agregar(porCanal.get(id) ?? [], productos);
        const meta = metaPeriodo(canal, panelQuery);
        const esLead = canal?.entrada === "lead";
        return {
          canalId: id,
          leads: esLead ? agregado.leads : null,
          confirmacion: esLead
            ? division(agregado.confirmados, agregado.confirmados + agregado.anulados)
            : null,
          ventas: agregado.ventas,
          facturacion: agregado.facturacion,
          participacion: division(agregado.facturacion, total.facturacion),
          unidades: agregado.unidades,
          ticket: division(agregado.facturacion, agregado.ventas),
          descuentos: agregado.descuentos,
          upsell: agregado.upsell,
          metaPeriodo: meta,
          avanceMeta: meta ? division(agregado.facturacion, meta) : null,
        };
      });
      const metaTotal = filas.reduce((suma, fila) => suma + (fila.metaPeriodo ?? 0), 0);
      return {
        actual: {
          ...base,
          vista,
          filas,
          total: {
            leads: total.leads,
            confirmacion: division(total.confirmados, total.confirmados + total.anulados),
            ventas: total.ventas,
            facturacion: total.facturacion,
            participacion: total.facturacion ? 1 : null,
            unidades: total.unidades,
            ticket: division(total.facturacion, total.ventas),
            descuentos: total.descuentos,
            upsell: total.upsell,
            metaPeriodo: metaTotal || null,
            avanceMeta: division(total.facturacion, metaTotal),
          },
        } satisfies CanalesComparativo,
        anterior_misma_antiguedad: null,
        metas: METAS_ESPECIFICACION,
        generado_en: new Date(context.now).toISOString(),
      };
    }

    if (vista === "entregas") {
      const fila = (
        id: string | null,
        agregado: ReturnType<typeof agregar>,
        usaCourier: boolean,
      ) => {
        const resultado: Omit<CanalEntregasFila, "canalId"> = {
          ventas: agregado.ventas,
          enCurso: agregado.enCurso,
          entregados: agregado.entregados,
          rechazados: agregado.rechazados,
          efectividadEntrega: usaCourier ? efectividad(agregado) : null,
          primerIntento: usaCourier
            ? division(agregado.primerIntentoOk, agregado.primerIntentoConocido)
            : null,
          pagado: agregado.pagado,
          porCobrar: agregado.porCobrar,
          perdido: agregado.perdido,
        };
        if (verCostos) resultado.flete = agregado.flete;
        return { canalId: id, ...resultado };
      };
      const filas = ids.map((id) =>
        fila(
          id,
          agregar(porCanal.get(id) ?? [], productos),
          id ? (canalesById.get(id)?.usaCourier ?? true) : true,
        ),
      );
      const { canalId: _omitido, ...totalFila } = fila(null, total, true);
      return {
        actual: { ...base, vista, filas, total: totalFila } satisfies CanalesComparativo,
        anterior_misma_antiguedad: null,
        metas: METAS_ESPECIFICACION,
        generado_en: new Date(context.now).toISOString(),
      };
    }

    const reparto = repartirPauta(universo, panelQuery, panelQuery.desde, panelQuery.hasta, items);
    const filaGanancia = (
      id: string | null,
      agregado: ReturnType<typeof agregar>,
      directa: number,
      general: number,
    ) => {
      const pauta = directa + general;
      const ganancia = gananciaCanal(agregado, pauta);
      return {
        canalId: id,
        facturacion: agregado.facturacion,
        entregado: agregado.entregadoMonto,
        costoProducto: agregado.costo,
        costoIncompleto: agregado.costoIncompleto,
        pautaDirecta: directa,
        pautaGeneralEstimada: redondear(general),
        comision: agregado.comision,
        flete: agregado.flete,
        ganancia,
        gananciaParcial: agregado.costoIncompleto,
        margen: division(ganancia, agregado.entregadoMonto),
        retornoPublicidad: division(agregado.facturacion, pauta),
        costoPorVenta: pauta > 0 && agregado.ventas > 0 ? pauta / agregado.ventas : null,
      } satisfies CanalGananciaFila;
    };
    const filas = ids.map((id) => {
      const pauta = id ? participacionPauta(reparto, id) : { directa: 0, general: 0, total: 0 };
      return filaGanancia(
        id,
        agregar(porCanal.get(id) ?? [], productos),
        pauta.directa,
        pauta.general,
      );
    });
    const directaTotal = filas.reduce((suma, fila) => suma + fila.pautaDirecta, 0);
    const generalTotal = filas.reduce((suma, fila) => suma + fila.pautaGeneralEstimada, 0);
    const { canalId: _sinId, ...totalGanancia } = filaGanancia(
      null,
      total,
      directaTotal,
      generalTotal,
    );
    return {
      actual: {
        ...base,
        vista: "ganancia",
        filas,
        total: totalGanancia,
      } satisfies CanalesComparativo,
      anterior_misma_antiguedad: null,
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};

function perdidas(items: PedidoConEstado[]): MotivoPerdida[] {
  const conteo = new Map<string, MotivoPerdida>();
  for (const { pedido, estado } of items) {
    if (estado.estado === "ANULADO") {
      const motivo = pedido.motivoAnulacion ?? SIN_MOTIVO;
      const clave = `anulado|${motivo}`;
      const actual = conteo.get(clave) ?? { tipo: "anulado", motivo, pedidos: 0 };
      conteo.set(clave, { ...actual, pedidos: actual.pedidos + 1 });
    } else if (estado.operativo === "rechazado" && pedido.motivoRechazo) {
      const clave = `rechazado|${pedido.motivoRechazo}`;
      const actual = conteo.get(clave) ?? {
        tipo: "rechazado",
        motivo: pedido.motivoRechazo,
        pedidos: 0,
      };
      conteo.set(clave, { ...actual, pedidos: actual.pedidos + 1 });
    }
  }
  return [...conteo.values()].sort((a, b) => b.pedidos - a.pedidos).slice(0, 8);
}

function cierresCaja(items: PedidoConEstado[]): { metodos: string[]; cierres: CierreCajaDia[] } {
  const metodos = new Set<string>();
  const porDia = new Map<string, CierreCajaDia>();
  for (const { pedido, estado } of items) {
    if (!estado.venta) continue;
    metodos.add(pedido.metodoPago);
    const dia = porDia.get(pedido.dia) ?? {
      dia: pedido.dia,
      tickets: 0,
      porMetodo: {},
      total: 0,
      ticketPromedio: null,
    };
    dia.tickets += 1;
    dia.total += pedido.neto;
    dia.porMetodo[pedido.metodoPago] = (dia.porMetodo[pedido.metodoPago] ?? 0) + pedido.neto;
    dia.ticketPromedio = dia.total / dia.tickets;
    porDia.set(pedido.dia, dia);
  }
  return {
    metodos: [...metodos].sort(),
    cierres: [...porDia.values()].sort((a, b) => b.dia.localeCompare(a.dia)),
  };
}

function vendedoras(
  items: PedidoConEstado[],
  productos: Map<string, ProductoDemo>,
): VendedoraCanalFila[] {
  const porAsesor = new Map<string, PedidoConEstado[]>();
  for (const item of items) {
    if (!item.estado.venta) continue;
    const clave = item.pedido.asesorId ?? "";
    porAsesor.set(clave, [...(porAsesor.get(clave) ?? []), item]);
  }
  return [...porAsesor.entries()]
    .map(([clave, grupo]) => {
      const agregado = agregar(grupo, productos);
      return {
        asesorId: clave || null,
        asesorNombre: grupo[0].pedido.asesorNombre ?? "Automático",
        ventas: agregado.ventas,
        facturacion: agregado.facturacion,
        ticket: division(agregado.facturacion, agregado.ventas),
        tasaUpsell: division(agregado.conUpsell, agregado.ventas),
        efectividadEntrega: efectividad(agregado),
        pagado: agregado.pagado,
      };
    })
    .sort((a, b) => b.ventas - a.ventas);
}

export const canalesDetalleDemoSource: PanelSource<"canales-detalle"> = {
  contractId: "canales-detalle",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/canales/{id} no existe todavía. Salen del mismo conjunto de pedidos demo",
  fetch: async (query, context) => {
    const { canal_id, ...panelQuery } = query;
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const canal = universo.canales.find((item) => item.id === canal_id);
    if (!canal) throw new Error("Canal sin datos demo");
    const productos = mapaProductos(universo);
    const verCostos = context.capabilities.has("ver_costos");
    const verComisiones = context.capabilities.has("ver_comisiones");
    const todos = pedidosEnRango(
      universo,
      panelQuery,
      panelQuery.desde,
      panelQuery.hasta,
      context.now,
    );
    const propios = todos.filter(({ pedido }) => pedido.canalId === canal.id);
    const agregado = agregar(propios, productos);
    const total = agregar(todos, productos);
    const meta = metaPeriodo(canal, panelQuery);

    let bloque: CanalBloqueEspecifico;
    if (canal.esLive) {
      bloque = {
        tipo: "live",
        sesiones: sesionesDemo(universo, { ...panelQuery, canal: canal.id }, context.now),
      };
    } else if (canal.entrada === "lead") {
      bloque = {
        tipo: "lead",
        embudo: [
          { etapa: "recibidos", pedidos: agregado.leads },
          {
            etapa: "contactados",
            pedidos: seleccionarGrupo(
              universo,
              panelQuery,
              "contactados",
              { canal: canal.id },
              context.now,
            ).length,
          },
          { etapa: "llamados", pedidos: agregado.confirmados },
          { etapa: "entregados", pedidos: agregado.entregados },
        ],
        perdidas: perdidas(propios),
      };
    } else if (canal.entrada === "presencial") {
      bloque = { tipo: "presencial", ...cierresCaja(propios) };
    } else if (canal.cobro === "mkp") {
      const pendientes = propios.filter(({ estado }) => estado.cobro === "por_liquidar");
      const bruto = pendientes.reduce((suma, { pedido }) => suma + pedido.neto, 0);
      const comision = redondear(
        pendientes.reduce((suma, { pedido }) => suma + pedido.neto * pedido.comisionPct, 0),
      );
      bloque = {
        tipo: "marketplace",
        porLiquidarBruto: bruto,
        pedidosPorLiquidar: pendientes.length,
        plazoDias: 14,
        ...(verComisiones
          ? { comisionADescontar: comision, netoARecibir: redondear(bruto - comision) }
          : {}),
      };
    } else if (canal.cobro === "pre") {
      const reembolsados = propios.filter(({ estado }) => estado.cobro === "reembolsado");
      bloque = {
        tipo: "prepago",
        cobrado: agregado.pagado,
        reembolsos: reembolsados.reduce((suma, { pedido }) => suma + pedido.neto, 0),
        pedidosReembolsados: reembolsados.length,
        ...(verComisiones
          ? {
              pasarela: redondear(
                propios
                  .filter(({ estado }) => estado.venta)
                  .reduce((suma, { pedido }) => suma + pedido.neto * pedido.pasarelaPct, 0),
              ),
            }
          : {}),
      };
    } else {
      bloque = { tipo: "conversacional", vendedoras: vendedoras(propios, productos) };
    }

    const detalle: CanalDetalle = {
      ficha: fichaDemo(canal, verComisiones, propios.length > 0),
      kpis: {
        leads: canal.entrada === "lead" ? agregado.leads : null,
        confirmacion:
          canal.entrada === "lead"
            ? division(agregado.confirmados, agregado.confirmados + agregado.anulados)
            : null,
        ventas: agregado.ventas,
        facturacion: agregado.facturacion,
        participacion: division(agregado.facturacion, total.facturacion),
        metaPeriodo: meta,
        avanceMeta: meta ? division(agregado.facturacion, meta) : null,
        ticket: division(agregado.facturacion, agregado.ventas),
        unidades: agregado.unidades,
        efectividadEntrega: canal.usaCourier ? efectividad(agregado) : null,
        cobradoEnCaja: canal.usaCourier ? null : agregado.pagado,
      },
      bloque,
    };

    if (verCostos) {
      const reparto = repartirPauta(
        universo,
        panelQuery,
        panelQuery.desde,
        panelQuery.hasta,
        todos,
      );
      const pauta = participacionPauta(reparto, canal.id);
      const ganancia = gananciaCanal(agregado, pauta.total);
      detalle.costos = {
        pautaDirecta: pauta.directa,
        pautaGeneralEstimada: pauta.general,
        publicidad: redondear(pauta.total),
        comision: agregado.comision,
        flete: agregado.flete,
        costoCanal: redondear(pauta.total + agregado.comision + agregado.flete),
        ganancia,
        gananciaParcial: agregado.costoIncompleto,
        margen: division(ganancia, agregado.entregadoMonto),
        retornoPublicidad: division(agregado.facturacion, pauta.total),
      };
    }

    return {
      actual: detalle,
      anterior_misma_antiguedad: null,
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
