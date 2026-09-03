"use client";

/**
 * Objetivo de CPV, presupuesto del mes y meta de ventas por canal —
 * persistido en localStorage por empresa+canal (solución puente, ver
 * `useLocalStorage.ts`). No existe esto en ningún servicio: es lo que en
 * `_mock/data.ts` (ya eliminado) vivía como `DIARIO_MOCK[canal].obj`
 * hardcodeado — acá lo pone el usuario y se guarda de verdad, en vez de ser
 * un número inventado igual para todas las empresas.
 */

import { useLocalStorageState } from "./useLocalStorage";

export interface ObjetivoCanal {
  objetivoCpv: number;
  presupuestoMes: number;
  metaVentasMes: number;
}

export const OBJETIVO_DEFAULT: ObjetivoCanal = { objetivoCpv: 0, presupuestoMes: 0, metaVentasMes: 0 };

const storageKey = (companyId: string, canalId: string) => `powip:admin:objetivo-canal:${companyId || "anon"}:${canalId}`;

export function useObjetivoCanal(companyId: string, canalId: string) {
  return useLocalStorageState<ObjetivoCanal>(storageKey(companyId, canalId), OBJETIVO_DEFAULT);
}
