import type { LabelCodeType, LabelFormatShape, LabelLine } from "./types";

// FEAT-24 H7 — qué se pinta y dónde, en mm desde la esquina de la etiqueta. Función pura: la usan el PDF
// (jsPDF) y la vista previa (SVG), así lo que se ve en el editor es lo que sale impreso.

/** 1 punto tipográfico en mm. */
export const PT_MM = 25.4 / 72;

export type LabelBlock = "logo" | "top" | "name" | "mid" | "lot" | "price" | "caption";

export type LabelElement =
  | {
      kind: "text";
      block: LabelBlock;
      x: number;
      y: number;
      text: string;
      sizePt: number;
      bold: boolean;
      align: "left" | "center";
    }
  | { kind: "logo"; x: number; y: number; w: number; h: number }
  | { kind: "barcode"; x: number; y: number; w: number; h: number; code: string; codeType: LabelCodeType }
  | { kind: "qr"; x: number; y: number; size: number; text: string };

export interface LabelContext {
  /** Tienda elegida al imprimir (la línea no la trae: no vive en ms-products). */
  storeName?: string | null;
  /** Se escribe en lugar del logo cuando no hay imagen. */
  companyName?: string | null;
  hasLogo?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lineHeight = (sizePt: number) => sizePt * PT_MM * 1.2;
/** Ancho medio de un carácter de Helvetica (aproximado, del lado seguro). */
const charWidth = (sizePt: number, bold: boolean) => sizePt * PT_MM * (bold ? 0.6 : 0.55);

/** Parte el texto en líneas que entran en `maxWidthMm`; la última se corta con «…» si sobra. */
export function wrapText(text: string, maxWidthMm: number, sizePt: number, bold: boolean, maxLines: number): string[] {
  const maxChars = Math.max(2, Math.floor(maxWidthMm / charWidth(sizePt, bold)));
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    let rest = word;
    while (rest.length > maxChars) {
      lines.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    current = rest;
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = `${last.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  return kept;
}

const joinParts = (parts: Array<string | null | undefined>) =>
  parts.map((part) => part?.trim()).filter(Boolean).join(" · ") || null;

export const formatLabelPrice = (price: number) => `S/ ${price.toFixed(2)}`;

interface TextBlock {
  block: LabelBlock;
  lines: string[];
  sizePt: number;
  bold: boolean;
  /** Mayor = se saca primero si no entra. 0 = nunca. */
  dropRank: number;
}

/**
 * Elementos de una etiqueta. Solo aparece lo que el formato tiene activo y la línea trae (sin lote no hay
 * línea de lote). Si el texto no entra sobre el código de barras se sacan, en orden: lote, tienda/marca,
 * logo, la segunda línea del nombre y variante/SKU/ubicación; el precio y el código nunca.
 */
export function planLabel(
  format: Pick<LabelFormatShape, "widthMm" | "heightMm" | "fields">,
  line: LabelLine,
  context: LabelContext = {},
): LabelElement[] {
  const W = format.widthMm;
  const H = format.heightMm;
  const on = new Set(format.fields);
  const pad = Math.min(W, H) >= 40 ? 2.5 : 1.5;
  // Las letras crecen con la etiqueta, a la mitad de ritmo (en 100×50 van ×1,5, no ×2).
  const scale = 1 + (clamp(Math.min(W / 50, H / 25), 1, 2) - 1) / 2;
  const small = 5.5 * scale;
  const nameSize = 7 * scale;
  const priceSize = Math.min(18, 10 * scale);
  const captionSize = 5 * Math.min(scale, 1.4);

  const logo = on.has("logo") ? (context.hasLogo ? "image" : context.companyName?.trim() || null) : null;
  const top = joinParts([on.has("store") ? (context.storeName ?? line.store) : null, on.has("brand") ? line.brand : null]);
  const name = on.has("name") ? line.name?.trim() || null : null;
  const mid = joinParts([
    on.has("variant") ? line.variant : null,
    on.has("sku") ? line.sku : null,
    on.has("location") ? line.location : null,
  ]);
  const lot = on.has("lot") ? line.lot?.trim() || null : null;
  const price = on.has("price") && line.price != null && Number.isFinite(line.price) ? formatLabelPrice(line.price) : null;
  const barcode = on.has("barcode");
  const hasText = Boolean(logo || top || name || mid || lot || price || barcode);

  const elements: LabelElement[] = [];

  // QR a la derecha, centrado en alto; solo, ocupa la etiqueta.
  let qrSize = 0;
  if (on.has("qr")) {
    qrSize = hasText ? Math.min(H - 2 * pad, W * 0.42) : Math.min(W, H) - 2 * pad;
    const x = hasText ? W - pad - qrSize : (W - qrSize) / 2;
    elements.push({ kind: "qr", x, y: (H - qrSize) / 2, size: qrSize, text: line.qrText });
  }
  const textRight = qrSize && hasText ? W - pad - qrSize - 1 : W - pad;
  const tw = Math.max(4, textRight - pad);

  const blocks: TextBlock[] = [];
  if (logo === "image") blocks.push({ block: "logo", lines: [""], sizePt: 4 * scale / PT_MM / 1.2, bold: false, dropRank: 3 });
  else if (logo) blocks.push({ block: "logo", lines: wrapText(logo, tw, small, true, 1), sizePt: small, bold: true, dropRank: 3 });
  if (top) blocks.push({ block: "top", lines: wrapText(top, tw, small, false, 1), sizePt: small, bold: false, dropRank: 4 });
  if (name) blocks.push({ block: "name", lines: wrapText(name, tw, nameSize, true, 2), sizePt: nameSize, bold: true, dropRank: 0 });
  if (mid) blocks.push({ block: "mid", lines: wrapText(mid, tw, small, false, 1), sizePt: small, bold: false, dropRank: 1 });
  if (lot) blocks.push({ block: "lot", lines: wrapText(lot, tw, small * 0.95, false, 1), sizePt: small * 0.95, bold: false, dropRank: 5 });
  if (price) blocks.push({ block: "price", lines: wrapText(price, tw, priceSize, true, 1), sizePt: priceSize, bold: true, dropRank: 0 });

  const captionH = barcode ? lineHeight(captionSize) : 0;
  let barH = barcode ? clamp(H * 0.28, 5, 13) : 0;
  const textHeight = () => blocks.reduce((sum, b) => sum + b.lines.length * lineHeight(b.sizePt), 0);
  // 0,5 mm de aire arriba de las barras y 0,5 mm entre las barras y el número.
  const room = () => H - 2 * pad - (barcode ? barH + captionH + 1 : 0);

  const remove = (id: LabelBlock) => {
    const index = blocks.findIndex((b) => b.block === id);
    if (index < 0) return false;
    blocks.splice(index, 1);
    return true;
  };
  // Lo que no entra se saca por prioridad; el nombre baja a una línea antes de sacar variante/SKU.
  const dropOrder: Array<() => boolean> = [
    () => remove("lot"),
    () => remove("top"),
    () => remove("logo"),
    () => {
      const block = blocks.find((b) => b.block === "name");
      if (!block || block.lines.length < 2) return false;
      block.lines = wrapText(name ?? "", tw, nameSize, true, 1);
      return true;
    },
    () => remove("mid"),
  ];
  for (const drop of dropOrder) {
    if (textHeight() <= room()) break;
    drop();
  }
  if (barcode && textHeight() > room()) barH = Math.max(4, barH - (textHeight() - room()));

  let y = pad;
  for (const block of blocks) {
    if (block.block === "logo" && logo === "image") {
      const h = lineHeight(block.sizePt);
      elements.push({ kind: "logo", x: pad, y, w: Math.min(tw, 18 * scale), h });
      y += h;
      continue;
    }
    for (const text of block.lines) {
      elements.push({ kind: "text", block: block.block, x: pad, y, text, sizePt: block.sizePt, bold: block.bold, align: "left" });
      y += lineHeight(block.sizePt);
    }
  }

  if (barcode) {
    const barY = H - pad - captionH - 0.5 - barH;
    elements.push({ kind: "barcode", x: pad, y: barY, w: tw, h: barH, code: line.code, codeType: line.codeType });
    elements.push({
      kind: "text",
      block: "caption",
      x: pad + tw / 2,
      y: H - pad - captionH,
      text: line.code,
      sizePt: captionSize,
      bold: false,
      align: "center",
    });
  }
  return elements;
}

/** Zona de silencio (en módulos) a cada lado de las barras para que el lector las lea. */
export const QUIET_MODULES: Record<LabelCodeType, number> = { EAN13: 9, CODE128: 10 };

export interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectángulos negros de las barras dentro de la caja del código, con la zona de silencio incluida. */
export function barcodeRects(
  box: { x: number; y: number; w: number; h: number; codeType: LabelCodeType },
  runs: Array<[number, number]>,
  moduleCount: number,
): LabelRect[] {
  const quiet = QUIET_MODULES[box.codeType];
  const unit = box.w / (moduleCount + 2 * quiet);
  return runs.map(([start, length]) => ({ x: box.x + (quiet + start) * unit, y: box.y, w: length * unit, h: box.h }));
}

/** Rectángulos negros del QR dentro de su cuadrado. */
export function qrRects(box: { x: number; y: number; size: number }, size: number, runs: Array<[number, number, number]>): LabelRect[] {
  const unit = box.size / size;
  return runs.map(([row, start, length]) => ({ x: box.x + start * unit, y: box.y + row * unit, w: length * unit, h: unit }));
}
