import { jsPDF } from "jspdf";
import { barRuns, cachedBarcodeModules, cachedQrMatrix } from "./codes";
import { a4Slot, computeA4Grid, thermalSlot } from "./grid";
import { barcodeRects, planLabel, qrRects, type LabelElement, type LabelRect } from "./layout";
import { labelCount, MAX_LABELS_PER_PRINT, type LabelFormatShape, type LabelLine } from "./types";

// FEAT-24 H7-D1/D6 — el PDF de etiquetas se arma en el navegador con jsPDF. Térmica: una etiqueta por página
// del tamaño del formato. A4: grilla con márgenes de 5 mm y guías de corte. Códigos y QR van en vector.

export type PdfPageFormat = "a4" | [number, number];
export type PdfOrientation = "portrait" | "landscape";

/** Lo que el generador usa de jsPDF (los tests lo reemplazan). */
export interface LabelsPdfDoc {
  addPage(format?: PdfPageFormat, orientation?: PdfOrientation): unknown;
  setFont(fontName: string, fontStyle?: string): unknown;
  setFontSize(size: number): unknown;
  setTextColor(r: number, g?: number, b?: number): unknown;
  setFillColor(r: number, g?: number, b?: number): unknown;
  setDrawColor(r: number, g?: number, b?: number): unknown;
  setLineWidth(width: number): unknown;
  text(text: string, x: number, y: number, options?: { baseline?: "top"; align?: "left" | "center" }): unknown;
  rect(x: number, y: number, w: number, h: number, style?: string): unknown;
  addImage(imageData: string, format: string, x: number, y: number, w: number, h: number): unknown;
  save(filename: string): unknown;
}

export type LabelsPdfFactory = (options: {
  unit: "mm";
  format: PdfPageFormat;
  orientation: PdfOrientation;
}) => LabelsPdfDoc;

const defaultFactory: LabelsPdfFactory = (options) => new jsPDF(options) as unknown as LabelsPdfDoc;

export interface LabelsPdfInput {
  format: LabelFormatShape;
  lines: LabelLine[];
  storeName?: string | null;
  companyName?: string | null;
  /** Logo como data URL (PNG o JPEG); sin él se escribe el nombre de la empresa. */
  logoDataUrl?: string | null;
}

export { labelCount };

export function totalLabels(lines: Array<Pick<LabelLine, "quantity">>): number {
  return lines.reduce((sum, line) => sum + labelCount(line.quantity), 0);
}

export function labelsPdfFileName(formatName: string): string {
  const slug = formatName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `etiquetas-${slug || "formato"}.pdf`;
}

type Drawable =
  | Extract<LabelElement, { kind: "text" | "logo" }>
  | { kind: "rects"; rects: LabelRect[] };

/** Convierte los elementos a lo que se dibuja (barras y QR ya en rectángulos), una vez por variante. */
function toDrawables(elements: LabelElement[]): Drawable[] {
  const drawables: Drawable[] = [];
  for (const element of elements) {
    if (element.kind === "barcode") {
      const modules = cachedBarcodeModules(element.code, element.codeType);
      // Sin barras (código que no se puede codificar) queda el número escrito debajo.
      if (modules) drawables.push({ kind: "rects", rects: barcodeRects(element, barRuns(modules), modules.length) });
    } else if (element.kind === "qr") {
      const matrix = cachedQrMatrix(element.text);
      if (matrix) drawables.push({ kind: "rects", rects: qrRects(element, matrix.size, matrix.runs) });
    } else {
      drawables.push(element);
    }
  }
  return drawables;
}

const imageFormat = (dataUrl: string) => (/^data:image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG");

function drawLabel(doc: LabelsPdfDoc, drawables: Drawable[], x0: number, y0: number, logoDataUrl?: string | null) {
  for (const item of drawables) {
    if (item.kind === "text") {
      doc.setFont("helvetica", item.bold ? "bold" : "normal");
      doc.setFontSize(item.sizePt);
      doc.setTextColor(17, 17, 17);
      doc.text(item.text, x0 + item.x, y0 + item.y, { baseline: "top", align: item.align });
    } else if (item.kind === "logo") {
      if (!logoDataUrl) continue;
      try {
        doc.addImage(logoDataUrl, imageFormat(logoDataUrl), x0 + item.x, y0 + item.y, item.w, item.h);
      } catch {
        // Un logo que jsPDF no puede leer no frena la impresión.
      }
    } else {
      doc.setFillColor(0, 0, 0);
      for (const r of item.rects) doc.rect(x0 + r.x, y0 + r.y, r.w, r.h, "F");
    }
  }
}

/** Arma el PDF con `quantity` copias de cada línea, en el orden de las líneas. */
export function buildLabelsPdf(input: LabelsPdfInput, factory: LabelsPdfFactory = defaultFactory): LabelsPdfDoc {
  const total = totalLabels(input.lines);
  if (total === 0) throw new Error("No hay etiquetas para imprimir.");
  if (total > MAX_LABELS_PER_PRINT) {
    throw new Error(`Son ${total} etiquetas y el máximo por impresión es ${MAX_LABELS_PER_PRINT}.`);
  }
  const { widthMm: W, heightMm: H, output } = input.format;
  const thermal = output === "termica";
  const orientation: PdfOrientation = thermal && W > H ? "landscape" : "portrait";
  const pageFormat: PdfPageFormat = thermal ? [W, H] : "a4";
  const doc = factory({ unit: "mm", format: pageFormat, orientation });
  const grid = computeA4Grid(W, H);
  const context = {
    storeName: input.storeName ?? null,
    companyName: input.companyName ?? null,
    hasLogo: Boolean(input.logoDataUrl),
  };

  let index = 0;
  let page = 0;
  for (const line of input.lines) {
    const copies = labelCount(line.quantity);
    if (!copies) continue;
    const drawables = toDrawables(planLabel(input.format, line, context));
    for (let copy = 0; copy < copies; copy++, index++) {
      const slot = thermal ? thermalSlot(index) : a4Slot(index, grid);
      if (slot.page > page) {
        doc.addPage(pageFormat, orientation);
        page = slot.page;
      }
      if (!thermal) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.rect(slot.x, slot.y, W, H, "S");
      }
      drawLabel(doc, drawables, slot.x, slot.y, input.logoDataUrl);
    }
  }
  return doc;
}

/** Arma el PDF y lo descarga. Devuelve cuántas etiquetas salieron. */
export function downloadLabelsPdf(input: LabelsPdfInput, factory?: LabelsPdfFactory): number {
  const doc = buildLabelsPdf(input, factory);
  doc.save(labelsPdfFileName(input.format.name));
  return totalLabels(input.lines);
}
