"use client";

/**
 * Publicidad de Administración: una sola fuente (D2, 25-11-2026).
 *
 * - Consumo conectado: el «consumo efectivo» del módulo de publicidad (importado de Meta/TikTok + respaldo +
 *   adicional), en soles.
 * - Más lo cargado en Gastos › Publicidad, para lo que no está conectado (lo suma `prorratearGastos`).
 *
 * La «inversión manual» guardada en el navegador ya no entra a ningún cálculo.
 */

import { useAuth } from "@/contexts/AuthContext";
import { useAdvertisingSnapshot } from "@/hooks/useAdvertisingSnapshot";
import { advertisingErrorStatus } from "@/services/advertisingService";
import type { EffectiveAdvertisingSpendWire } from "@/types/advertisingEffective";
import { type DiaKey, hoyLima, minDia } from "./periodo";

const MONEDA = "PEN";

export type EstadoPublicidad = "cargando" | "ok" | "sin_cuentas" | "sin_permiso" | "sin_servicio" | "error";

export interface PublicidadConectada {
  estado: EstadoPublicidad;
  /** Consumo en soles del periodo; null si no hay dato. */
  monto: number | null;
  /** Consumo por día (soles). */
  porDia: Map<DiaKey, number>;
  cobertura: "complete" | "partial" | "pending" | null;
  /** Días-cuenta sin importar todavía. */
  diasFaltantes: number;
  /** Incluye el día de hoy, que Meta todavía puede corregir. */
  provisional: boolean;
  /** Gasto en otras monedas (no se convierte). */
  otrasMonedas: string[];
}

export function leerConsumo(effective: EffectiveAdvertisingSpendWire | null | undefined): Omit<PublicidadConectada, "estado"> {
  const porDia = new Map<DiaKey, number>();
  if (!effective) {
    return { monto: null, porDia, cobertura: null, diasFaltantes: 0, provisional: false, otrasMonedas: [] };
  }
  for (const fila of effective.rows) {
    if (fila.currency !== MONEDA) continue;
    porDia.set(fila.date, (porDia.get(fila.date) ?? 0) + Number(fila.amount || 0));
  }
  const total = effective.totals.find((t) => t.currency === MONEDA);
  const otrasMonedas = effective.totals
    .filter((t) => t.currency !== MONEDA && Number(t.amount ?? t.importedAmount ?? 0) > 0)
    .map((t) => t.currency);
  if (!total) {
    return { monto: null, porDia, cobertura: null, diasFaltantes: 0, provisional: false, otrasMonedas };
  }
  const monto =
    total.amount !== null
      ? Number(total.amount)
      : [...porDia.values()].reduce((s, v) => s + v, 0);
  return {
    monto,
    porDia,
    cobertura: total.coverage,
    diasFaltantes: total.missingAccountDays,
    provisional: total.provisional,
    otrasMonedas,
  };
}

/** Suma por mes (`YYYY-MM`) del consumo diario. */
export function consumoPorMes(porDia: Map<DiaKey, number>): Map<string, number> {
  const meses = new Map<string, number>();
  for (const [dia, monto] of porDia) {
    const mes = dia.slice(0, 7);
    meses.set(mes, (meses.get(mes) ?? 0) + monto);
  }
  return meses;
}

/** Consumo publicitario conectado del periodo (los días futuros no se piden). */
export function usePublicidadConectada(desde: DiaKey, hasta: DiaKey): PublicidadConectada {
  const { auth } = useAuth();
  const hasta2 = minDia(hasta, hoyLima());
  const rangoValido = hasta2 >= desde;
  const query = useAdvertisingSnapshot({
    token: auth?.accessToken,
    actorId: auth?.user?.id,
    companyId: rangoValido ? auth?.company?.id : null,
    from: desde,
    to: hasta2,
  });
  const vacio = leerConsumo(null);
  if (!rangoValido) return { ...vacio, estado: "sin_cuentas", monto: 0 };
  if (!auth?.accessToken || !auth.user?.id || !auth.company?.id) return { ...vacio, estado: "cargando" };
  if (query.isLoading) return { ...vacio, estado: "cargando" };
  if (query.isError) {
    const status = advertisingErrorStatus(query.error);
    return { ...vacio, estado: status === 403 ? "sin_permiso" : status === 404 ? "sin_servicio" : "error" };
  }
  const data = query.data;
  if (!data) return { ...vacio, estado: "error" };
  if (!data.effective) return { ...vacio, estado: "sin_servicio" };
  const consumo = leerConsumo(data.effective);
  const sinCuentas = (data.accounts ?? []).length === 0 && consumo.porDia.size === 0;
  if (sinCuentas) return { ...consumo, estado: "sin_cuentas", monto: 0 };
  return { ...consumo, estado: "ok", monto: consumo.monto ?? 0 };
}
