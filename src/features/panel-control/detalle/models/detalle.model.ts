import type { AccionPedidoId } from "../../acciones/models/accion-pedido.model";
import type { EstadoCobro, EstadoPanel } from "../../shared/models/estado-pedido.model";
import type { PanelQuery } from "../../shared/models/panel-query.model";

export const GRUPOS_DETALLE = [
  "ventas",
  "ventas_dia",
  "ventas_canal",
  "leads",
  "leads_abiertos",
  "leads_anulados",
  "directas_pos",
  "en_curso",
  "entregados",
  "rechazados",
  "cobrado",
  "cobrado_sin_entregar",
  "por_liquidar",
  "no_cobrado",
  "clientes_nuevos",
  "lista_negra",
  "anulaciones_sin_motivo",
  "contactados",
  "con_upsell",
  "anulados_rechazados",
  "perdidas",
  "reembolsados",
  "recurrentes",
  "leads_confirmados",
  "primera_llamada_tardia",
  "duplicados",
  "leads_lista_negra",
  "etapa_lenta",
  "envios",
  "cola_leads",
  "cola_operativa",
  "por_liquidar_actual",
  "reservados",
  "despachados_dia",
  "ventas_rango",
  "pedidos",
  "ventas_sin_costo",
  "por_cobrar_actual",
  "movimientos_caja",
  "despachados_rango",
  "accion",
  "espera_producto",
  "historial_cliente",
] as const;

export type GrupoDetalleTipo = (typeof GRUPOS_DETALLE)[number];

export type AlcanceGrupo = "periodo" | "actual" | "historial" | "despacho" | "rango" | "caja";

export const SIN_CANAL = "sin_canal";

export const PARAMETROS_GRUPO = [
  "canal",
  "dia",
  "asesor",
  "producto",
  "cupon",
  "categoria",
  "departamento",
  "zona",
  "metodo",
  "cliente",
  "sesion",
  "tipo",
  "motivo",
  "accion",
  "courier",
  "entrada",
  "estado",
  "antiguedad",
  "dia_semana",
  "hora",
  "etapa",
  "vencido",
  "minutos",
  "dia_despacho",
  "desde",
  "hasta",
  "familias",
  "canales",
  "antiguedad_deuda",
  "concepto",
  "dia_cobro",
  "estado_cobro",
  "operativo",
  "entrada_no",
] as const;

export type ParametroGrupo = (typeof PARAMETROS_GRUPO)[number];

export interface DetalleGrupo {
  tipo: GrupoDetalleTipo;
  params: Record<string, string>;
  titulo: string;
  accion: AccionPedidoId | null;
  alcance: AlcanceGrupo;
}

export const DETALLE_VISTAS = ["pedidos", "producto", "estado"] as const;
export type DetalleVista = (typeof DETALLE_VISTAS)[number];

export interface DetalleQuery extends PanelQuery {
  grupo: GrupoDetalleTipo;
  grupo_params: string;
  pagina: number;
  tamano_pagina: number;
  buscar?: string;
}

export interface DetalleResumen {
  facturacion: number;
  ventas: number;
  unidades: number;
  ticket: number | null;
  movimientoCaja?: number;
}

export interface DetallePedidoFila {
  id: string;
  numero: string;
  ingreso: string;
  canalOrigenId: string | null;
  canalOrigenNombre: string | null;
  canalCierreNombre: string | null;
  cliente: string;
  departamento: string | null;
  asesor: string | null;
  estado: EstadoPanel;
  cobro: EstadoCobro;
  vencido: boolean;
  listaNegra: boolean;
  motivo: string | null;
  neto: number;
  movimientoFecha?: string;
  movimientoMonto?: number;
}

export interface DetalleProductoFila {
  productoId: string;
  nombre: string;
  unidades: number;
  facturacionNeta: number;
  precioNetoPromedio: number | null;
  margen?: number | null;
}

export interface DetalleEstadoFila {
  estado: EstadoPanel;
  pedidos: number;
}

export interface DetalleResponse {
  resumen: DetalleResumen;
  pedidos: {
    filas: DetallePedidoFila[];
    total: number;
    pagina: number;
    tamanoPagina: number;
  };
  porProducto: DetalleProductoFila[];
  porEstado: DetalleEstadoFila[];
}

export const DETALLE_MAX_FILAS_PANTALLA = 300;
export const DETALLE_TAMANO_PAGINA = 100;
