"use client";

/**
 * Inversión de pauta — persistida en localStorage por empresa (solución
 * puente, ver `useLocalStorage.ts`). Modela un registro por cada vez que se
 * guarda inversión (con fecha), en vez de "el monto actual del canal", para
 * poder filtrar por periodo (hoy/semana/quincena/mes) en Reporte rápido —
 * igual que `pauta_registro` en el modelo de datos del doc (§20).
 */

import { useLocalStorageState } from "./useLocalStorage";
import type { PautaLinea } from "../_mock/data";

export interface PautaEntry {
  id: string;
  canalId: string;
  fecha: string; // yyyy-MM-dd
  monto: number;
  lineas: PautaLinea[];
}

const storageKey = (companyId: string) => `powip:admin:pauta:${companyId || "anon"}`;

export function usePautaEntries(companyId: string) {
  return useLocalStorageState<PautaEntry[]>(storageKey(companyId), []);
}

export function entriesEnRango(entries: PautaEntry[], from: string, to: string): PautaEntry[] {
  return entries.filter((e) => e.fecha >= from && e.fecha <= to);
}

/** Líneas de un canal, sumadas entre todos los registros del rango — insumo de `computeCanal`. */
export function lineasPorCanalEnRango(entries: PautaEntry[], canalId: string, from: string, to: string): PautaLinea[] {
  const relevantes = entriesEnRango(entries, from, to).filter((e) => e.canalId === canalId);
  const map = new Map<string, PautaLinea>();
  for (const e of relevantes) {
    for (const l of e.lineas) {
      const k = `${l.tipo}:${l.ref}`;
      const acc = map.get(k);
      if (acc) acc.monto += l.monto;
      else map.set(k, { tipo: l.tipo, ref: l.ref, monto: l.monto });
    }
  }
  return Array.from(map.values());
}

/** Inversión total (todos los canales) dentro de un rango de fechas — insumo de Reporte rápido. */
export function totalInvertidoEnRango(entries: PautaEntry[], from: string, to: string): number {
  return entriesEnRango(entries, from, to).reduce((s, e) => s + e.monto, 0);
}

/** Inversión de un canal, agrupada por día (1-31) dentro de un mes — insumo de Control diario. */
export function inversionPorDia(entries: PautaEntry[], canalId: string, mes: number, anio: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const e of entries) {
    if (e.canalId !== canalId) continue;
    // Parseo por partes (no `new Date(fecha)`) para evitar corrimientos de huso horario.
    const [y, m, d] = e.fecha.split("-").map(Number);
    if (y !== anio || m !== mes) continue;
    out[d] = (out[d] ?? 0) + e.monto;
  }
  return out;
}

/** Inversión total (todos los canales), agrupada por mes (1-12) dentro de un año — insumo de Flujo de Caja y Resumen Anual. */
export function inversionPorMes(entries: PautaEntry[], anio: number): number[] {
  const out = Array(12).fill(0);
  for (const e of entries) {
    const [y, m] = e.fecha.split("-").map(Number);
    if (y !== anio) continue;
    out[m - 1] += e.monto;
  }
  return out;
}
