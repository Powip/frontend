/**
 * FEAT-31 — N° externo del pedido: el número con el que el cliente lo identifica fuera de
 * Powip (el `name` de Shopify, p. ej. «AGPE923190», o un número propio cargado por Excel/API).
 * Se muestra en una columna pegada a «N° Orden» solo si alguna fila de la tabla lo trae.
 */
export const EXTERNAL_ORDER_NUMBER_LABEL = "N° Externo";

/** `true` si alguna fila tiene un N° externo con texto (los espacios no cuentan). */
export function hasExternalOrderNumbers(
  rows: ReadonlyArray<{ externalOrderNumber?: string | null }>,
): boolean {
  return rows.some((row) => (row.externalOrderNumber ?? "").trim() !== "");
}
