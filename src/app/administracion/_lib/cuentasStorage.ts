/**
 * Cuentas por cobrar y pagar (FEAT-34: C7, M8, Fase 3).
 *
 * - Lo manual (cuentas por cobrar y por pagar, y las ya cobradas o pagadas) se guarda en el servidor desde la Fase 3
 *   (`ventas.admin_cuentas`, hooks en `datosServidor.ts`), con el vencimiento como fecha.
 * - El saldo en calle por courier llega calculado de ms-ventas (`usePedidosEnTransito`, una fila por grafía de courier);
 *   acá solo se juntan las grafías de un mismo courier.
 */

import type { CourierEnTransito, CuentaServidor } from "@/interfaces/IAdministracion";
import type { DiaKey } from "./periodo";

/** Pendientes (sin `saldadaEn`) de un lado, las que vencen primero arriba (sin vencimiento al final). */
export function cuentasAbiertas(cuentas: readonly CuentaServidor[] | undefined, lado: CuentaServidor["lado"]) {
  return (cuentas ?? [])
    .filter((c) => c.lado === lado && !c.saldadaEn)
    .sort((a, b) => (a.vence ?? "9999").localeCompare(b.vence ?? "9999") || a.creadoEn.localeCompare(b.creadoEn));
}

/** Ya cobradas o pagadas, la más reciente arriba. */
export function cuentasSaldadas(cuentas: readonly CuentaServidor[] | undefined) {
  return (cuentas ?? [])
    .filter((c) => !!c.saldadaEn)
    .sort((a, b) => (b.saldadaEn ?? "").localeCompare(a.saldadaEn ?? "") || b.creadoEn.localeCompare(a.creadoEn));
}

/** Una cuenta pendiente con vencimiento anterior a hoy. */
export const estaVencida = (cuenta: Pick<CuentaServidor, "vence" | "saldadaEn">, hoy: DiaKey | string) =>
  !cuenta.saldadaEn && !!cuenta.vence && cuenta.vence < hoy;

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

/**
 * Saldo por cobrar de los pedidos en calle por courier, juntando las grafías de un mismo courier (sin distinguir
 * mayúsculas ni espacios). El nombre que se muestra es la grafía con más pedidos.
 */
export function saldoEnCallePorCourier(filas: readonly CourierEnTransito[] | null | undefined): SaldoCourier[] {
  const grupos = new Map<string, SaldoCourier & { grafias: Map<string, number> }>();
  for (const fila of filas ?? []) {
    const crudo = (fila.courier ?? "").trim().replace(/\s+/g, " ");
    const clave = crudo ? crudo.toUpperCase() : "SIN_COURIER";
    const grupo = grupos.get(clave) ?? {
      clave,
      courier: crudo || "Sin courier",
      pedidos: 0,
      conSaldo: 0,
      saldo: 0,
      grafias: new Map<string, number>(),
    };
    grupo.pedidos += fila.pedidos;
    grupo.saldo += fila.saldo;
    grupo.conSaldo += fila.conSaldo;
    if (crudo) grupo.grafias.set(crudo, (grupo.grafias.get(crudo) ?? 0) + fila.pedidos);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()]
    .map(({ grafias, ...grupo }) => ({
      ...grupo,
      saldo: Math.round((grupo.saldo + Number.EPSILON) * 100) / 100,
      courier: [...grafias.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? grupo.courier,
    }))
    .sort((a, b) => b.saldo - a.saldo || a.courier.localeCompare(b.courier));
}
