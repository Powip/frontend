import type { EvaluacionMeta, MetaIndicador, SemaforoEstado } from "../models/goal.model";

const TOLERANCIA_META_CERO = 2;

function normalize(value: number, meta: MetaIndicador): number {
  return meta.unidad === "porcentaje" ? Math.round(value * 100) / 100 : value;
}

export function evaluarSemaforo(
  value: number | null | undefined,
  meta: MetaIndicador,
): SemaforoEstado {
  if (typeof value !== "number" || !Number.isFinite(value)) return "sin_datos";
  const v = normalize(value, meta);
  if (meta.direccion === "minimo") {
    if (v >= meta.valor) return "cumple";
    return v >= meta.valor * (1 - meta.tolerancia) ? "cerca" : "bajo";
  }
  if (v <= meta.valor) return "cumple";
  const limiteCerca = meta.valor === 0 ? TOLERANCIA_META_CERO : meta.valor * (1 + meta.tolerancia);
  return v <= limiteCerca ? "cerca" : "bajo";
}

export function evaluarMeta(value: number | null | undefined, meta: MetaIndicador): EvaluacionMeta {
  return {
    estado: evaluarSemaforo(value, meta),
    meta,
    valor: typeof value === "number" && Number.isFinite(value) ? value : null,
  };
}

export function evaluarAvance(
  logrado: number | null | undefined,
  metaPeriodo: number | null | undefined,
  tolerancia = 0.15,
): SemaforoEstado {
  if (typeof logrado !== "number" || typeof metaPeriodo !== "number" || metaPeriodo <= 0) {
    return "sin_datos";
  }
  const avance = logrado / metaPeriodo;
  if (avance >= 1) return "cumple";
  return avance >= 1 - tolerancia ? "cerca" : "bajo";
}

export const SEMAFORO_ETIQUETA: Record<SemaforoEstado, string> = {
  cumple: "Cumple",
  cerca: "Cerca",
  bajo: "Bajo meta",
  sin_datos: "Sin datos",
};
