"use client";

/**
 * Cuentas por cobrar y pagar (FEAT-34: C7, M8).
 *
 * - Lo manual (cuentas por cobrar, por pagar y el historial de lo que se marcó como cobrado o pagado) vive en
 *   localStorage por empresa: solo en este navegador. La Fase 3 lo pasa al backend o lo retira (D6).
 * - El saldo en calle sale de los pedidos en tránsito (`usePedidosEnTransito`); acá solo se agrupa por courier.
 *
 * Ya no hay «vencidas» ni «próximas a vencer»: el vencimiento es texto libre y esas secciones salían siempre vacías.
 */

import { type PedidoAdmin, saldoPedido } from "./ventas";
import { useLocalStorageState } from "./useLocalStorage";

export interface CuentaManual {
  id: string;
  concepto: string;
  descripcion: string;
  monto: number;
  /** Texto libre («Vence 30 de mayo», «A fin de mes»…). No es una fecha. */
  vencimiento: string;
  /** Campos de la versión anterior; se conservan en lo ya guardado y no se usan. */
  icono?: string;
  urgencia?: "rojo" | "ambar" | "azul";
  auto?: boolean;
}

export type TipoMovimiento = "ingreso" | "egreso";

export interface MovimientoHistorial {
  id: string;
  /** `YYYY-MM` (hora Lima). */
  mes: string;
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
}

const kCobrar = (companyId: string) => `powip:admin:cuentas-cobrar:${companyId || "anon"}`;
const kPagar = (companyId: string) => `powip:admin:cuentas-pagar:${companyId || "anon"}`;
const kHistorial = (companyId: string) => `powip:admin:cuentas-historial:${companyId || "anon"}`;

export function useCuentasManualCobrar(companyId: string) {
  return useLocalStorageState<CuentaManual[]>(kCobrar(companyId), []);
}

export function useCuentasManualPagar(companyId: string) {
  return useLocalStorageState<CuentaManual[]>(kPagar(companyId), []);
}

export function useCuentasHistorial(companyId: string) {
  return useLocalStorageState<MovimientoHistorial[]>(kHistorial(companyId), []);
}

export function totalCuentas(cuentas: { monto: number }[] | null | undefined): number {
  return (cuentas ?? []).reduce((s, c) => s + (Number(c.monto) || 0), 0);
}

export interface SaldoCourier {
  clave: string;
  courier: string;
  pedidos: number;
  /** Pedidos con algo por cobrar (los pagados por adelantado no suman saldo). */
  conSaldo: number;
  saldo: number;
}

/** Saldo por cobrar de los pedidos en calle, agrupado por courier (sin distinguir mayúsculas ni espacios). */
export function saldoEnCallePorCourier(pedidos: PedidoAdmin[] | null | undefined): SaldoCourier[] {
  const grupos = new Map<string, SaldoCourier & { grafias: Map<string, number> }>();
  for (const pedido of pedidos ?? []) {
    const crudo = (pedido.courier ?? "").trim().replace(/\s+/g, " ");
    const clave = crudo ? crudo.toUpperCase() : "SIN_COURIER";
    const grupo = grupos.get(clave) ?? {
      clave,
      courier: crudo || "Sin courier",
      pedidos: 0,
      conSaldo: 0,
      saldo: 0,
      grafias: new Map<string, number>(),
    };
    const saldo = saldoPedido(pedido);
    grupo.pedidos += 1;
    grupo.saldo += saldo;
    if (saldo > 0) grupo.conSaldo += 1;
    if (crudo) grupo.grafias.set(crudo, (grupo.grafias.get(crudo) ?? 0) + 1);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()]
    .map(({ grafias, ...grupo }) => ({
      ...grupo,
      courier: [...grafias.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? grupo.courier,
    }))
    .sort((a, b) => b.saldo - a.saldo || a.courier.localeCompare(b.courier));
}
