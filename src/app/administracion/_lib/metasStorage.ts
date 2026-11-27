"use client";

/**
 * Metas anuales — FEAT-34 Fase 3: en el servidor (`panel_metas`, tipo `admin_anual`), por empresa y año; las ve todo
 * el equipo. Fuente única para Resumen anual (donde se editan), Resumen y Reporte rápido. Lo que quedó en el navegador
 * (`powip:admin:metas:<empresa>:<año>`) se sube una vez con `ImportarNavegador`.
 *
 * Sin valores por defecto (D5, 25-11-2026): antes se usaban 500.000 / 85.000 / 20 % inventados y las pantallas
 * comparaban contra eso. Una meta sin cargar es `null` y la pantalla muestra «Sin meta».
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { mensajeError, useMetasServidor } from "./datosServidor";

export interface MetasAnuales {
  ventasAnual: number | null;
  profitAnual: number | null;
  margenObjetivoPct: number | null;
}

export const METAS_VACIAS: MetasAnuales = { ventasAnual: null, profitAnual: null, margenObjetivoPct: null };

/** Clave del navegador donde vivían las metas antes de la Fase 3 (solo para importarlas). */
export const storageKeyMetas = (companyId: string, anio: number) => `powip:admin:metas:${companyId || "anon"}:${anio}`;

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

/** Metas del año (del servidor) y cómo guardarlas. `companyId` queda por compatibilidad (la empresa sale del token). */
export function useMetasAnuales(_companyId: string, anio: number) {
  const { query, guardar } = useMetasServidor(anio);
  const { mutate } = guardar;
  const setMetas = useCallback(
    (metas: MetasAnuales) => {
      const limpias = normalizarMetas(metas);
      mutate(
        { anio, ...limpias },
        { onError: (error) => toast.error(mensajeError(error, "No se pudieron guardar las metas")) },
      );
    },
    [mutate, anio],
  );
  return [normalizarMetas(query.data), setMetas, { cargando: query.isLoading, guardando: guardar.isPending, error: query.error ?? guardar.error ?? null }] as const;
}
