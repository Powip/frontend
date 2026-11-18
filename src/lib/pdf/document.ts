import { jsPDF } from "jspdf";
import { autoTable as realAutoTable, type UserOptions } from "jspdf-autotable";

// FEAT-24 H10-D4 — PDFs del inventario y de compras, armados en el navegador con
// jsPDF + autotable y con un formato común:
// - encabezado: logo y datos de la empresa (o de la tienda), título del
//   documento, número y fecha;
// - cuerpo: datos clave (meta), una o varias tablas, totales, nota y firmas;
// - pie en cada página: usuario, fecha y hora de impresión y «Página i de n».
// El costo lo filtra la API: aquí solo se escribe lo que llega.

/** Datos de quien emite el documento (empresa y, si hay, la tienda). */
export interface PdfCompany {
  name: string;
  ruc?: string | null;
  address?: string | null;
  phone?: string | null;
  storeName?: string | null;
  /** Logo como data URL PNG o JPEG; sin él se escribe solo el nombre. */
  logoDataUrl?: string | null;
}

export interface PdfContext {
  company: PdfCompany;
  /** Quien imprime (va en el pie). */
  userName: string;
  printedAt?: Date;
}

export type PdfAlign = "left" | "right" | "center";

export interface PdfTable {
  title?: string;
  head: string[];
  rows: Array<Array<string | number | null | undefined>>;
  /** Alineación por columna (los números a la derecha). */
  align?: PdfAlign[];
}

export interface PdfDocSpec {
  title: string;
  /** Número del documento (OC-0001, DEV-0003, el periodo, la fecha del reporte…). */
  number: string;
  /** Fecha del documento; sin ella, la de impresión. */
  date?: string;
  meta?: Array<[string, string]>;
  tables: PdfTable[];
  /** Totales a la derecha, el último en negrita. */
  foot?: Array<[string, string]>;
  note?: string;
  signatures?: string[];
  landscape?: boolean;
  fileName: string;
}

/** Lo que el generador usa de jsPDF (los tests lo reemplazan). */
export interface PdfDoc {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  setFont(fontName: string, fontStyle?: string): unknown;
  setFontSize(size: number): unknown;
  setTextColor(r: number, g?: number, b?: number): unknown;
  setFillColor(r: number, g?: number, b?: number): unknown;
  setDrawColor(r: number, g?: number, b?: number): unknown;
  setLineWidth(width: number): unknown;
  rect(x: number, y: number, w: number, h: number, style?: string): unknown;
  line(x1: number, y1: number, x2: number, y2: number): unknown;
  text(text: string | string[], x: number, y: number, options?: { align?: PdfAlign; maxWidth?: number }): unknown;
  splitTextToSize(text: string, maxWidth: number): string[];
  addImage(imageData: string, format: string, x: number, y: number, w: number, h: number): unknown;
  getImageProperties?(imageData: string): { width: number; height: number };
  addPage(): unknown;
  getNumberOfPages(): number;
  setPage(page: number): unknown;
  save(fileName: string): unknown;
  lastAutoTable?: { finalY: number };
}

export interface PdfDeps {
  createDoc: (options: { orientation: "portrait" | "landscape"; unit: "mm"; format: "a4" }) => PdfDoc;
  autoTable: (doc: PdfDoc, options: UserOptions) => void;
}

const defaultDeps: PdfDeps = {
  createDoc: (options) => new jsPDF(options) as unknown as PdfDoc,
  autoTable: (doc, options) => realAutoTable(doc as unknown as jsPDF, options),
};

const BRAND: [number, number, number] = [2, 119, 120];
const MARGIN = 14;

// Las fuentes estándar de jsPDF solo tienen Latin-1 (más los signos de WinAnsi): lo demás se reemplaza.
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const REPLACEMENTS: Record<string, string> = { "−": "-", "→": "->", "←": "<-", "≤": "<=", "≥": ">=", "×": "x" };

/** Texto apto para las fuentes estándar del PDF. */
export function pdfText(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  let out = "";
  for (const char of text) {
    if (REPLACEMENTS[char] !== undefined) out += REPLACEMENTS[char];
    else if (char.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.includes(char)) out += char;
    else out += "?";
  }
  return out;
}

/** «18/11/2026 10:35» en hora de Lima. */
export function formatPrintedAt(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Texto del pie de la página `page` de `pages`. */
export function footerText(ctx: PdfContext, page: number, pages: number): string {
  const printedAt = formatPrintedAt(ctx.printedAt ?? new Date());
  return pdfText(`Generado por POWIP · Impreso el ${printedAt} por ${ctx.userName || "—"} · Página ${page} de ${pages}`);
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" | null {
  if (/^data:image\/png/i.test(dataUrl)) return "PNG";
  if (/^data:image\/jpe?g/i.test(dataUrl)) return "JPEG";
  return null;
}

/** Dibuja el logo (alto 16 mm como máximo) y devuelve el ancho que ocupó (0 si no se pudo). */
function drawLogo(doc: PdfDoc, dataUrl: string | null | undefined): number {
  if (!dataUrl) return 0;
  const format = imageFormat(dataUrl);
  if (!format) return 0;
  try {
    const props = doc.getImageProperties?.(dataUrl);
    const maxH = 16;
    const maxW = 32;
    let w = maxH;
    let h = maxH;
    if (props && props.width > 0 && props.height > 0) {
      const ratio = props.width / props.height;
      w = Math.min(maxW, maxH * ratio);
      h = w / ratio;
    }
    doc.addImage(dataUrl, format, MARGIN, 7, w, h);
    return w + 4;
  } catch {
    return 0;
  }
}

function drawHeader(doc: PdfDoc, spec: PdfDocSpec, ctx: PdfContext): number {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, width, 3, "F");

  const logoWidth = drawLogo(doc, ctx.company.logoDataUrl);
  const left = MARGIN + logoWidth;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BRAND);
  doc.text(pdfText(ctx.company.name || "Mi empresa"), left, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  const details = [ctx.company.ruc ? `RUC ${ctx.company.ruc}` : null, ctx.company.address, ctx.company.phone].filter(Boolean).join(" · ");
  if (details) doc.text(pdfText(details), left, 18, { maxWidth: width / 2 - left });
  if (ctx.company.storeName) doc.text(pdfText(`Tienda: ${ctx.company.storeName}`), left, 22.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(pdfText(spec.title), width - MARGIN, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(pdfText(spec.number), width - MARGIN, 18.5, { align: "right" });
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(pdfText(`Fecha: ${spec.date ?? formatPrintedAt(ctx.printedAt ?? new Date()).slice(0, 10)}`), width - MARGIN, 23, { align: "right" });

  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 26, width - MARGIN, 26);

  let y = 32;
  const meta = spec.meta ?? [];
  if (meta.length) {
    const columns = spec.landscape ? 4 : 3;
    const colWidth = (width - MARGIN * 2) / columns;
    meta.forEach(([label, value], index) => {
      const x = MARGIN + (index % columns) * colWidth;
      if (index % columns === 0 && index > 0) y += 10;
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text(pdfText(label.toUpperCase()), x, y);
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 20);
      doc.text(pdfText(value || "—"), x, y + 4.5, { maxWidth: colWidth - 3 });
    });
    y += 12;
  }
  return y;
}

function drawTables(doc: PdfDoc, spec: PdfDocSpec, startY: number, deps: PdfDeps): number {
  let y = startY;
  const height = doc.internal.pageSize.getHeight();
  for (const table of spec.tables) {
    if (table.title) {
      if (y > height - 30) {
        doc.addPage();
        y = MARGIN + 4;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(pdfText(table.title), MARGIN, y);
      y += 2;
    }
    const columnStyles: Record<number, { halign: PdfAlign }> = {};
    (table.align ?? []).forEach((align, index) => {
      if (align !== "left") columnStyles[index] = { halign: align };
    });
    deps.autoTable(doc, {
      startY: y,
      head: [table.head.map(pdfText)],
      body: table.rows.length ? table.rows.map((row) => row.map(pdfText)) : [[{ content: "Sin datos.", colSpan: table.head.length }]],
      theme: "grid",
      styles: { fontSize: spec.landscape ? 7.5 : 8, cellPadding: 1.6, overflow: "linebreak" },
      headStyles: { fillColor: BRAND, textColor: 255 },
      alternateRowStyles: { fillColor: [245, 250, 250] },
      columnStyles,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 16 },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 7;
  }
  return y;
}

function drawClosing(doc: PdfDoc, spec: PdfDocSpec, startY: number): void {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  let y = startY;
  if (spec.foot?.length) {
    if (y + spec.foot.length * 5 > height - 18) {
      doc.addPage();
      y = MARGIN + 4;
    }
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    spec.foot.forEach(([label, value], index) => {
      doc.setFont("helvetica", index === spec.foot!.length - 1 ? "bold" : "normal");
      doc.text(pdfText(label), width - 80, y);
      doc.text(pdfText(value), width - MARGIN, y, { align: "right" });
      y += 5;
    });
    y += 2;
  }
  if (spec.note) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    const lines = doc.splitTextToSize(pdfText(spec.note), width - MARGIN * 2);
    doc.text(lines, MARGIN, y + 2);
    y += 4 + lines.length * 4;
  }
  if (spec.signatures?.length) {
    let signY = Math.max(y + 22, height - 34);
    if (signY > height - 22) {
      doc.addPage();
      signY = 50;
    }
    const slot = (width - MARGIN * 2) / spec.signatures.length;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 20);
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.2);
    spec.signatures.forEach((label, index) => {
      const x = MARGIN + index * slot + 6;
      doc.line(x, signY, x + slot - 12, signY);
      doc.text(pdfText(label), x + (slot - 12) / 2, signY + 4.5, { align: "center" });
    });
  }
}

function drawFooters(doc: PdfDoc, ctx: PdfContext): void {
  const pages = doc.getNumberOfPages();
  const height = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(footerText(ctx, page, pages), MARGIN, height - 7);
  }
}

/** Arma el documento completo (sin descargarlo). */
export function renderPdf(spec: PdfDocSpec, ctx: PdfContext, deps: PdfDeps = defaultDeps): PdfDoc {
  const doc = deps.createDoc({ orientation: spec.landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const afterHeader = drawHeader(doc, spec, ctx);
  const afterTables = drawTables(doc, spec, afterHeader, deps);
  drawClosing(doc, spec, afterTables);
  drawFooters(doc, ctx);
  return doc;
}

/** Arma el documento y lo descarga con su nombre de archivo. */
export function downloadPdf(spec: PdfDocSpec, ctx: PdfContext, deps: PdfDeps = defaultDeps): void {
  renderPdf(spec, ctx, deps).save(safeFileName(spec.fileName));
}

/** Nombre de archivo sin caracteres raros, con extensión .pdf. */
export function safeFileName(name: string): string {
  const base = name
    .replace(/\.pdf$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "documento"}.pdf`;
}

