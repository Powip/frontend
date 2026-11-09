import type { AccionPedidoId } from "../acciones/models/accion-pedido.model";
import {
  type AlcanceGrupo,
  type DetalleGrupo,
  type GrupoDetalleTipo,
  SIN_CANAL,
} from "../detalle/models/detalle.model";
import { formatDayKey } from "../shared/utils/format";
import type { AccionHoyId } from "./models/resumen.model";

function grupo(
  tipo: GrupoDetalleTipo,
  titulo: string,
  params: Record<string, string> = {},
  accion: AccionPedidoId | null = null,
  alcance: AlcanceGrupo = "periodo",
): DetalleGrupo {
  return { tipo, titulo, params, accion, alcance };
}

export const grupos = {
  de: (
    tipo: GrupoDetalleTipo,
    titulo: string,
    params: Record<string, string> = {},
    accion: AccionPedidoId | null = null,
  ) => grupo(tipo, titulo, params, accion),
  actual: (
    tipo: GrupoDetalleTipo,
    titulo: string,
    params: Record<string, string> = {},
    accion: AccionPedidoId | null = null,
  ) => grupo(tipo, titulo, params, accion, "actual"),
  despachadosDia: (dia: string) =>
    grupo(
      "despachados_dia",
      `Despachados el ${formatDayKey(dia)}`,
      { dia_despacho: dia },
      null,
      "despacho",
    ),
  rango: (titulo: string, params: Record<string, string>) =>
    grupo("ventas_rango", titulo, params, null, "rango"),
  caja: (titulo: string, params: Record<string, string>) =>
    grupo("movimientos_caja", titulo, params, null, "caja"),
  despachadosRango: (titulo: string) => grupo("despachados_rango", titulo, {}, null, "despacho"),
  historialCliente: (clienteId: string, nombre: string) =>
    grupo(
      "historial_cliente",
      `${nombre} · historial de compras`,
      { cliente: clienteId },
      null,
      "historial",
    ),
  ventas: () => grupo("ventas", "Ventas"),
  ventasDia: (dia: string) => grupo("ventas_dia", `Ventas del ${formatDayKey(dia)}`, { dia }),
  ventasCanal: (canalId: string | null, nombre: string | null) =>
    grupo("ventas_canal", `${nombre ?? "Sin canal"} · ventas`, { canal: canalId ?? SIN_CANAL }),
  leads: () => grupo("leads", "Leads (call center)"),
  leadsAbiertos: () => grupo("leads_abiertos", "Leads aún sin cerrar"),
  leadsAnulados: () => grupo("leads_anulados", "Leads anulados"),
  directasPos: () => grupo("directas_pos", "Ventas directas y POS"),
  enCurso: () => grupo("en_curso", "Ventas en curso"),
  entregados: () => grupo("entregados", "Entregados"),
  rechazados: () => grupo("rechazados", "Rechazados"),
  cobrado: () => grupo("cobrado", "Cobrado"),
  cobradoSinEntregar: () => grupo("cobrado_sin_entregar", "Prepagos cobrados aún sin entregar"),
  porLiquidar: () => grupo("por_liquidar", "Entregado sin liquidar", {}, "pedir_liquidacion"),
  noCobrado: () => grupo("no_cobrado", "Ventas aún no cobradas"),
  clientesNuevos: () => grupo("clientes_nuevos", "Clientes nuevos"),
  listaNegra: () => grupo("lista_negra", "Ventas a clientes con rechazos previos"),
  esperaProducto: (productoId: string, nombre: string) =>
    grupo(
      "espera_producto",
      `Esperando · ${nombre}`,
      { producto: productoId },
      "avisar_cliente",
      "actual",
    ),
  /**
   * «Sin guía +24 h» de la Cola de Operaciones. NO es `ventas_sin_guia` (el universo del Resumen:
   * sin exigir courier y solo los últimos 14 días): la tarjeta cuenta ventas con courier en LLAMADO o
   * PREPARADO de hace más de 24 h, de cualquier antigüedad. La Task 15c lo implementa con ese predicado.
   */
  sinGuia24h: () =>
    grupo("accion", "Ventas sin guía +24 h", { accion: "sin_guia_24h" }, "asignar_guia", "actual"),
  accion: (
    id: AccionHoyId,
    titulo: string,
    accion: AccionPedidoId,
    extra: Record<string, string> = {},
  ): DetalleGrupo =>
    id === "anulaciones_sin_motivo"
      ? grupo("anulaciones_sin_motivo", titulo, extra, accion, "periodo")
      : grupo("accion", titulo, { accion: id, ...extra }, accion, "actual"),
};
