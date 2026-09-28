import type { MetaIndicador, MetaIndicadorId, MetasPanel } from "../models/goal.model";

const TOLERANCIA_ESTANDAR = 0.1;

export const METAS_INDICADORES_ESPECIFICACION: Record<MetaIndicadorId, MetaIndicador> = {
  confirmacion: {
    id: "confirmacion",
    etiqueta: "Confirmados",
    valor: 0.65,
    direccion: "minimo",
    unidad: "porcentaje",
    tolerancia: TOLERANCIA_ESTANDAR,
  },
  contactados: {
    id: "contactados",
    etiqueta: "Contactados",
    valor: 0.8,
    direccion: "minimo",
    unidad: "porcentaje",
    tolerancia: TOLERANCIA_ESTANDAR,
  },
  tiempo_primera_llamada: {
    id: "tiempo_primera_llamada",
    etiqueta: "Tiempo a 1ª llamada",
    valor: 30,
    direccion: "maximo",
    unidad: "minutos",
    tolerancia: 0.5,
  },
  efectividad_entrega: {
    id: "efectividad_entrega",
    etiqueta: "Efectividad de entrega",
    valor: 0.82,
    direccion: "minimo",
    unidad: "porcentaje",
    tolerancia: TOLERANCIA_ESTANDAR,
  },
  efectividad_real: {
    id: "efectividad_real",
    etiqueta: "Efectividad real",
    valor: 0.6,
    direccion: "minimo",
    unidad: "porcentaje",
    tolerancia: TOLERANCIA_ESTANDAR,
  },
  upsell: {
    id: "upsell",
    etiqueta: "Upsell",
    valor: 0.25,
    direccion: "minimo",
    unidad: "porcentaje",
    tolerancia: TOLERANCIA_ESTANDAR,
  },
  primer_intento: {
    id: "primer_intento",
    etiqueta: "Entrega al 1er intento",
    valor: 0.85,
    direccion: "minimo",
    unidad: "porcentaje",
    tolerancia: TOLERANCIA_ESTANDAR,
  },
  incidencia_rechazo: {
    id: "incidencia_rechazo",
    etiqueta: "Incidencia (rechazo)",
    valor: 0.15,
    direccion: "maximo",
    unidad: "porcentaje",
    tolerancia: TOLERANCIA_ESTANDAR,
  },
  dias_ciclo: {
    id: "dias_ciclo",
    etiqueta: "Días de confirmado a entregado",
    valor: 4,
    direccion: "maximo",
    unidad: "dias",
    tolerancia: TOLERANCIA_ESTANDAR,
  },
  recompra: {
    id: "recompra",
    etiqueta: "Recompra",
    valor: 0.2,
    direccion: "minimo",
    unidad: "porcentaje",
    tolerancia: TOLERANCIA_ESTANDAR,
  },
  retorno_publicidad: {
    id: "retorno_publicidad",
    etiqueta: "Retorno de publicidad",
    valor: 4,
    direccion: "minimo",
    unidad: "veces",
    tolerancia: 0.2,
  },
  ventas_sin_guia: {
    id: "ventas_sin_guia",
    etiqueta: "Ventas sin guía +24 h",
    valor: 0,
    direccion: "maximo",
    unidad: "cantidad",
    tolerancia: 0,
  },
};

export const METAS_ESPECIFICACION: MetasPanel = {
  indicadores: METAS_INDICADORES_ESPECIFICACION,
  mensuales: { porCanal: {}, porVendedora: {}, porConfirmadora: {} },
};
