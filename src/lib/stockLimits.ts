// FEAT-24 H0 — mismos valores que ms-logistics (stock-limits.ts). El backend
// es el que valida; acá solo se avisa antes de enviar.
export const MAX_ITEM_UNITS = 10_000;
export const CONFIRM_UNITS_THRESHOLD = 1_000;
export const MAX_ITEM_UNITS_MESSAGE = "La cantidad máxima por variante y almacén es 10,000 unidades.";

export function needsQuantityConfirmation(quantity: number): boolean {
  return quantity > CONFIRM_UNITS_THRESHOLD;
}

export function largeQuantityConfirmText(quantity: number): string {
  return `Estás cargando ${new Intl.NumberFormat("es-PE").format(quantity)} unidades. ¿Confirmas la cantidad?`;
}
