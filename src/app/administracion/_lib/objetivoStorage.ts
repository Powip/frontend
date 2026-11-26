"use client";

/**
 * Objetivo diario de ventas por canal (Ventas › Control diario).
 *
 * Vive solo en el navegador (localStorage), por empresa y canal: otro usuario u otra computadora no lo ve. La pantalla
 * lo rotula así. El canal se guarda con su clave normalizada (`claveCanal`), así «LIVE TIKTOK» y «TIKTOK_LIVE»
 * comparten objetivo; «Todos los canales» tiene el suyo propio.
 *
 * La versión anterior guardaba `{ objetivoCpv, presupuestoMes, metaVentasMes }` con la misma clave. El CPV y el
 * presupuesto se medían contra la inversión manual (ya no entra a ningún cálculo, D2) y se ignoran. La meta mensual
 * se respeta repartida por los días de cada mes hasta que se guarde un objetivo diario.
 *
 * No usa `useLocalStorageState`: ese hook escribe en cada cambio (y, al cambiar de clave, por un instante escribe el
 * valor de la clave anterior en la nueva). Acá se cambia de canal seguido, así que solo se escribe al guardar.
 */

import { useCallback, useEffect, useState } from "react";
import { claveCanal } from "./canales";
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

/** Objetivo del canal y cómo guardarlo (`null` lo borra). */
export function useObjetivoCanal(companyId: string, canal: string) {
  const key = storageKeyObjetivo(companyId, canal);
  const [leido, setLeido] = useState<{ key: string; objetivo: ObjetivoCanal } | null>(null);

  useEffect(() => {
    setLeido({ key, objetivo: leerObjetivo(companyId, canal) });
    // `key` resume companyId y canal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const guardar = useCallback(
    (ventasDia: number | null) => {
      const objetivo: ObjetivoCanal = { ventasDia: positivo(ventasDia), metaVentasMes: null };
      try {
        if (objetivo.ventasDia === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify({ ventasDia: objetivo.ventasDia }));
      } catch {
        // localStorage lleno o bloqueado: el objetivo queda solo en memoria.
      }
      setLeido({ key, objetivo });
    },
    [key],
  );

  const vigente = leido?.key === key;
  return { objetivo: vigente ? leido.objetivo : OBJETIVO_VACIO, guardar, cargado: vigente };
}
