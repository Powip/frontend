import type { AccionPedidoId } from "../../acciones/models/accion-pedido.model";
import type { DetalleGrupo } from "../../detalle/models/detalle.model";
import type { EstadoStock } from "../../operaciones/models/inventario.model";
import type { PanelTabId } from "../../shared/models/panel-navigation.model";

export interface ResumenVendi {
  facturacion: number;
  ventas: number;
  ticket: number | null;
  leads: number;
  confirmacion: number | null;
}

export interface ResumenGane {
  ganancia: number;
  entregado: number;
  margen: number | null;
  publicidad: number;
  costoProducto: number;
  flete: number;
  comisiones: number;
  entregasSinCosto: number;
}

export interface ResumenEntregado {
  entregado: number;
  entregas: number;
  efectividadEntrega: number | null;
}

export interface ResumenMeDeben {
  total: number;
  porLiquidar: number;
  enCursoPorCobrar: number;
  vencido: number | null;
}

export const ACCIONES_HOY = [
  "leads_sin_llamar",
  "ventas_sin_guia",
  "courier_no_liquida",
  "productos_agotados",
  "envios_retrasados",
  "anulaciones_sin_motivo",
] as const;

export type AccionHoyId = (typeof ACCIONES_HOY)[number];

export type Urgencia = "alta" | "media" | "baja";

export const URGENCIA_ORDEN: Record<Urgencia, number> = { alta: 0, media: 1, baja: 2 };

export interface AccionHoy {
  clave: string;
  id: AccionHoyId;
  urgencia: Urgencia;
  pedidos: number;
  monto: number | null;
  courier: string | null;
  plazoDias: number | null;
  productos: string[];
  accion: AccionPedidoId;
  pestana: PanelTabId;
  grupo: DetalleGrupo;
}

export interface VentaDiaria {
  dia: string;
  facturacion: number;
  ventas: number;
  diaAnterior: string | null;
  facturacionAnterior: number | null;
}

export interface VentaPorCanal {
  canalId: string | null;
  canalNombre: string | null;
  color: string | null;
  facturacion: number;
  ventas: number;
  retornoPublicidad?: number | null;
}

export interface ResumenClientes {
  nuevos: number | null;
  conCompra: number | null;
  recompra: number | null;
  listaNegra: number | null;
}

export interface ResumenInventarioAlerta {
  productoId: string;
  nombre: string;
  estado: Extract<EstadoStock, "agotado" | "critico">;
  disponible: number | null;
  coberturaDias: number | null;
  ventasEsperando: number;
}

export interface ResumenInventario {
  agotados: number;
  criticos: number;
  umbralCriticoDias: number;
  alertas: ResumenInventarioAlerta[];
}

export interface ResumenFlujo {
  leads: number;
  leadsAbiertos: number;
  leadsAnulados: number;
  directasYPos: number;
  ventas: number;
  facturacion: number;
  confirmados: number;
  confirmacion: number | null;
  enCurso: { pedidos: number; monto: number; porDespachar: number; enEnvio: number };
  entregados: { pedidos: number; monto: number; efectividad: number | null };
  rechazados: { pedidos: number; perdido: number; flete?: number };
  cobro: {
    cobradoTotal: number;
    cobradoEntregado: number;
    cobradoSinEntregar: number;
    porLiquidar: number;
    vencido: number | null;
  };
}

export interface ResumenPanel {
  vendi: ResumenVendi;
  gane?: ResumenGane;
  entregado: ResumenEntregado;
  meDeben: ResumenMeDeben;
  acciones: AccionHoy[];
  ventasDiarias: VentaDiaria[];
  ventasPorCanal: VentaPorCanal[];
  clientes: ResumenClientes;
  inventario: ResumenInventario;
  flujo: ResumenFlujo;
}
