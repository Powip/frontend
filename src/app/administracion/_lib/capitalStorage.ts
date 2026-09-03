"use client";

/**
 * Capital & préstamo — persistido en localStorage por empresa (solución
 * puente, ver `useLocalStorage.ts`). No existe `capital_entry` ni
 * `prestamo_cuota` en ningún microservicio (§20 doc) — mientras tanto arranca
 * vacío (nada de datos de ejemplo mostrados como si fueran reales) y lo que
 * el usuario registre sobrevive a recargar la página, pero vive solo en
 * este navegador/dispositivo.
 */

import { useLocalStorageState } from "./useLocalStorage";

export type CapitalTipo = "Capital propio" | "Aumento de capital" | "Préstamo" | "Utilidad reinvertida";

export interface CapitalEntry {
  id: string;
  tipo: CapitalTipo;
  descripcion: string;
  monto: number;
  tienda: string;
  // Solo si tipo === "Préstamo" — insumos para generar la amortización.
  tasaAnualPct?: number;
  plazoCuotas?: number;
  cuotaMensual?: number;
  fechaInicio?: string; // yyyy-MM-dd
}

const kCapital = (companyId: string) => `powip:admin:capital:${companyId || "anon"}`;
const kCuotasPagadas = (companyId: string, prestamoId: string) => `powip:admin:capital-cuotas-pagadas:${companyId || "anon"}:${prestamoId}`;

export function useCapitalEntries(companyId: string) {
  return useLocalStorageState<CapitalEntry[]>(kCapital(companyId), []);
}

export function useCuotasPagadas(companyId: string, prestamoId: string) {
  return useLocalStorageState<number>(kCuotasPagadas(companyId, prestamoId), 0);
}

export type EstadoCuota = "pagada" | "proxima" | "pendiente";

export interface CuotaAmortizacion {
  n: number;
  fecha: string;
  cuota: number;
  capital: number;
  interes: number;
  saldo: number;
  estado: EstadoCuota;
}

/** Genera la tabla de amortización de un préstamo a partir de sus datos registrados (§14 doc: amortización por cuota). */
export function generarAmortizacion(entry: CapitalEntry, cuotasPagadas: number): CuotaAmortizacion[] {
  if (!entry.plazoCuotas || !entry.cuotaMensual || entry.tasaAnualPct == null) return [];
  const tasaMensual = entry.tasaAnualPct / 100 / 12;
  const inicio = entry.fechaInicio ? new Date(entry.fechaInicio) : new Date();
  let saldo = entry.monto;
  const out: CuotaAmortizacion[] = [];
  for (let n = 1; n <= entry.plazoCuotas; n++) {
    const interes = Math.round(saldo * tasaMensual);
    let capital = entry.cuotaMensual - interes;
    let cuota = entry.cuotaMensual;
    if (n === entry.plazoCuotas) {
      capital = saldo;
      cuota = saldo + interes;
    }
    saldo = Math.max(0, saldo - capital);
    const fecha = new Date(inicio);
    fecha.setMonth(fecha.getMonth() + n);
    const estado: EstadoCuota = n <= cuotasPagadas ? "pagada" : n === cuotasPagadas + 1 ? "proxima" : "pendiente";
    out.push({
      n,
      fecha: fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }),
      cuota: Math.round(cuota),
      capital: Math.round(capital),
      interes,
      saldo: Math.round(saldo),
      estado,
    });
  }
  return out;
}
