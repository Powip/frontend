import type { EstadoPanel } from "../../shared/models/estado-pedido.model";
import type { MetaIndicadorId, MetasPanel } from "../../shared/models/goal.model";

export type ConfigMetas = MetasPanel;

export interface ConfigMetasGuardar {
  indicadores?: Partial<Record<MetaIndicadorId, number>>;
  porCanal?: Record<string, number>;
  porVendedora?: Record<string, number>;
  porConfirmadora?: Record<string, number>;
}

export interface ConteoEstado {
  estado: EstadoPanel;
  pedidos: number;
}

export interface ConfigEstados {
  conteoActual: ConteoEstado[];
}

export const CUADRE_IDS = [
  "canales_facturacion",
  "asesores_facturacion",
  "zonas_facturacion",
  "facturado_entregado_curso_rechazado",
  "facturado_cobranza",
  "leads_estados",
  "estados_pedidos",
  "unidades_productos",
  "pauta_prorrateada",
] as const;

export type CuadreId = (typeof CUADRE_IDS)[number];

export interface CuadreResultado {
  id: CuadreId;
  descripcion: string;
  valor: number;
  total: number;
  unidad: "soles" | "cantidad";
  cuadra: boolean;
  nota: string | null;
}

export interface CalidadDatos {
  porcentajeCompleto: number | null;
  pedidosRevisados: number;
  anulacionesSinMotivo: number;
  importadosSinCanal: number;
  ventasConProductoSinCosto: number;
  productosSinCosto: { productoId: string; nombre: string }[];
  productosStockNegativo: { productoId: string; nombre: string; stock: number }[];
}

export interface ConfigCuadres {
  cuadres: CuadreResultado[];
  calidad: CalidadDatos;
}
