"use client";

/**
 * Capital y préstamos (FEAT-34 M7) — en localStorage por empresa: solo en este navegador. No existe backend para
 * esto todavía (la Fase 3 lo pasa al servidor o lo retira, D6).
 *
 * Arreglos de FEAT-34:
 * - La tasa de un préstamo es TEA (así se informa en Perú): la tasa mensual es `(1 + TEA)^(1/12) − 1`, no TEA ÷ 12.
 * - La fecha de inicio es un día `YYYY-MM-DD` de Lima: las cuotas se calculan sobre la clave (nunca
 *   `new Date("YYYY-MM-DD")`, que en Perú cae el día anterior).
 * - La «utilidad reinvertida» no se suma al capital: ya está en la utilidad. Sumarla contaba la misma plata dos veces.
 * - Cada préstamo tiene su propia tabla de amortización (antes solo el primero).
 */

import { type DiaKey, esDiaKey, hoyLima, MESES_CORTOS, partes, sumarMeses } from "./periodo";
import { useLocalStorageState } from "./useLocalStorage";

export type CapitalTipo = "Capital propio" | "Aumento de capital" | "Préstamo" | "Utilidad reinvertida";

export const TIPOS_CAPITAL: CapitalTipo[] = ["Capital propio", "Aumento de capital", "Préstamo", "Utilidad reinvertida"];

export interface CapitalEntry {
  id: string;
  tipo: CapitalTipo;
  descripcion: string;
  monto: number;
  tienda: string;
  // Solo si tipo === "Préstamo" — insumos para generar la amortización.
  /** Tasa efectiva anual (TEA) en %. */
  tasaAnualPct?: number;
  plazoCuotas?: number;
  cuotaMensual?: number;
  /** Día `YYYY-MM-DD` del desembolso; la cuota 1 vence un mes después. */
  fechaInicio?: string;
}

const kCapital = (companyId: string) => `powip:admin:capital:${companyId || "anon"}`;
const kCuotasPagadas = (companyId: string, prestamoId: string) =>
  `powip:admin:capital-cuotas-pagadas:${companyId || "anon"}:${prestamoId}`;

export function useCapitalEntries(companyId: string) {
  return useLocalStorageState<CapitalEntry[]>(kCapital(companyId), []);
}

export function useCuotasPagadas(companyId: string, prestamoId: string) {
  return useLocalStorageState<number>(kCuotasPagadas(companyId, prestamoId), 0);
}

const centavos = (valor: number) => Math.round(valor * 100) / 100;

/** Tasa mensual equivalente a una TEA en % (12,68 % TEA → 1 % mensual). */
export function tasaMensualDeTea(teaPct: number): number {
  if (!Number.isFinite(teaPct) || teaPct <= 0) return 0;
  return (1 + teaPct / 100) ** (1 / 12) - 1;
}

/** Cuota fija del sistema francés para un monto, TEA en % y plazo en meses; null si faltan datos. */
export function cuotaFrancesa(monto: number, teaPct: number, plazo: number): number | null {
  if (!(monto > 0) || !(plazo > 0)) return null;
  const i = tasaMensualDeTea(teaPct);
  if (i === 0) return centavos(monto / plazo);
  return centavos((monto * i) / (1 - (1 + i) ** -plazo));
}

/** «28 feb 2026». */
export function textoDia(dia: DiaKey): string {
  const [a, m, d] = partes(dia);
  return `${d} ${MESES_CORTOS[m - 1]} ${a}`;
}

export type EstadoCuota = "pagada" | "proxima" | "pendiente";

export interface CuotaAmortizacion {
  n: number;
  /** Vencimiento como día `YYYY-MM-DD`. */
  dia: DiaKey;
  fecha: string;
  cuota: number;
  capital: number;
  interes: number;
  saldo: number;
  estado: EstadoCuota;
}

/**
 * Tabla de amortización de un préstamo de cuota fija. Cada cuota vence el mismo día del mes que el desembolso (o el
 * último día, si el mes es más corto). La última cuota cancela el saldo; si la deuda se termina antes, la tabla corta.
 */
export function generarAmortizacion(
  entry: CapitalEntry,
  cuotasPagadas: number,
  hoy: DiaKey = hoyLima(),
): CuotaAmortizacion[] {
  if (!entry.plazoCuotas || !entry.cuotaMensual || entry.tasaAnualPct == null || !(entry.monto > 0)) return [];
  const tasa = tasaMensualDeTea(entry.tasaAnualPct);
  const inicio = esDiaKey(entry.fechaInicio) ? entry.fechaInicio : hoy;
  let saldo = entry.monto;
  const out: CuotaAmortizacion[] = [];
  for (let n = 1; n <= entry.plazoCuotas && saldo > 0.004; n++) {
    const interes = centavos(saldo * tasa);
    let capital = Math.min(saldo, entry.cuotaMensual - interes);
    if (n === entry.plazoCuotas) capital = saldo;
    capital = centavos(Math.max(0, capital));
    saldo = centavos(Math.max(0, saldo - capital));
    const dia = sumarMeses(inicio, n);
    out.push({
      n,
      dia,
      fecha: textoDia(dia),
      cuota: centavos(capital + interes),
      capital,
      interes,
      saldo,
      estado: n <= cuotasPagadas ? "pagada" : n === cuotasPagadas + 1 ? "proxima" : "pendiente",
    });
  }
  return out;
}

export interface ResumenPrestamo {
  pagadas: number;
  pagado: number;
  saldo: number;
  interesTotal: number;
  proxima: CuotaAmortizacion | null;
}

export function resumirPrestamo(entry: CapitalEntry, cuotas: CuotaAmortizacion[]): ResumenPrestamo {
  const pagadas = cuotas.filter((c) => c.estado === "pagada");
  const ultima = pagadas[pagadas.length - 1];
  return {
    pagadas: pagadas.length,
    pagado: centavos(pagadas.reduce((s, c) => s + c.cuota, 0)),
    saldo: ultima ? ultima.saldo : entry.monto,
    interesTotal: centavos(cuotas.reduce((s, c) => s + c.interes, 0)),
    proxima: cuotas.find((c) => c.estado === "proxima") ?? null,
  };
}

export interface ResumenCapital {
  /** Capital propio + aumentos de capital. */
  aportes: number;
  prestamos: number;
  /** Aportes + préstamos: el capital puesto en el negocio. */
  invertido: number;
  /** Informativo: ya es parte de la utilidad, no se suma al capital. */
  reinvertida: number;
}

export function resumirCapital(entries: CapitalEntry[] | null | undefined): ResumenCapital {
  let aportes = 0;
  let prestamos = 0;
  let reinvertida = 0;
  for (const entry of entries ?? []) {
    const monto = Number(entry.monto) || 0;
    if (entry.tipo === "Préstamo") prestamos += monto;
    else if (entry.tipo === "Utilidad reinvertida") reinvertida += monto;
    else aportes += monto;
  }
  return { aportes, prestamos, invertido: aportes + prestamos, reinvertida };
}
