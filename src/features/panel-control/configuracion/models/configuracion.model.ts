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
  /** `null` cuando ms-logistics no responde: el stock no se pudo revisar (ver `avisos`). */
  productosStockNegativo: { productoId: string; nombre: string; stock: number }[] | null;
  /** Avisos de calidad del propio cálculo (p. ej. «no se pudo revisar el stock»). */
  avisos: string[];
}

export interface ConfigCuadres {
  cuadres: CuadreResultado[];
  calidad: CalidadDatos;
}

/** Conceptos de comisión que entiende el backend (R26). El resto se ignora al calcular. */
export const COMISION_CONCEPTOS = {
  confirmadora: ["por_entrega", "pct_upsell"],
  vendedora: ["pct_pagado", "pct_upsell"],
} as const;

export type RolComision = keyof typeof COMISION_CONCEPTOS;

export interface ComisionRegla {
  rol: RolComision;
  concepto: string;
  /** soles para `por_entrega`; porcentaje 0..100 para `pct_*` (tal cual lo guarda el backend). */
  valor: number;
}

/** GET|PUT /config/comisiones */
export interface ConfigComisiones {
  reglas: ComisionRegla[];
}

export interface GastoFijo {
  storeId: string;
  montoMensual: number;
}

/** GET|PUT /config/gastos-fijos */
export interface ConfigGastosFijos {
  gastos: GastoFijo[];
}

export interface CourierConfig {
  key: string;
  nombre: string;
  plazoLiquidacionDias: number | null;
  tiempoNormalDias: number | null;
}

/** GET /config/couriers */
export interface ConfigCouriers {
  couriers: CourierConfig[];
}

/** Elemento del PUT /config/couriers: omitido = conservar, `null` = borrar. */
export interface CourierConfigGuardar {
  key: string;
  nombre?: string;
  plazoLiquidacionDias?: number | null;
  tiempoNormalDias?: number | null;
}

export const TIPOS_BLOQUE_CANAL = [
  "lead",
  "live",
  "presencial",
  "marketplace",
  "prepago",
  "conversacional",
] as const;

export type TipoBloqueCanal = (typeof TIPOS_BLOQUE_CANAL)[number];

/**
 * PUT /config/canales/:id/ficha. Los porcentajes viajan de 0 a 100 (el GET los devuelve como
 * fracción: la conversión vive solo en `config-escala.ts`). `null` borra, omitido no toca.
 */
export interface ConfigFichaGuardar {
  familia?: string | null;
  tipo?: TipoBloqueCanal | null;
  pctComision?: number | null;
  pctPasarela?: number | null;
  plazoDepositoDias?: number | null;
}
