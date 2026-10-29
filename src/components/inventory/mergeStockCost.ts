import type { MergeStockMode } from "@/services/reconciliationTask.service";

// FEAT-17 Anexo E — reglas del paso 3 del modal de Unificar (stock y costo),
// sin React para poder testearlas solas. ms-logistics vuelve a validar el
// piso de reservas al aplicar (puede entrar una reserva en el medio).

export type MergeCostChoice = "winner" | "loser" | "custom";

export interface MergeStockSides {
  winnerQuantity: number;
  winnerReserved: number;
  loserQuantity: number;
  loserReserved: number;
}

export interface MergeStockValidation {
  finalQuantity: number | null;
  error: string | null;
}

export interface MergeCostResolution {
  value: number | null;
  error: string | null;
}

export const MAX_COUNTED_QUANTITY = 1_000_000;
export const MAX_PRICE_BASE = 99_999_999.99;

export function formatMoney(value: number | null | undefined): string {
  const numeric = Number(value);
  if (value === null || value === undefined || Number.isNaN(numeric)) {
    return "S/ 0.00";
  }
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(numeric);
}

export function totalReserved(sides: MergeStockSides): number {
  return sides.winnerReserved + sides.loserReserved;
}

export function parseCountedQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_COUNTED_QUANTITY ? value : null;
}

export function parsePriceBase(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return value <= MAX_PRICE_BASE ? value : null;
}

export function validateMergeStock(
  mode: MergeStockMode | null,
  sides: MergeStockSides,
  countedRaw: string,
): MergeStockValidation {
  if (!mode) return { finalQuantity: null, error: null };

  let finalQuantity: number;
  if (mode === "count") {
    const counted = parseCountedQuantity(countedRaw);
    if (counted === null) {
      return {
        finalQuantity: null,
        error:
          countedRaw.trim() === ""
            ? null
            : "Ingresá un número entero entre 0 y 1.000.000",
      };
    }
    finalQuantity = counted;
  } else if (mode === "winner") {
    finalQuantity = sides.winnerQuantity;
  } else {
    finalQuantity = sides.winnerQuantity + sides.loserQuantity;
  }

  const reserved = totalReserved(sides);
  if (finalQuantity < reserved) {
    return {
      finalQuantity,
      error: `Hay ${reserved} unidades reservadas en pedidos; la cantidad no puede ser menor`,
    };
  }
  return { finalQuantity, error: null };
}

export function resolveMergeCost(
  choice: MergeCostChoice,
  winnerCost: number,
  loserCost: number,
  customRaw: string,
): MergeCostResolution {
  if (choice === "winner") return { value: winnerCost, error: null };
  if (choice === "loser") return { value: loserCost, error: null };
  const value = parsePriceBase(customRaw);
  if (value === null) {
    return {
      value: null,
      error:
        customRaw.trim() === ""
          ? null
          : "Ingresá un costo válido (número ≥ 0, hasta 2 decimales)",
    };
  }
  return { value, error: null };
}
