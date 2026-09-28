import {
  type PautaReparto,
  type PedidoConEstado,
  pedidosEnRango,
} from "../../shared/data/demo/demo-consultas";
import {
  type CanalDemo,
  comisionPedido,
  costoPedido,
  OPERATIVOS_EN_CURSO,
  type ProductoDemo,
  type UniversoDemo,
} from "../../shared/data/demo/demo-universe";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import { addDays, diffDays, toLimaDayKey } from "../../shared/utils/lima-time";
import { prorratearMetaMensual } from "../../shared/utils/period";
import type { SesionLive } from "../models/canal-detalle.model";
import type { CanalFicha } from "../models/canal-ficha.model";
import type { TendenciaSemanalSerie } from "../models/canales-comparativo.model";

export interface AgregadoCanal {
  items: PedidoConEstado[];
  ventas: number;
  facturacion: number;
  unidades: number;
  descuentos: number;
  upsell: number;
  conUpsell: number;
  leads: number;
  confirmados: number;
  anulados: number;
  enCurso: number;
  entregados: number;
  entregadoMonto: number;
  rechazados: number;
  perdido: number;
  pagado: number;
  porCobrar: number;
  flete: number;
  primerIntentoOk: number;
  primerIntentoConocido: number;
  costo: number;
  costoIncompleto: boolean;
  comision: number;
}

export function agregar(
  items: PedidoConEstado[],
  productos: Map<string, ProductoDemo>,
): AgregadoCanal {
  const agregado: AgregadoCanal = {
    items,
    ventas: 0,
    facturacion: 0,
    unidades: 0,
    descuentos: 0,
    upsell: 0,
    conUpsell: 0,
    leads: 0,
    confirmados: 0,
    anulados: 0,
    enCurso: 0,
    entregados: 0,
    entregadoMonto: 0,
    rechazados: 0,
    perdido: 0,
    pagado: 0,
    porCobrar: 0,
    flete: 0,
    primerIntentoOk: 0,
    primerIntentoConocido: 0,
    costo: 0,
    costoIncompleto: false,
    comision: 0,
  };
  for (const { pedido, estado } of items) {
    if (pedido.entrada === "lead") {
      agregado.leads += 1;
      if (estado.venta) agregado.confirmados += 1;
      if (estado.estado === "ANULADO") agregado.anulados += 1;
    }
    if (!estado.venta) continue;
    agregado.ventas += 1;
    agregado.facturacion += pedido.neto;
    agregado.unidades += pedido.unidades;
    agregado.descuentos += pedido.items.reduce((total, linea) => total + linea.descuento, 0);
    const upsell = pedido.items.filter((linea) => linea.esUpsell);
    agregado.upsell += upsell.reduce((total, linea) => total + linea.neto, 0);
    if (upsell.length) agregado.conUpsell += 1;
    agregado.flete += estado.flete;
    agregado.comision += comisionPedido(pedido);
    if (estado.operativo && OPERATIVOS_EN_CURSO.includes(estado.operativo)) agregado.enCurso += 1;
    if (estado.operativo === "entregado") {
      agregado.entregados += 1;
      agregado.entregadoMonto += pedido.neto;
      if (pedido.usaCourier && pedido.primerIntento !== null) {
        agregado.primerIntentoConocido += 1;
        if (pedido.primerIntento) agregado.primerIntentoOk += 1;
      }
      const costo = costoPedido(pedido, productos);
      agregado.costo += costo.costo;
      if (!costo.completo) agregado.costoIncompleto = true;
    }
    if (estado.operativo === "rechazado") {
      agregado.rechazados += 1;
      agregado.perdido += pedido.neto;
    }
    if (estado.cobro === "pagado") agregado.pagado += pedido.neto;
    if (estado.cobro === "por_liquidar" || estado.cobro === "en_curso")
      agregado.porCobrar += pedido.neto;
  }
  agregado.comision = Math.round(agregado.comision * 100) / 100;
  return agregado;
}

export const division = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function efectividad(agregado: AgregadoCanal): number | null {
  return division(agregado.entregados, agregado.entregados + agregado.rechazados);
}

export function agruparPorCanal(items: PedidoConEstado[]): Map<string | null, PedidoConEstado[]> {
  const grupos = new Map<string | null, PedidoConEstado[]>();
  for (const item of items) {
    const clave = item.pedido.canalId;
    grupos.set(clave, [...(grupos.get(clave) ?? []), item]);
  }
  return grupos;
}

export function metaPeriodo(canal: CanalDemo | undefined, query: PanelQuery): number | null {
  if (!canal) return null;
  return Math.round(
    prorratearMetaMensual(canal.metaMensual, diffDays(query.desde, query.hasta) + 1),
  );
}

export function fichaDemo(
  canal: CanalDemo,
  verComisiones: boolean,
  tienePedidos: boolean,
): CanalFicha {
  return {
    id: canal.id,
    nombre: canal.nombre,
    clave: canal.id,
    familia: canal.familia,
    color: null,
    entrada: canal.entrada,
    cobro: canal.cobro,
    usaCourier: canal.usaCourier,
    ...(verComisiones ? { comisionPct: canal.comisionPct, pasarelaPct: canal.pasarelaPct } : {}),
    recibePautaGeneral: canal.recibePautaGeneral,
    metaMensual: canal.metaMensual,
    activo: true,
    tienePedidos,
    reglasPorConfirmar: canal.reglasPorConfirmar,
    camposPendientes: [],
  };
}

export function gananciaCanal(agregado: AgregadoCanal, pauta: number): number {
  return (
    Math.round(
      (agregado.entregadoMonto - agregado.costo - pauta - agregado.comision - agregado.flete) * 100,
    ) / 100
  );
}

export function sesionesDemo(universo: UniversoDemo, query: PanelQuery, now: number): SesionLive[] {
  const canalLive = universo.canales.find((canal) => canal.esLive);
  if (!canalLive) return [];
  if (query.canal && query.canal !== canalLive.id) return [];
  if (query.entrada && query.entrada !== canalLive.entrada) return [];
  if (query.cobro && query.cobro !== canalLive.cobro) return [];
  const items = pedidosEnRango(universo, query, query.desde, query.hasta, now).filter(
    ({ pedido }) => pedido.canalId === canalLive.id,
  );
  return universo.sesiones
    .filter(
      (sesion) =>
        sesion.dia >= query.desde &&
        sesion.dia <= query.hasta &&
        (!query.tienda || sesion.tiendaId === query.tienda),
    )
    .sort((a, b) => b.inicio - a.inicio)
    .map((sesion) => {
      const propios = items.filter(({ pedido }) => pedido.sesionId === sesion.id);
      const ventas = propios.filter(({ estado }) => estado.venta);
      const anulados = propios.filter(({ estado }) => estado.estado === "ANULADO").length;
      const facturacion = ventas.reduce((total, { pedido }) => total + pedido.neto, 0);
      return {
        sesionId: sesion.id,
        tiendaId: sesion.tiendaId,
        inicio: new Date(sesion.inicio).toISOString(),
        fin: new Date(sesion.fin).toISOString(),
        inversion: sesion.inversion,
        leads: propios.length,
        llamados: ventas.length,
        confirmacion: division(ventas.length, ventas.length + anulados),
        facturacion,
        retorno: division(facturacion, sesion.inversion),
        costoPorVenta: ventas.length ? sesion.inversion / ventas.length : null,
        cerradosPorOtroCanal: ventas.filter(({ pedido }) => pedido.canalCierreNombre !== null)
          .length,
      };
    });
}

const SEMANAS_TENDENCIA = 12;

function lunes(dia: string): string {
  const fecha = new Date(`${dia}T00:00:00Z`);
  const desplazamiento = (fecha.getUTCDay() + 6) % 7;
  return addDays(dia, -desplazamiento);
}

export function tendenciaSemanal(
  universo: UniversoDemo,
  query: PanelQuery,
  now: number,
): { series: TendenciaSemanalSerie[]; semanaEnCurso: string | null } {
  const hoy = toLimaDayKey(now);
  const ultima = lunes(hoy);
  const semanas = Array.from({ length: SEMANAS_TENDENCIA }, (_, index) =>
    addDays(ultima, -7 * (SEMANAS_TENDENCIA - 1 - index)),
  );
  const items = pedidosEnRango(universo, query, semanas[0], hoy, now).filter(
    ({ estado }) => estado.venta,
  );
  const familiaDe = new Map(universo.canales.map((canal) => [canal.id, canal.familia as string]));
  const porFamilia = new Map<string, Map<string, number>>();
  const totales = new Map<string, number>();
  for (const { pedido } of items) {
    const familia = pedido.canalId ? (familiaDe.get(pedido.canalId) ?? "Sin canal") : "Sin canal";
    const semana = lunes(pedido.dia);
    const serie = porFamilia.get(familia) ?? new Map<string, number>();
    serie.set(semana, (serie.get(semana) ?? 0) + pedido.neto);
    porFamilia.set(familia, serie);
    totales.set(familia, (totales.get(familia) ?? 0) + pedido.neto);
  }
  const orden = [...totales.entries()]
    .filter(([familia]) => familia !== "Sin canal")
    .sort((a, b) => b[1] - a[1])
    .map(([familia]) => familia);
  const principales = orden.slice(0, 3);
  const otras = [...totales.keys()].filter((familia) => !principales.includes(familia));
  const valores = (familias: string[]) =>
    semanas.map((semana) => ({
      semanaDesde: semana,
      facturacion: familias.reduce(
        (total, familia) => total + (porFamilia.get(familia)?.get(semana) ?? 0),
        0,
      ),
    }));
  const series: TendenciaSemanalSerie[] = principales.map((familia) => ({
    familia,
    agrupada: false,
    familiasIncluidas: [familia],
    valores: valores([familia]),
  }));
  if (otras.length) {
    series.push({
      familia: "Otras",
      agrupada: true,
      familiasIncluidas: otras,
      valores: valores(otras),
    });
  }
  return { series, semanaEnCurso: ultima };
}

export function participacionPauta(reparto: PautaReparto, canalId: string) {
  return reparto.porCanal.get(canalId) ?? { directa: 0, general: 0, total: 0 };
}
