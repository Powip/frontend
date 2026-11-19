// FEAT-24 H7-D6 — dónde cae cada etiqueta: térmica, una por página del tamaño de la etiqueta; A4, en grilla
// calculada según el tamaño, con márgenes de 5 mm y la grilla centrada en la hoja.

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const A4_MARGIN_MM = 5;

export interface LabelGrid {
  cols: number;
  rows: number;
  perPage: number;
  /** Esquina superior izquierda de la primera etiqueta. */
  offsetX: number;
  offsetY: number;
  widthMm: number;
  heightMm: number;
}

export interface LabelSlot {
  /** Página (desde 0). */
  page: number;
  x: number;
  y: number;
}

const EPSILON = 1e-9;

/** Cuántas etiquetas entran en una hoja A4 sin pasar los márgenes, pegadas entre sí (se cortan por las guías). */
export function computeA4Grid(widthMm: number, heightMm: number, marginMm = A4_MARGIN_MM): LabelGrid {
  if (!(widthMm > 0) || !(heightMm > 0)) throw new Error("El tamaño de la etiqueta tiene que ser positivo.");
  const usableW = A4_WIDTH_MM - 2 * marginMm;
  const usableH = A4_HEIGHT_MM - 2 * marginMm;
  const cols = Math.max(1, Math.floor(usableW / widthMm + EPSILON));
  const rows = Math.max(1, Math.floor(usableH / heightMm + EPSILON));
  return {
    cols,
    rows,
    perPage: cols * rows,
    offsetX: marginMm + Math.max(0, usableW - cols * widthMm) / 2,
    offsetY: marginMm + Math.max(0, usableH - rows * heightMm) / 2,
    widthMm,
    heightMm,
  };
}

/** Posición de la etiqueta número `index` (desde 0) en la grilla A4: por filas, de izquierda a derecha. */
export function a4Slot(index: number, grid: LabelGrid): LabelSlot {
  const page = Math.floor(index / grid.perPage);
  const k = index % grid.perPage;
  return {
    page,
    x: grid.offsetX + (k % grid.cols) * grid.widthMm,
    y: grid.offsetY + Math.floor(k / grid.cols) * grid.heightMm,
  };
}

/** Térmica: cada etiqueta es su propia página. */
export function thermalSlot(index: number): LabelSlot {
  return { page: index, x: 0, y: 0 };
}

export function pagesFor(total: number, output: "termica" | "a4", grid: LabelGrid): number {
  if (total <= 0) return 0;
  return output === "termica" ? total : Math.ceil(total / grid.perPage);
}
