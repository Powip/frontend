import type { BucketEspera } from "../../../call-center/models/call-center.model";
import type { GrupoDetalleTipo } from "../../../detalle/models/detalle.model";
import { SIN_CANAL } from "../../../detalle/models/detalle.model";
import type {
  BucketAntiguedad,
  EstadoCola,
  EtapaOperativa,
} from "../../../operaciones/models/cola.model";
import { clasificarStock } from "../../../operaciones/utils/clasificar-stock";
import type { AccionHoyId } from "../../../resumen/models/resumen.model";
import { METAS_INDICADORES_ESPECIFICACION } from "../../config/panel-goals.defaults";
import type { EstadoPanel } from "../../models/estado-pedido.model";
import { SIN_ASESOR } from "../../models/panel-filters.model";
import type { PanelQuery } from "../../models/panel-query.model";
import { addDays, dayKeyToUtcMidnight, diffDays, toLimaDayKey } from "../../utils/lima-time";
import { bucketDeuda, type ConceptoCaja, movimientosCaja } from "./demo-caja";
import {
  type CanalDemo,
  costoPedido,
  type EstadoDemo,
  estadoDemoEn,
  OPERATIVOS_EN_CURSO,
  type PedidoDemo,
  type ProductoDemo,
  SIN_MOTIVO,
  type UniversoDemo,
} from "./demo-universe";

const HORA = 3_600_000;
const DIA = 24 * HORA;
const MINUTO = 60_000;

export const SIN_FAMILIA = "Sin canal";

export function bucketEsperaLead(horas: number): BucketEspera {
  if (horas < 1) return "menos_1h";
  if (horas < 6) return "1_6h";
  if (horas < 24) return "6_24h";
  return "mas_24h";
}

export function bucketAntiguedadCola(dias: number): BucketAntiguedad {
  if (dias < 1) return "menos_24h";
  if (dias < 3) return "1_2d";
  if (dias < 6) return "3_5d";
  return "mas_5d";
}

export const ESTADOS_RESERVA: EstadoPanel[] = ["LLAMADO", "PREPARADO", "CON_GUIA"];

export function inicioEstadoCola(pedido: PedidoDemo, estado: EstadoCola): number | null {
  if (estado === "LLAMADO") return pedido.tConf;
  if (estado === "PREPARADO") return pedido.tPrep;
  if (estado === "CON_GUIA") return pedido.tGuia;
  return pedido.tDesp;
}

export function esEstadoCola(estado: EstadoPanel): estado is EstadoCola {
  return (
    estado === "LLAMADO" || estado === "PREPARADO" || estado === "CON_GUIA" || estado === "EN_ENVIO"
  );
}

export function enColaOperativa({ pedido, estado }: PedidoConEstado): boolean {
  return pedido.usaCourier && esEstadoCola(estado.estado);
}

export const ETAPA_META_HORAS: Record<EtapaOperativa, number> = {
  llamado_preparado: 12,
  preparado_con_guia: 6,
  con_guia_en_envio: 12,
  en_envio_entregado: 72,
  ciclo_total: METAS_INDICADORES_ESPECIFICACION.dias_ciclo.valor * 24,
};

export function horasEtapa(pedido: PedidoDemo, etapa: EtapaOperativa): number | null {
  const tramo: Record<EtapaOperativa, [number | null, number | null]> = {
    llamado_preparado: [pedido.tConf, pedido.tPrep],
    preparado_con_guia: [pedido.tPrep, pedido.tGuia],
    con_guia_en_envio: [pedido.tGuia, pedido.tDesp],
    en_envio_entregado: [pedido.tDesp, pedido.tEnt],
    ciclo_total: [pedido.tConf, pedido.tEnt],
  };
  const [desde, hasta] = tramo[etapa];
  if (desde === null || hasta === null) return null;
  return (hasta - desde) / HORA;
}

export function entregaMedible({ pedido, estado }: PedidoConEstado): boolean {
  return pedido.usaCourier && estado.operativo === "entregado";
}

export function leadTrabajado(pedido: PedidoDemo, t: number): boolean {
  return pedido.entrada === "lead" && pedido.tPrimerIntento !== null && pedido.tPrimerIntento <= t;
}

export function leadContactado(pedido: PedidoDemo, t: number): boolean {
  return leadTrabajado(pedido, t) && pedido.contactado;
}

export function minutosPrimeraLlamada(pedido: PedidoDemo, t: number): number | null {
  if (!leadTrabajado(pedido, t) || pedido.tPrimerIntento === null) return null;
  return (pedido.tPrimerIntento - pedido.ts) / MINUTO;
}

export function horaLimaDe(ts: number): { diaSemana: number; hora: number } {
  const lima = new Date(ts - 5 * HORA);
  return { diaSemana: (lima.getUTCDay() + 6) % 7, hora: lima.getUTCHours() };
}

export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[medio] : (ordenados[medio - 1] + ordenados[medio]) / 2;
}

export function familiaDe(universo: UniversoDemo, canalId: string | null): string {
  if (!canalId) return SIN_FAMILIA;
  return universo.canales.find((canal) => canal.id === canalId)?.familia ?? SIN_FAMILIA;
}

export function despachadoEl(pedido: PedidoDemo, dia: string, t: number): boolean {
  return pedido.tDesp !== null && pedido.tDesp <= t && toLimaDayKey(pedido.tDesp) === dia;
}

export function fechaEnRango(fecha: number, desde: string, hasta: string, t: number): boolean {
  const dia = toLimaDayKey(fecha);
  return fecha <= t && dia >= desde && dia <= hasta;
}

export const CONCEPTOS_ENTRADA: ConceptoCaja[] = [
  "liquidacion_courier",
  "liquidacion_marketplace",
  "caja_pos",
  "prepago",
];

export function movimientoCajaEnPeriodo(
  pedido: PedidoDemo,
  params: Record<string, string>,
  query: PanelQuery,
  t: number,
): { fecha: number; monto: number } | null {
  const conceptos = params.concepto ? [params.concepto as ConceptoCaja] : CONCEPTOS_ENTRADA;
  let monto = 0;
  let fecha = 0;
  let hay = false;
  for (const concepto of conceptos) {
    for (const movimiento of movimientosCaja(pedido, concepto)) {
      if (!fechaEnRango(movimiento.fecha, query.desde, query.hasta, t)) continue;
      if (params.dia_cobro && toLimaDayKey(movimiento.fecha) !== params.dia_cobro) continue;
      hay = true;
      monto += movimiento.monto;
      fecha = Math.max(fecha, movimiento.fecha);
    }
  }
  return hay ? { fecha, monto: Math.round(monto * 100) / 100 } : null;
}

export interface PedidoConEstado {
  pedido: PedidoDemo;
  estado: EstadoDemo;
}

export function coincideDimensiones(pedido: PedidoDemo, query: PanelQuery): boolean {
  if (query.tienda && pedido.tiendaId !== query.tienda) return false;
  if (query.canal && pedido.canalId !== query.canal) return false;
  if (query.entrada && pedido.entrada !== query.entrada) return false;
  if (query.cobro && pedido.cobro !== query.cobro) return false;
  if (query.zona && pedido.zona !== query.zona) return false;
  if (query.turno && pedido.turno !== query.turno) return false;
  if (query.asesor) {
    if (query.asesor === SIN_ASESOR) return pedido.asesorId === null;
    if (pedido.asesorId !== query.asesor) return false;
  }
  return true;
}

export function canalCoincideFiltros(canal: CanalDemo, query: PanelQuery): boolean {
  return (
    (!query.canal || canal.id === query.canal) &&
    (!query.entrada || canal.entrada === query.entrada) &&
    (!query.cobro || canal.cobro === query.cobro)
  );
}

export function filtrosNoAtribuiblesAPauta(query: PanelQuery): boolean {
  return !!(query.zona || query.turno || query.asesor);
}

export function instanteAnterior(query: PanelQuery, now: number): number {
  return now - diffDays(query.anterior_desde, query.desde) * DIA;
}

export function pedidosEnRango(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
  instante: number,
): PedidoConEstado[] {
  return universo.pedidos
    .filter(
      (pedido) =>
        pedido.dia >= desde &&
        pedido.dia <= hasta &&
        pedido.ts <= instante &&
        coincideDimensiones(pedido, query),
    )
    .map((pedido) => ({ pedido, estado: estadoDemoEn(pedido, instante) }));
}

export function pedidosActuales(
  universo: UniversoDemo,
  query: PanelQuery,
  now: number,
): PedidoConEstado[] {
  return universo.pedidos
    .filter((pedido) => coincideDimensiones(pedido, query))
    .map((pedido) => ({ pedido, estado: estadoDemoEn(pedido, now) }));
}

export function mapaProductos(universo: UniversoDemo): Map<string, ProductoDemo> {
  return new Map(universo.productos.map((producto) => [producto.id, producto]));
}

export interface InventarioDemoFila {
  producto: ProductoDemo;
  unidades30Dias: number;
  ventaDiaria: number;
  reservado: number;
  disponible: number;
  coberturaDias: number | null;
  estado: ReturnType<typeof clasificarStock>["estado"];
}

export function inventarioDemo(
  universo: UniversoDemo,
  query: PanelQuery,
  now: number,
): InventarioDemoFila[] {
  const hace30 = now - 30 * DIA;
  const reservado = new Map<string, number>();
  const vendido = new Map<string, number>();
  for (const pedido of universo.pedidos) {
    if (query.tienda && pedido.tiendaId !== query.tienda) continue;
    if (pedido.ts > now) continue;
    const estado = estadoDemoEn(pedido, now);
    const reserva = ESTADOS_RESERVA.includes(estado.estado);
    const reciente = estado.venta && pedido.ts >= hace30;
    if (!reserva && !reciente) continue;
    for (const linea of pedido.items) {
      if (reserva)
        reservado.set(linea.productoId, (reservado.get(linea.productoId) ?? 0) + linea.cantidad);
      if (reciente)
        vendido.set(linea.productoId, (vendido.get(linea.productoId) ?? 0) + linea.cantidad);
    }
  }
  return universo.productos
    .filter((producto) => !query.tienda || producto.tiendaId === query.tienda)
    .map((producto) => {
      const cobertura = clasificarStock(
        producto.stock,
        reservado.get(producto.id) ?? 0,
        vendido.get(producto.id) ?? 0,
      );
      return {
        producto,
        unidades30Dias: vendido.get(producto.id) ?? 0,
        ventaDiaria: cobertura.ventaDiaria,
        reservado: reservado.get(producto.id) ?? 0,
        disponible: cobertura.disponible,
        coberturaDias: cobertura.coberturaDias,
        estado: cobertura.estado,
      };
    });
}

export function productosAgotados(universo: UniversoDemo, query: PanelQuery): Set<string> {
  return new Set(
    universo.productos
      .filter(
        (producto) => (!query.tienda || producto.tiendaId === query.tienda) && producto.stock === 0,
      )
      .map((producto) => producto.id),
  );
}

export function cumpleAccion(
  id: Exclude<AccionHoyId, "anulaciones_sin_motivo">,
  { pedido, estado }: PedidoConEstado,
  now: number,
  agotados: Set<string>,
): boolean {
  switch (id) {
    case "leads_sin_llamar":
      return estado.leadAbierto && estado.sinIntento && now - pedido.ts > HORA;
    case "ventas_sin_guia":
      return (
        (estado.estado === "LLAMADO" || estado.estado === "PREPARADO") &&
        pedido.usaCourier &&
        pedido.tConf !== null &&
        now - pedido.tConf > 24 * HORA
      );
    case "courier_no_liquida":
      return estado.cobro === "por_liquidar" && estado.vencido;
    case "productos_agotados":
      return (
        (estado.estado === "LLAMADO" || estado.estado === "PREPARADO") &&
        pedido.items.some((linea) => agotados.has(linea.productoId))
      );
    case "envios_retrasados":
      return (
        estado.operativo === "en_envio" &&
        pedido.tDesp !== null &&
        pedido.tiempoNormalDias !== null &&
        (now - pedido.tDesp) / DIA > pedido.tiempoNormalDias
      );
    default:
      return false;
  }
}

export function esClienteNuevo(universo: UniversoDemo, pedido: PedidoDemo, desde: string): boolean {
  const primera = universo.primeraCompra.get(pedido.clienteId);
  return primera !== undefined && toLimaDayKey(primera) >= desde;
}

export function esRecurrente(universo: UniversoDemo, pedido: PedidoDemo, desde: string): boolean {
  const primera = universo.primeraCompra.get(pedido.clienteId);
  return primera !== undefined && toLimaDayKey(primera) < desde;
}

function coincideParametros(
  item: PedidoConEstado,
  params: Record<string, string>,
  productos: Map<string, ProductoDemo>,
): boolean {
  const { pedido, estado } = item;
  if (params.canal) {
    const esperado = params.canal === SIN_CANAL ? null : params.canal;
    if (pedido.canalId !== esperado) return false;
  }
  if (params.dia && pedido.dia !== params.dia) return false;
  if (params.asesor) {
    const esperado = params.asesor === SIN_ASESOR ? null : params.asesor;
    if (pedido.asesorId !== esperado) return false;
  }
  if (params.producto && !pedido.items.some((linea) => linea.productoId === params.producto)) {
    return false;
  }
  if (params.cupon && pedido.cupon !== params.cupon) return false;
  if (
    params.categoria &&
    !pedido.items.some((linea) => productos.get(linea.productoId)?.categoria === params.categoria)
  ) {
    return false;
  }
  if (params.departamento && pedido.departamento !== params.departamento) return false;
  if (params.zona && pedido.zona !== params.zona) return false;
  if (params.metodo && pedido.metodoPago !== params.metodo) return false;
  if (params.cliente && pedido.clienteId !== params.cliente) return false;
  if (params.sesion && pedido.sesionId !== params.sesion) return false;
  if (params.courier && pedido.courier !== params.courier) return false;
  if (params.entrada && pedido.entrada !== params.entrada) return false;
  if (params.entrada_no && pedido.entrada === params.entrada_no) return false;
  if (params.canales) {
    const ids = params.canales.split(",");
    if (pedido.canalId === null || !ids.includes(pedido.canalId)) return false;
  }
  if (params.estado && estado.estado !== params.estado) return false;
  if (params.estado_cobro && estado.cobro !== params.estado_cobro) return false;
  if (params.operativo && estado.operativo !== params.operativo) return false;
  if (params.dia_semana !== undefined || params.hora !== undefined) {
    const lima = horaLimaDe(pedido.ts);
    if (params.dia_semana !== undefined && lima.diaSemana !== Number(params.dia_semana)) {
      return false;
    }
    if (params.hora !== undefined && lima.hora !== Number(params.hora)) return false;
  }
  if (params.tipo === "anulado") {
    if (estado.estado !== "ANULADO") return false;
    if (params.motivo && (pedido.motivoAnulacion ?? SIN_MOTIVO) !== params.motivo) return false;
  }
  if (params.tipo === "rechazado") {
    if (estado.operativo !== "rechazado") return false;
    if (params.motivo && pedido.motivoRechazo !== params.motivo) return false;
  }
  return true;
}

type GrupoPeriodo = Exclude<
  GrupoDetalleTipo,
  | "accion"
  | "espera_producto"
  | "historial_cliente"
  | "cola_leads"
  | "cola_operativa"
  | "por_liquidar_actual"
  | "reservados"
  | "despachados_dia"
  | "ventas_rango"
  | "por_cobrar_actual"
  | "movimientos_caja"
  | "despachados_rango"
>;

export function seleccionarGrupo(
  universo: UniversoDemo,
  query: PanelQuery,
  tipo: GrupoDetalleTipo,
  params: Record<string, string>,
  now: number,
): PedidoConEstado[] {
  const productos = mapaProductos(universo);
  const conParametros = (items: PedidoConEstado[]) =>
    items.filter((item) => coincideParametros(item, params, productos));

  if (tipo === "historial_cliente") {
    return universo.pedidos
      .filter((pedido) => pedido.clienteId === params.cliente && pedido.ts <= now)
      .map((pedido) => ({ pedido, estado: estadoDemoEn(pedido, now) }))
      .filter(({ estado }) => estado.venta);
  }

  if (tipo === "cola_leads") {
    return conParametros(pedidosActuales(universo, query, now)).filter(
      ({ pedido, estado }) =>
        pedido.ts <= now &&
        estado.leadAbierto &&
        (!params.antiguedad || bucketEsperaLead((now - pedido.ts) / HORA) === params.antiguedad),
    );
  }

  if (tipo === "cola_operativa") {
    return conParametros(pedidosActuales(universo, query, now)).filter((item) => {
      if (item.pedido.ts > now || !enColaOperativa(item)) return false;
      if (!params.antiguedad) return true;
      const inicio = inicioEstadoCola(item.pedido, item.estado.estado as EstadoCola);
      return inicio !== null && bucketAntiguedadCola((now - inicio) / DIA) === params.antiguedad;
    });
  }

  if (tipo === "por_liquidar_actual") {
    return conParametros(pedidosActuales(universo, query, now)).filter(
      ({ pedido, estado }) =>
        pedido.ts <= now &&
        estado.cobro === "por_liquidar" &&
        (params.vencido !== "1" || estado.vencido) &&
        (params.vencido !== "sin_plazo" || pedido.plazoLiquidacionDias === null) &&
        (!params.antiguedad_deuda ||
          (pedido.tEnt !== null &&
            bucketDeuda(Math.floor((now - pedido.tEnt) / DIA)) === params.antiguedad_deuda)),
    );
  }

  if (tipo === "por_cobrar_actual") {
    return conParametros(pedidosActuales(universo, query, now)).filter(
      ({ pedido, estado }) => pedido.ts <= now && estado.cobro === "en_curso",
    );
  }

  if (tipo === "movimientos_caja") {
    return conParametros(pedidosActuales(universo, query, now)).filter(
      ({ pedido }) =>
        pedido.ts <= now && movimientoCajaEnPeriodo(pedido, params, query, now) !== null,
    );
  }

  if (tipo === "despachados_rango") {
    return conParametros(pedidosActuales(universo, query, now)).filter(
      ({ pedido, estado }) =>
        estado.venta &&
        pedido.usaCourier &&
        pedido.tDesp !== null &&
        fechaEnRango(pedido.tDesp, query.desde, query.hasta, now),
    );
  }

  if (tipo === "reservados") {
    return conParametros(pedidosActuales(universo, query, now)).filter(
      ({ pedido, estado }) => pedido.ts <= now && ESTADOS_RESERVA.includes(estado.estado),
    );
  }

  if (tipo === "despachados_dia") {
    return conParametros(pedidosActuales(universo, query, now)).filter(
      ({ pedido, estado }) =>
        estado.venta && pedido.usaCourier && despachadoEl(pedido, params.dia_despacho, now),
    );
  }

  if (tipo === "ventas_rango") {
    const familias = params.familias ? params.familias.split(",") : null;
    return conParametros(pedidosEnRango(universo, query, params.desde, params.hasta, now)).filter(
      ({ pedido, estado }) =>
        estado.venta && (!familias || familias.includes(familiaDe(universo, pedido.canalId))),
    );
  }

  if (tipo === "accion" || tipo === "espera_producto") {
    const actuales = pedidosActuales(universo, query, now);
    if (tipo === "espera_producto") {
      return conParametros(actuales).filter(
        ({ estado }) => estado.estado === "LLAMADO" || estado.estado === "PREPARADO",
      );
    }
    const accion = params.accion as Exclude<AccionHoyId, "anulaciones_sin_motivo">;
    const agotados = productosAgotados(universo, query);
    return conParametros(actuales).filter((item) => cumpleAccion(accion, item, now, agotados));
  }

  const periodo = conParametros(pedidosEnRango(universo, query, query.desde, query.hasta, now));
  const predicados: Record<GrupoPeriodo, (item: PedidoConEstado) => boolean> = {
    ventas: ({ estado }) => estado.venta,
    ventas_dia: ({ estado }) => estado.venta,
    ventas_canal: ({ estado }) => estado.venta,
    leads: ({ pedido }) => pedido.entrada === "lead",
    leads_abiertos: ({ estado }) => estado.leadAbierto,
    leads_anulados: ({ estado }) => estado.estado === "ANULADO",
    directas_pos: ({ pedido }) => pedido.entrada !== "lead",
    en_curso: ({ estado }) =>
      estado.operativo !== null && OPERATIVOS_EN_CURSO.includes(estado.operativo),
    entregados: ({ estado }) => estado.operativo === "entregado",
    rechazados: ({ estado }) => estado.operativo === "rechazado",
    cobrado: ({ estado }) => estado.cobro === "pagado",
    cobrado_sin_entregar: ({ estado }) =>
      estado.cobro === "pagado" && estado.operativo !== "entregado",
    por_liquidar: ({ estado }) => estado.cobro === "por_liquidar",
    no_cobrado: ({ estado }) => estado.cobro === "por_liquidar" || estado.cobro === "en_curso",
    clientes_nuevos: ({ pedido, estado }) =>
      estado.venta && esClienteNuevo(universo, pedido, query.desde),
    recurrentes: ({ pedido, estado }) =>
      estado.venta && esRecurrente(universo, pedido, query.desde),
    lista_negra: ({ pedido, estado }) => estado.venta && pedido.listaNegra,
    anulaciones_sin_motivo: ({ pedido, estado }) =>
      estado.estado === "ANULADO" && pedido.motivoAnulacion === null,
    contactados: ({ pedido }) => leadContactado(pedido, now),
    leads_confirmados: ({ pedido, estado }) => pedido.entrada === "lead" && estado.venta,
    primera_llamada_tardia: ({ pedido }) => {
      const minutos = minutosPrimeraLlamada(pedido, now);
      const limite = Number(
        params.minutos ?? METAS_INDICADORES_ESPECIFICACION.tiempo_primera_llamada.valor,
      );
      return minutos !== null && minutos > limite;
    },
    duplicados: ({ pedido }) => pedido.duplicadoDe !== null,
    leads_lista_negra: ({ pedido }) => pedido.entrada === "lead" && pedido.listaNegra,
    etapa_lenta: (item) => {
      if (!entregaMedible(item)) return false;
      const etapa = params.etapa as EtapaOperativa;
      const horas = horasEtapa(item.pedido, etapa);
      return horas !== null && horas > ETAPA_META_HORAS[etapa];
    },
    envios: ({ pedido, estado }) =>
      estado.venta &&
      pedido.usaCourier &&
      (estado.operativo === "en_envio" ||
        estado.operativo === "entregado" ||
        estado.operativo === "rechazado"),
    con_upsell: ({ pedido, estado }) =>
      estado.venta && pedido.items.some((linea) => linea.esUpsell),
    anulados_rechazados: ({ estado }) =>
      estado.estado === "ANULADO" || estado.operativo === "rechazado",
    perdidas: ({ estado }) => estado.estado === "ANULADO" || estado.operativo === "rechazado",
    reembolsados: ({ estado }) => estado.cobro === "reembolsado",
    pedidos: () => true,
    ventas_sin_costo: ({ pedido, estado }) =>
      estado.venta && !costoPedido(pedido, productos).completo,
  };
  return periodo.filter(predicados[tipo]);
}

export function diasDelRango(desde: string, hasta: string): string[] {
  const total = diffDays(desde, hasta);
  return Array.from({ length: Math.max(0, total + 1) }, (_, index) => addDays(desde, index));
}

export function inicioDiaLima(dia: string): number {
  return dayKeyToUtcMidnight(dia) + 5 * HORA;
}

export interface PautaCanal {
  directa: number;
  general: number;
  total: number;
}

export interface PautaReparto {
  porCanal: Map<string, PautaCanal>;
  generalRegistrada: number;
  generalSinAsignar: number;
  directaRegistrada: number;
}

export function repartirPauta(
  universo: UniversoDemo,
  query: PanelQuery,
  desde: string,
  hasta: string,
  items: PedidoConEstado[],
): PautaReparto {
  const enRango = universo.pauta.filter(
    (registro) =>
      registro.dia >= desde &&
      registro.dia <= hasta &&
      (!query.tienda || registro.tiendaId === query.tienda),
  );
  const generalRegistrada = enRango
    .filter((registro) => registro.canalId === null)
    .reduce((total, registro) => total + registro.monto, 0);
  const facturacion = new Map<string, number>();
  for (const { pedido, estado } of items) {
    if (!estado.venta || !pedido.canalId) continue;
    facturacion.set(pedido.canalId, (facturacion.get(pedido.canalId) ?? 0) + pedido.neto);
  }
  const receptores = universo.canales.filter((canal) => canal.recibePautaGeneral);
  const baseReparto = receptores.reduce(
    (total, canal) => total + (facturacion.get(canal.id) ?? 0),
    0,
  );
  const cuota = (canal: CanalDemo) =>
    canal.recibePautaGeneral && baseReparto > 0
      ? (generalRegistrada * (facturacion.get(canal.id) ?? 0)) / baseReparto
      : 0;

  const porCanal = new Map<string, PautaCanal>();
  let directaRegistrada = 0;
  for (const canal of universo.canales) {
    if (!canalCoincideFiltros(canal, query)) continue;
    const directa = enRango
      .filter((registro) => registro.canalId === canal.id)
      .reduce((total, registro) => total + registro.monto, 0);
    const general = Math.round(cuota(canal) * 100) / 100;
    directaRegistrada += directa;
    porCanal.set(canal.id, { directa, general, total: directa + general });
  }
  const asignada = receptores.reduce((total, canal) => total + cuota(canal), 0);
  return {
    porCanal,
    generalRegistrada,
    generalSinAsignar: Math.max(0, Math.round((generalRegistrada - asignada) * 100) / 100),
    directaRegistrada,
  };
}

export function totalPauta(reparto: PautaReparto): number {
  let total = 0;
  for (const valor of reparto.porCanal.values()) total += valor.total;
  return Math.round(total * 100) / 100;
}

export interface VentaDiariaDemo {
  dia: string;
  facturacion: number;
  ventas: number;
  diaAnterior: string | null;
  facturacionAnterior: number | null;
}

function porDia(items: PedidoConEstado[]): Map<string, { facturacion: number; ventas: number }> {
  const mapa = new Map<string, { facturacion: number; ventas: number }>();
  for (const { pedido, estado } of items) {
    if (!estado.venta) continue;
    const actual = mapa.get(pedido.dia) ?? { facturacion: 0, ventas: 0 };
    mapa.set(pedido.dia, {
      facturacion: actual.facturacion + pedido.neto,
      ventas: actual.ventas + 1,
    });
  }
  return mapa;
}

export function ventasDiariasDemo(
  query: PanelQuery,
  actuales: PedidoConEstado[],
  anteriores: PedidoConEstado[] | null,
): VentaDiariaDemo[] {
  const actual = porDia(actuales);
  const anterior = anteriores ? porDia(anteriores) : null;
  return diasDelRango(query.desde, query.hasta).map((dia, index) => {
    const valores = actual.get(dia) ?? { facturacion: 0, ventas: 0 };
    const diaAnterior = anterior ? addDays(query.anterior_desde, index) : null;
    const valido = diaAnterior !== null && diaAnterior <= query.anterior_hasta;
    return {
      dia,
      facturacion: valores.facturacion,
      ventas: valores.ventas,
      diaAnterior: valido ? diaAnterior : null,
      facturacionAnterior:
        valido && anterior ? (anterior.get(diaAnterior)?.facturacion ?? 0) : null,
    };
  });
}
