"use client";

/**
 * Overrides manuales de precio de costo por producto — persistido en
 * localStorage por empresa (solución puente, ver `useLocalStorage.ts`).
 * Margen x Producto trae el costo automático desde `ms-products`
 * (`priceBase` de cada variante); cuando ese fetch falla o el dato no
 * existe, o cuando el usuario simplemente quiere corregirlo a mano, este
 * override reemplaza el costo calculado sin tocar el catálogo real.
 *
 * Se guarda por nombre de producto (la clave de agrupación "por modelo" que
 * usa la página) — no por variante, porque la edición ocurre a ese nivel.
 */

import { useLocalStorageState } from "./useLocalStorage";

export type CostoOverrides = Record<string, number>;

const storageKey = (companyId: string) =>
  `powip:admin:margen-costo-override:${companyId || "anon"}`;

export function useCostoOverrides(companyId: string) {
  return useLocalStorageState<CostoOverrides>(storageKey(companyId), {});
}
