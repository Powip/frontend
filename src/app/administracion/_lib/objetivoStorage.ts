"use client";

/**
 * Objetivo diario de ventas por canal (Ventas › Control diario).
 *
 * FEAT-34 Fase 3: se guarda en el servidor (`panel_metas`, tipo `admin_objetivo_dia`) y lo ve todo el equipo. El canal
 * va con su clave normalizada (`claveCanal`), así «LIVE TIKTOK» y «TIKTOK_LIVE» comparten objetivo; «Todos los canales»
 * tiene el suyo propio (`todos`).
 *
 * Lo que quedó en el navegador (clave `powip:admin:objetivo-canal:<empresa>:<canal>`, versión anterior) solo se lee
 * para subirlo una vez (`leerObjetivo`, `ImportarNavegador`). La versión de antes de esa guardaba
 * `{ objetivoCpv, presupuestoMes, metaVentasMes }`: el CPV y el presupuesto se ignoran (D2) y la meta mensual se respeta
 * repartida por los días de cada mes.
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { claveCanal } from "./canales";
import { mensajeError, useObjetivosServidor } from "./datosServidor";
import { type DiaKey, diasDelMes, partes } from "./periodo";

/** Clave de «Todos los canales». En minúsculas: `claveCanal` siempre devuelve mayúsculas, así que no choca. */
export const TODOS_LOS_CANALES = "todos";

export interface ObjetivoCanal {
  /** Objetivo de ventas por día (S/), o null si no hay. */
  ventasDia: number | null;
  /** Meta mensual guardada por la versión anterior (solo lectura). */
  metaVentasMes: number | null;
}

export const OBJETIVO_VACIO: ObjetivoCanal = { ventasDia: null, metaVentasMes: null };

export function claveObjetivo(canal: string): string {
  return canal === TODOS_LOS_CANALES ? TODOS_LOS_CANALES : claveCanal(canal);
}

export function storageKeyObjetivo(companyId: string, canal: string): string {
  return `powip:admin:objetivo-canal:${companyId || "anon"}:${claveObjetivo(canal)}`;
}

const positivo = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Lo guardado (de esta versión o de la anterior) llevado a la forma actual. */
export function normalizarObjetivo(valor: unknown): ObjetivoCanal {
  if (!valor || typeof valor !== "object") return OBJETIVO_VACIO;
  const v = valor as Record<string, unknown>;
  return { ventasDia: positivo(v.ventasDia), metaVentasMes: positivo(v.metaVentasMes) };
}

export function hayObjetivo(objetivo: ObjetivoCanal): boolean {
  return objetivo.ventasDia !== null || objetivo.metaVentasMes !== null;
}

/** Objetivo de ventas de un día: el diario, o la meta mensual anterior ÷ días de ese mes. */
export function objetivoDelDia(objetivo: ObjetivoCanal, dia: DiaKey): number | null {
  if (objetivo.ventasDia !== null) return objetivo.ventasDia;
  if (objetivo.metaVentasMes === null) return null;
  const [anio, mes] = partes(dia);
  return objetivo.metaVentasMes / diasDelMes(anio, mes);
}

/** Suma de los objetivos de varios días; null si no hay objetivo. */
export function objetivoDeDias(objetivo: ObjetivoCanal, dias: DiaKey[]): number | null {
  if (!hayObjetivo(objetivo)) return null;
  return dias.reduce((s, dia) => s + (objetivoDelDia(objetivo, dia) ?? 0), 0);
}

/** Avance contra el objetivo como fracción (1 = cumplido); null sin objetivo. */
export function avanceObjetivo(logrado: number, objetivo: number | null): number | null {
  return objetivo !== null && objetivo > 0 ? logrado / objetivo : null;
}

export function leerObjetivo(companyId: string, canal: string): ObjetivoCanal {
  if (typeof window === "undefined") return OBJETIVO_VACIO;
  try {
    const raw = window.localStorage.getItem(storageKeyObjetivo(companyId, canal));
    return raw ? normalizarObjetivo(JSON.parse(raw)) : OBJETIVO_VACIO;
  } catch {
    return OBJETIVO_VACIO;
  }
}

/** Objetivo del canal (del servidor) y cómo guardarlo (`null` lo borra). `companyId` queda por compatibilidad. */
export function useObjetivoCanal(_companyId: string, canal: string) {
  const clave = claveObjetivo(canal);
  const { query, guardar: mutacion } = useObjetivosServidor();
  const { mutate } = mutacion;
  const guardar = useCallback(
    (ventasDia: number | null) =>
      mutate(
        { canal: clave, ventasDia: positivo(ventasDia) },
        { onError: (error) => toast.error(mensajeError(error, "No se pudo guardar el objetivo")) },
      ),
    [mutate, clave],
  );
  const ventasDia = positivo(query.data?.objetivos[clave]);
  return {
    objetivo: ventasDia === null ? OBJETIVO_VACIO : { ventasDia, metaVentasMes: null },
    guardar,
    cargado: query.isSuccess,
    guardando: mutacion.isPending,
    error: query.error ?? mutacion.error ?? null,
  };
}
