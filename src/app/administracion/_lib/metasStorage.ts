"use client";

/**
 * Metas anuales — persistidas en localStorage por empresa y año (solución puente: la Fase 3 de FEAT-34 las pasa al
 * backend). Fuente única para Resumen Anual, Resumen y Reporte rápido.
 *
 * Sin valores por defecto (D5, 25-11-2026): antes se usaban 500.000 / 85.000 / 20 % inventados y las pantallas
 * comparaban contra eso. Una meta sin cargar es `null` y la pantalla muestra «Sin meta».
 */

import { useLocalStorageState } from "./useLocalStorage";

export interface MetasAnuales {
  ventasAnual: number | null;
  profitAnual: number | null;
  margenObjetivoPct: number | null;
}

export const METAS_VACIAS: MetasAnuales = { ventasAnual: null, profitAnual: null, margenObjetivoPct: null };

const storageKey = (companyId: string, anio: number) => `powip:admin:metas:${companyId || "anon"}:${anio}`;

const positivo = (valor: unknown): number | null => {
  const n = Number(valor);
  return valor !== null && valor !== undefined && valor !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Normaliza lo guardado: lo que no sea un número positivo es «sin meta». El hook viejo guardaba los valores por
 * defecto apenas se abría la pantalla, así que 500.000 / 85.000 / 20 juntos se toman como «nunca cargadas».
 */
export function normalizarMetas(valor: Partial<MetasAnuales> | null | undefined): MetasAnuales {
  if (
    Number(valor?.ventasAnual) === 500000 &&
    Number(valor?.profitAnual) === 85000 &&
    Number(valor?.margenObjetivoPct) === 20
  ) {
    return METAS_VACIAS;
  }
  return {
    ventasAnual: positivo(valor?.ventasAnual),
    profitAnual: positivo(valor?.profitAnual),
    margenObjetivoPct: positivo(valor?.margenObjetivoPct),
  };
}

export function hayMetas(metas: MetasAnuales): boolean {
  return metas.ventasAnual !== null || metas.profitAnual !== null || metas.margenObjetivoPct !== null;
}

/** Meta de ventas de un mes (anual ÷ 12), o null. */
export function metaVentasMensual(metas: MetasAnuales): number | null {
  return metas.ventasAnual !== null ? metas.ventasAnual / 12 : null;
}

export function useMetasAnuales(companyId: string, anio: number) {
  const [guardadas, setMetas] = useLocalStorageState<MetasAnuales>(storageKey(companyId, anio), METAS_VACIAS);
  return [normalizarMetas(guardadas), setMetas] as const;
}
