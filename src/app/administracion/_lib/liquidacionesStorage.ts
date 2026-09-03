"use client";

/**
 * Qué liquidaciones de courier ya se confirmaron — persistido en
 * localStorage por empresa (solución puente, ver `useLocalStorage.ts`).
 *
 * Guarda fecha de confirmación por courier, no solo el nombre — así
 * `agruparPorCourier` (`_lib/realData.ts`) puede excluir únicamente los
 * pedidos ya cubiertos por esa confirmación, y volver a mostrar al courier
 * si acumula un saldo nuevo después. Antes se guardaba solo el nombre, así
 * que confirmar un courier lo sacaba de la vista para siempre, incluso
 * cuando entregas nuevas generaban deuda nueva.
 */

import { useMemo } from "react";
import { useLocalStorageState } from "./useLocalStorage";

export interface LiquidacionConfirmada {
  courier: string;
  confirmadoEn: string; // ISO
}

const storageKey = (companyId: string) => `powip:admin:liquidaciones-confirmadas:${companyId || "anon"}`;

export function useLiquidacionesConfirmadas(companyId: string) {
  return useLocalStorageState<LiquidacionConfirmada[]>(storageKey(companyId), []);
}

/** Fecha de la confirmación más reciente por courier — insumo de `agruparPorCourier`. */
export function useCutoffPorCourier(confirmados: LiquidacionConfirmada[]): Record<string, Date> {
  return useMemo(() => {
    const out: Record<string, Date> = {};
    for (const c of confirmados) {
      const fecha = new Date(c.confirmadoEn);
      if (!out[c.courier] || fecha > out[c.courier]) out[c.courier] = fecha;
    }
    return out;
  }, [confirmados]);
}
