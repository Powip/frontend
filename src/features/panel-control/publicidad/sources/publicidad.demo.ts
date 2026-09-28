import { sesionesDemo } from "../../canales/sources/canales-demo-calculos";
import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import {
  canalCoincideFiltros,
  diasDelRango,
  filtrosNoAtribuiblesAPauta,
  instanteAnterior,
  type PedidoConEstado,
  pedidosEnRango,
  repartirPauta,
  totalPauta,
} from "../../shared/data/demo/demo-consultas";
import {
  comisionPedido,
  obtenerUniversoDemo,
  type UniversoDemo,
} from "../../shared/data/demo/demo-universe";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import type {
  PublicidadCanalFila,
  PublicidadDia,
  PublicidadPanel,
  RegistroPautaDia,
} from "../models/publicidad.model";

const division = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const redondear = (valor: number) => Math.round(valor * 100) / 100;

function construir(
  universo: UniversoDemo,
  query: PanelQuery,
  items: PedidoConEstado[],
  verCostos: boolean,
  verComisiones: boolean,
  now: number,
): PublicidadPanel {
  const reparto = repartirPauta(universo, query, query.desde, query.hasta, items);
  const ventas = items.filter(({ estado }) => estado.venta);
  const facturacionTotal = ventas.reduce((total, { pedido }) => total + pedido.neto, 0);
  const canalesConPauta = new Set(
    universo.canales
      .filter((canal) => (reparto.porCanal.get(canal.id)?.total ?? 0) > 0)
      .map((canal) => canal.id),
  );
  const ventasConPauta = ventas.filter(
    ({ pedido }) => pedido.canalId && canalesConPauta.has(pedido.canalId),
  );
  const facturacionConPauta = ventasConPauta.reduce((total, { pedido }) => total + pedido.neto, 0);
  const invertido = totalPauta(reparto);
  const directa = [...reparto.porCanal.values()].reduce((total, valor) => total + valor.directa, 0);
  const general = redondear(
    [...reparto.porCanal.values()].reduce((total, valor) => total + valor.general, 0),
  );

  const porCanal: PublicidadCanalFila[] = universo.canales
    .filter((canal) => canalCoincideFiltros(canal, query))
    .map((canal) => {
      const pauta = reparto.porCanal.get(canal.id) ?? { directa: 0, general: 0, total: 0 };
      const propias = ventas.filter(({ pedido }) => pedido.canalId === canal.id);
      const facturacion = propias.reduce((total, { pedido }) => total + pedido.neto, 0);
      const comision = redondear(
        propias.reduce((total, { pedido }) => total + comisionPedido(pedido), 0),
      );
      const fila: PublicidadCanalFila = {
        canalId: canal.id,
        canalNombre: canal.nombre,
        pautaDirecta: pauta.directa,
        pautaGeneralEstimada: pauta.general,
        totalInvertido: redondear(pauta.total),
        ventas: propias.length,
        facturacion,
        costoPorVenta: pauta.total > 0 && propias.length > 0 ? pauta.total / propias.length : null,
        retorno: division(facturacion, pauta.total),
      };
      if (verComisiones) fila.comision = comision;
      if (verCostos) {
        const entregado = propias
          .filter(({ estado }) => estado.operativo === "entregado")
          .reduce((total, { pedido }) => total + pedido.neto, 0);
        fila.ganancia = redondear(entregado - pauta.total - comision);
      }
      return { fila, relevante: pauta.total > 0 || comision > 0 };
    })
    .filter(({ relevante }) => relevante)
    .map(({ fila }) => fila);

  const soloCanalesFiltrados = !!(query.canal || query.entrada || query.cobro);
  const porDia: PublicidadDia[] = diasDelRango(query.desde, query.hasta).map((dia) => {
    const registros = universo.pauta.filter(
      (registro) =>
        registro.dia === dia &&
        (!query.tienda || registro.tiendaId === query.tienda) &&
        (registro.canalId === null
          ? !soloCanalesFiltrados
          : canalCoincideFiltros(
              universo.canales.find((canal) => canal.id === registro.canalId) ??
                universo.canales[0],
              query,
            )),
    );
    const invertidoDia = registros.reduce((total, registro) => total + registro.monto, 0);
    const delDia = ventasConPauta.filter(({ pedido }) => pedido.dia === dia);
    const agrupados = new Map<string, RegistroPautaDia>();
    for (const registro of registros) {
      const tipo: RegistroPautaDia["tipo"] =
        registro.canalId === null ? "general" : registro.sesionId ? "live" : "directa";
      const clave = `${registro.canalId ?? "general"}|${tipo}`;
      const actual = agrupados.get(clave) ?? {
        canalId: registro.canalId,
        canalNombre:
          universo.canales.find((canal) => canal.id === registro.canalId)?.nombre ?? null,
        tipo,
        monto: 0,
      };
      actual.monto += registro.monto;
      agrupados.set(clave, actual);
    }
    return {
      dia,
      invertido: invertidoDia,
      vendido: delDia.reduce((total, { pedido }) => total + pedido.neto, 0),
      ventas: delDia.length,
      costoPorVenta: invertidoDia > 0 && delDia.length > 0 ? invertidoDia / delDia.length : null,
      registros: [...agrupados.values()]
        .filter((registro) => registro.monto > 0)
        .sort((a, b) => b.monto - a.monto),
    };
  });

  const kpis: PublicidadPanel["kpis"] = {
    invertido,
    pautaDirecta: directa,
    pautaGeneralEstimada: general,
    pautaGeneralRegistrada: soloCanalesFiltrados ? general : reparto.generalRegistrada,
    pautaGeneralSinAsignar: soloCanalesFiltrados ? 0 : reparto.generalSinAsignar,
    retornoPublicidad: division(facturacionConPauta, invertido),
    ventasEnCanalesConPauta: ventasConPauta.length,
    facturacionEnCanalesConPauta: facturacionConPauta,
    costoPorVenta:
      invertido > 0 && ventasConPauta.length > 0 ? invertido / ventasConPauta.length : null,
    porcentajeDeLaVenta: division(invertido, facturacionTotal),
  };
  if (verComisiones) {
    kpis.comisionesPlataformas = redondear(
      ventas.reduce((total, { pedido }) => total + comisionPedido(pedido), 0),
    );
  }

  return {
    canalesConPauta: [...canalesConPauta],
    kpis,
    porCanal,
    porDia,
    sesionesLive: sesionesDemo(universo, query, now),
    inversionNoSeparable: filtrosNoAtribuiblesAPauta(query),
  };
}

export const publicidadDemoSource: PanelSource<"publicidad"> = {
  contractId: "publicidad",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: GET /panel/publicidad no existe todavía. Pauta registrada demo y ventas del mismo conjunto de pedidos",
  fetch: async (query, context) => {
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const verCostos = context.capabilities.has("ver_costos");
    const verComisiones = context.capabilities.has("ver_comisiones");
    const tAnterior = instanteAnterior(query, context.now);
    const actuales = pedidosEnRango(universo, query, query.desde, query.hasta, context.now);
    const anteriorQuery = { ...query, desde: query.anterior_desde, hasta: query.anterior_hasta };
    const anteriores = pedidosEnRango(
      universo,
      query,
      query.anterior_desde,
      query.anterior_hasta,
      tAnterior,
    );
    return {
      actual: construir(universo, query, actuales, verCostos, verComisiones, context.now),
      anterior_misma_antiguedad: construir(
        universo,
        anteriorQuery,
        anteriores,
        verCostos,
        verComisiones,
        tAnterior,
      ),
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
