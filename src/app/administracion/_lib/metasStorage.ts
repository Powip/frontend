"use client";

/**
 * Metas anuales — persistidas en localStorage por empresa y año (solución
 * puente, ver `useLocalStorage.ts`). Fuente única para Resumen Anual y para
 * la meta mensual (ventasAnual ÷ 12) que usa Reporte rápido.
 */

import { useLocalStorageState } from "./useLocalStorage";

export interface MetasAnuales {
  ventasAnual: number;
  profitAnual: number;
  margenObjetivoPct: number;
}

export const METAS_DEFAULT: MetasAnuales = { ventasAnual: 500000, profitAnual: 85000, margenObjetivoPct: 20 };

const storageKey = (companyId: string, anio: number) => `powip:admin:metas:${companyId || "anon"}:${anio}`;

export function useMetasAnuales(companyId: string, anio: number) {
  return useLocalStorageState<MetasAnuales>(storageKey(companyId, anio), METAS_DEFAULT);
}
