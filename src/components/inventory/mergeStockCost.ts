import type { VariantStock } from "@/services/inventoryItems.service";
import type { MergeStockMode } from "@/services/reconciliationTask.service";

// FEAT-17 Anexo E — reglas del paso 3 del modal de Unificar (stock y costo),
// sin React para poder testearlas solas. FEAT-24 C-D2: la cantidad final puede
// quedar por debajo de lo reservado (contar o unificar refleja la realidad).
// ms-logistics ya no sube el físico hasta lo reservado: deja lo elegido y pasa
// las reservas a la variante que queda. Aquí solo se avisa, nunca se bloquea.

export type MergeCostChoice = "winner" | "loser" | "custom";

export interface MergeStockSides {
  winnerQuantity: number;
  winnerReserved: number;
  loserQuantity: number;
  loserReserved: number;
  // FEAT-24 H1-A: almacenes candidatos del par (los que tienen stock o, si
  // ninguno tiene, los de las filas 0/0 de la madre). Ver `buildMergeWarehouses`.
  warehouseCount: number;
}

// Una fila por almacén candidato, con lo que tiene cada lado (0 si ese lado no
// tiene fila o la tiene en 0/0). Sirve para mostrar el desglose y para el tope
// de 10.000 por fila.
export interface MergeWarehouseRow {
  inventoryId: string;
  inventoryName: string;
  winnerQuantity: number;
  winnerReserved: number;
  loserQuantity: number;
  loserReserved: number;
}

export interface MergeStockValidation {
  finalQuantity: number | null;
  error: string | null;
  // FEAT-24 C-D2: aviso que no bloquea (reservado mayor que la cantidad final).
  warning: string | null;
}

export interface MergeCostResolution {
  value: number | null;
  error: string | null;
}

// FEAT-24 H0: máximo de 10.000 por variante y almacén (igual que ms-products y ms-logistics).
export const MAX_COUNTED_QUANTITY = 10_000;
export const MAX_PRICE_BASE = 99_999_999.99;

// FEAT-24 H0: el formateador vive en lib/money.ts y se reexporta para no cambiar los imports.
export { formatMoney } from "@/lib/money";

// Mismo mensaje en la pantalla y en la validación (ms-products responde 400 si
// llega un `count` con el stock repartido en varios almacenes).
export const COUNT_MULTI_WAREHOUSE_MESSAGE =
  "El stock está en varios almacenes: se aplica en cada uno. Para contar, ajusta el stock de cada almacén después.";

export function totalReserved(sides: MergeStockSides): number {
  return sides.winnerReserved + sides.loserReserved;
}

// FEAT-24 C-D2: mismo texto en la bandeja y en la unión manual.
export function reservedWithoutStockWarning(withoutStock: number): string {
  return withoutStock === 1
    ? "Queda 1 unidad reservada sin stock: las reservas pasan a la variante que queda."
    : `Quedan ${withoutStock} unidades reservadas sin stock: las reservas pasan a la variante que queda.`;
}

// FEAT-24 H1-A: misma definición que ms-products y ms-logistics. Cuenta los
// `inventory_id` distintos de las filas de ambas variantes con cantidad o
// reservas distintas de 0; una fila en 0/0 no cuenta. Si ninguna fila tiene
// stock, los candidatos son los almacenes de las filas de la madre (o, si la
// madre no tiene filas, los de la otra variante), igual que ms-logistics al
// elegir dónde aplicar un conteo. `warehouseCount` de `MergeStockSides` es la
// longitud de este resultado.
export function buildMergeWarehouses(
  winner: VariantStock | undefined,
  loser: VariantStock | undefined,
): MergeWarehouseRow[] {
  const collect = (
    sources: Array<[VariantStock | undefined, "winner" | "loser"]>,
    includeEmpty: boolean,
  ): MergeWarehouseRow[] => {
    const byInventory = new Map<string, MergeWarehouseRow>();
    for (const [stock, side] of sources) {
      for (const row of stock?.inventories ?? []) {
        if (!includeEmpty && row.quantity === 0 && row.reserved_quantity === 0) continue;
        const entry = byInventory.get(row.inventory_id) ?? {
          inventoryId: row.inventory_id,
          inventoryName: row.inventory_name,
          winnerQuantity: 0,
          winnerReserved: 0,
          loserQuantity: 0,
          loserReserved: 0,
        };
        if (side === "winner") {
          entry.winnerQuantity += row.quantity;
          entry.winnerReserved += row.reserved_quantity;
        } else {
          entry.loserQuantity += row.quantity;
          entry.loserReserved += row.reserved_quantity;
        }
        byInventory.set(row.inventory_id, entry);
      }
    }
    return Array.from(byInventory.values());
  };

  const withStock = collect([[winner, "winner"], [loser, "loser"]], false);
  if (withStock.length > 0) return withStock;
  // Sin stock en ningún lado: las filas 0/0 de la madre, o las de la otra
  // variante si la madre no tiene ninguna.
  return (winner?.inventories.length ?? 0) > 0
    ? collect([[winner, "winner"]], true)
    : collect([[loser, "loser"]], true);
}

// "Conteo físico" solo se ofrece si todo el stock está en como máximo un almacén.
export function countAllowed(sides: MergeStockSides): boolean {
  return sides.warehouseCount <= 1;
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
  rows: MergeWarehouseRow[] = [],
): MergeStockValidation {
  if (!mode) return { finalQuantity: null, error: null, warning: null };

  if (mode === "count" && !countAllowed(sides)) {
    return { finalQuantity: null, error: COUNT_MULTI_WAREHOUSE_MESSAGE, warning: null };
  }

  let finalQuantity: number;
  if (mode === "count") {
    const counted = parseCountedQuantity(countedRaw);
    if (counted === null) {
      return {
        finalQuantity: null,
        error:
          countedRaw.trim() === ""
            ? null
            : "Ingresa un número entero entre 0 y 10,000",
        warning: null,
      };
    }
    finalQuantity = counted;
  } else if (mode === "winner") {
    finalQuantity = sides.winnerQuantity;
  } else {
    finalQuantity = sides.winnerQuantity + sides.loserQuantity;
  }

  // El tope es por variante y almacén: con varios almacenes y sus filas se
  // compara la mayor fila resultante, no el agregado. Sin filas (o con un solo
  // almacén) se usa `finalQuantity` (falla cerrado). El piso de reservas de
  // abajo se queda agregado (y solo avisa).
  const perWarehouse = sides.warehouseCount > 1 && rows.length > 0 && mode !== "count";
  const capQuantity = perWarehouse
    ? Math.max(
        ...rows.map((row) =>
          mode === "winner" ? row.winnerQuantity : row.winnerQuantity + row.loserQuantity,
        ),
      )
    : finalQuantity;
  if (capQuantity > MAX_COUNTED_QUANTITY) {
    return {
      finalQuantity,
      error: "El resultado supera el máximo de 10,000 unidades por variante y almacén.",
      warning: null,
    };
  }

  const reserved = totalReserved(sides);
  return {
    finalQuantity,
    error: null,
    warning: finalQuantity < reserved ? reservedWithoutStockWarning(reserved - finalQuantity) : null,
  };
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
          : "Ingresa un costo válido (número ≥ 0, hasta 2 decimales)",
    };
  }
  return { value, error: null };
}
