// FEAT-24 C-D3 — salidas manuales que dejan el físico en negativo según el control de stock de la empresa
// (Configuración › Tiendas y almacenes › Reglas de inventario).
// - `flexible`: se puede, con confirmación explícita (`allowNegative: true`); sin ella el servidor responde
//   409 `{ code: 'STOCK_NEGATIVO_CONFIRMAR', message }`.
// - `estricto`: no se puede (409/400 de siempre).
// `allowNegative` se manda solo cuando es `true` (la fachada da 400 con `null` o un texto).

export const NEGATIVE_STOCK_CONFIRM_CODE = "STOCK_NEGATIVO_CONFIRMAR";

export const STRICT_NEGATIVE_MESSAGE =
  "Tu empresa usa control de stock estricto: la salida no puede dejar el físico en negativo.";

/** El 409 de flexible sin confirmación: se muestra su mensaje y la casilla para confirmar. */
export function isNegativeStockConfirmError(error: unknown): boolean {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code;
  return code === NEGATIVE_STOCK_CONFIRM_CODE;
}

/** Mensaje del 409 de confirmación (o uno genérico si no trae). */
export function negativeStockConfirmMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  if (typeof message === "string" && message.trim() !== "") return message.trim();
  if (Array.isArray(message)) {
    const text = message.filter((part): part is string => typeof part === "string" && part.trim() !== "").join(". ");
    if (text) return text;
  }
  return "La salida deja el físico en negativo: confirma para seguir.";
}

/** «−5» con el signo menos tipográfico; 0 y positivos tal cual. */
export const formatSignedStock = (value: number): string => (value < 0 ? `−${Math.abs(value)}` : String(value));

/** Casilla de una sola salida: «Confirmo que el físico quedará en −N». */
export function negativeConfirmLabel(next: number | null): string {
  return next !== null && next < 0
    ? `Confirmo que el físico quedará en ${formatSignedStock(next)}`
    : "Confirmo que el físico quedará en negativo";
}

/**
 * Salidas que dejan el físico en negativo: variante → cómo queda. `physical` es el físico de hoy por variante en el
 * almacén de la salida; una variante sin dato no cuenta (no se sabe: decide el servidor).
 */
export function negativeAfterExit(
  lines: ReadonlyArray<{ variantId: string; quantity: number }>,
  physical: ReadonlyMap<string, number>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of lines) out.set(line.variantId, (out.get(line.variantId) ?? 0) + line.quantity);
  const negative = new Map<string, number>();
  for (const [variantId, quantity] of out) {
    const today = physical.get(variantId);
    if (today !== undefined && quantity > 0 && today - quantity < 0) negative.set(variantId, today - quantity);
  }
  return negative;
}
