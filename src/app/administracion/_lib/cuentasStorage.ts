"use client";

/**
 * Estado de Cuentas x Cobrar/Pagar — persistido en localStorage por empresa
 * (solución puente, ver `useLocalStorage.ts`): cuentas manuales, qué
 * cuentas automáticas ya se confirmaron (para que no reaparezcan al
 * recargar) y el historial de movimientos confirmados.
 */

import { useLocalStorageState } from "./useLocalStorage";
import type { MovimientoHistorial } from "../_mock/data";

export interface CuentaManual {
  id: string;
  icono: string;
  concepto: string;
  descripcion: string;
  monto: number;
  vencimiento: string;
  urgencia: "rojo" | "ambar" | "azul";
  auto: boolean;
}

const kCobrar = (companyId: string) => `powip:admin:cuentas-cobrar:${companyId || "anon"}`;
const kPagar = (companyId: string) => `powip:admin:cuentas-pagar:${companyId || "anon"}`;
const kConfirmados = (companyId: string) => `powip:admin:cuentas-confirmados:${companyId || "anon"}`;
const kHistorial = (companyId: string) => `powip:admin:cuentas-historial:${companyId || "anon"}`;

export function useCuentasManualCobrar(companyId: string) {
  return useLocalStorageState<CuentaManual[]>(kCobrar(companyId), []);
}

export function useCuentasManualPagar(companyId: string) {
  return useLocalStorageState<CuentaManual[]>(kPagar(companyId), []);
}

export function useCuentasConfirmadas(companyId: string) {
  return useLocalStorageState<string[]>(kConfirmados(companyId), []);
}

export function useCuentasHistorial(companyId: string) {
  return useLocalStorageState<MovimientoHistorial[]>(kHistorial(companyId), []);
}
