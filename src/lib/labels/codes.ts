import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import type { LabelCodeType } from "./types";

// FEAT-24 H7 — códigos de la etiqueta como módulos (vector), sin canvas: el PDF los pinta con rectángulos
// (nítidos en la térmica) y la vista previa con SVG. Lo mismo en el navegador y en los tests.

/** Barras del código como texto de 0 y 1 (un carácter por módulo), o `null` si no se puede codificar. */
export function barcodeModules(code: string, codeType: LabelCodeType): string | null {
  try {
    const target: { encodings?: Array<{ data: string }> } = {};
    JsBarcode(target, code, { format: codeType, flat: true, displayValue: false });
    const data = (target.encodings ?? []).map((encoding) => encoding.data).join("");
    return /^[01]+$/.test(data) ? data : null;
  } catch {
    return null;
  }
}

/** Tramos de barras negras: `[inicio, largo]` en módulos. */
export function barRuns(modules: string): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i <= modules.length; i++) {
    const dark = modules[i] === "1";
    if (dark && start < 0) start = i;
    if (!dark && start >= 0) {
      runs.push([start, i - start]);
      start = -1;
    }
  }
  return runs;
}

export interface QrMatrix {
  size: number;
  /** Tramos oscuros por fila: `[fila, inicio, largo]`. */
  runs: Array<[number, number, number]>;
}

/** Matriz del QR (corrección M) como tramos oscuros por fila, o `null` si el texto no entra. */
export function qrMatrix(text: string): QrMatrix | null {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const runs: Array<[number, number, number]> = [];
    for (let row = 0; row < size; row++) {
      let start = -1;
      for (let col = 0; col <= size; col++) {
        const dark = col < size && Boolean(qr.modules.get(row, col));
        if (dark && start < 0) start = col;
        if (!dark && start >= 0) {
          runs.push([row, start, col - start]);
          start = -1;
        }
      }
    }
    return { size, runs };
  } catch {
    return null;
  }
}

const barcodeCache = new Map<string, string | null>();
const qrCache = new Map<string, QrMatrix | null>();

/** Con caché: en un PDF el mismo código se repite tantas veces como etiquetas de la variante. */
export function cachedBarcodeModules(code: string, codeType: LabelCodeType): string | null {
  const key = `${codeType}:${code}`;
  if (!barcodeCache.has(key)) barcodeCache.set(key, barcodeModules(code, codeType));
  return barcodeCache.get(key) ?? null;
}

export function cachedQrMatrix(text: string): QrMatrix | null {
  if (!qrCache.has(text)) qrCache.set(text, qrMatrix(text));
  return qrCache.get(text) ?? null;
}
