export const META_INDICADOR_IDS = [
  "confirmacion",
  "contactados",
  "tiempo_primera_llamada",
  "efectividad_entrega",
  "efectividad_real",
  "upsell",
  "primer_intento",
  "incidencia_rechazo",
  "dias_ciclo",
  "recompra",
  "retorno_publicidad",
  "ventas_sin_guia",
] as const;

export type MetaIndicadorId = (typeof META_INDICADOR_IDS)[number];

export type MetaDireccion = "minimo" | "maximo";

export type MetaUnidad = "porcentaje" | "minutos" | "dias" | "veces" | "cantidad";

export interface MetaIndicador {
  id: MetaIndicadorId;
  etiqueta: string;
  valor: number;
  direccion: MetaDireccion;
  unidad: MetaUnidad;
  tolerancia: number;
}

export interface MetasMensuales {
  porCanal: Record<string, number>;
  porVendedora: Record<string, number>;
  porConfirmadora: Record<string, number>;
}

export interface MetasPanel {
  indicadores: Record<MetaIndicadorId, MetaIndicador>;
  mensuales: MetasMensuales;
}

export type SemaforoEstado = "cumple" | "cerca" | "bajo" | "sin_datos";

export interface EvaluacionMeta {
  estado: SemaforoEstado;
  meta: MetaIndicador;
  valor: number | null;
}
