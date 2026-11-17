import type { VariantCodeMatch } from "@/services/variantCodesService";

// FEAT-24 H3-E (H3-D17) — carga del costo promedio por Excel: columnas «SKU de
// la empresa» y «Costo». Se lee el archivo, se resuelve cada SKU contra el
// catálogo (el mismo `lookup-by-codes` del escaneo: SKU, SKU de la empresa,
// código de fábrica o EAN de POWIP) y se muestra una vista previa; nada se
// guarda hasta confirmar. Funciones puras salvo `readCostWorkbook`.

/** Tope por archivo: lo que acepta `PUT /variant-costs` en un envío. */
export const MAX_COST_ROWS = 1000;
/** Tope del costo (numeric(14,4) en ms-logistics). */
const MAX_COST = 9_999_999_999;

export interface CostSheetRow {
  /** Número de fila en el Excel (la 1 es el encabezado). */
  row: number;
  code: string;
  rawCost: unknown;
}

export interface CostSheet {
  rows: CostSheetRow[];
  /** Por qué no se pudo leer (faltan columnas, hoja vacía…). */
  error: string | null;
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const SKU_HEADERS = ["sku de la empresa", "sku empresa", "sku", "codigo", "sku de variante"];
const COST_HEADERS = ["costo", "costo promedio", "costo unitario", "costo sin igv", "costo promedio sin igv"];

/** Texto de una celda de ExcelJS (número, texto, texto enriquecido, fórmula, hipervínculo). */
export function cellValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value;
  const candidate = value as { result?: unknown; richText?: Array<{ text?: unknown }>; text?: unknown };
  if ("result" in candidate) return cellValue(candidate.result);
  if (Array.isArray(candidate.richText)) return candidate.richText.map((part) => String(part.text ?? "")).join("");
  if (typeof candidate.text === "string") return candidate.text;
  return null;
}

/**
 * Filas de la hoja, ya separadas en código y costo. `header` es la fila 1; `rows` el resto (fila de Excel,
 * celdas). Busca las columnas por nombre, sin tildes ni mayúsculas.
 */
export function rowsFromSheet(header: unknown[], rows: Array<{ row: number; cells: unknown[] }>): CostSheet {
  const names = header.map((cell) => fold(String(cellValue(cell) ?? "")));
  const skuIndex = names.findIndex((name) => SKU_HEADERS.includes(name));
  const costIndex = names.findIndex((name) => COST_HEADERS.includes(name));
  if (skuIndex < 0 || costIndex < 0) {
    return { rows: [], error: "El archivo necesita las columnas «SKU de la empresa» y «Costo» en la primera fila." };
  }
  const result: CostSheetRow[] = [];
  for (const { row, cells } of rows) {
    const code = String(cellValue(cells[skuIndex]) ?? "").trim();
    const rawCost = cellValue(cells[costIndex]);
    if (!code && (rawCost === null || String(rawCost).trim() === "")) continue;
    result.push({ row, code, rawCost });
  }
  if (result.length === 0) return { rows: [], error: "El archivo no tiene filas con datos." };
  if (result.length > MAX_COST_ROWS)
    return { rows: [], error: `El archivo tiene ${result.length} filas: carga hasta ${MAX_COST_ROWS} por vez.` };
  return { rows: result, error: null };
}

/** Lee la primera hoja de un .xlsx con ExcelJS (se carga recién al usarlo). */
export async function readCostWorkbook(buffer: ArrayBuffer): Promise<CostSheet> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], error: "El archivo no tiene hojas." };
  const values = (row: { values: unknown }) => (Array.isArray(row.values) ? (row.values as unknown[]).slice(1) : []);
  const header = values(sheet.getRow(1));
  const rows: Array<{ row: number; cells: unknown[] }> = [];
  for (let index = 2; index <= sheet.rowCount; index++) rows.push({ row: index, cells: values(sheet.getRow(index)) });
  return rowsFromSheet(header, rows);
}

/** Plantilla para bajar: las dos columnas y una fila de ejemplo. */
export async function buildCostTemplate(): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Costos");
  sheet.columns = [
    { header: "SKU de la empresa", key: "sku", width: 28 },
    { header: "Costo", key: "cost", width: 14 },
  ];
  sheet.addRow({ sku: "POLO-NEGRO-M", cost: 18.5 });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/**
 * Costo de una celda: número ≥ 0 (acepta «12,50», «S/ 12.50» y «1,234.50»), redondeado a 4 decimales. `null`
 * si no es un costo válido.
 */
export function parseCostValue(raw: unknown): number | null {
  let value: number;
  if (typeof raw === "number") value = raw;
  else if (typeof raw === "string") {
    let clean = raw.replace(/s\/\.?/i, "").replace(/\s+/g, "");
    if (/^\d+,\d+$/.test(clean)) clean = clean.replace(",", ".");
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) clean = clean.replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(clean)) return null;
    value = Number(clean);
  } else return null;
  if (!Number.isFinite(value) || value < 0 || value > MAX_COST) return null;
  return Math.round(value * 10_000) / 10_000;
}

export type CostRowStatus = "ok" | "error";

export interface CostPreviewRow {
  row: number;
  code: string;
  status: CostRowStatus;
  /** Por qué no se carga (con `status: "error"`). */
  problem: string | null;
  variantId: string | null;
  productName: string | null;
  cost: number | null;
}

/**
 * Vista previa: cada fila se resuelve contra lo que devolvió el catálogo para su código. No se carga una fila
 * sin SKU, con un costo inválido, con un SKU que no existe o que corresponde a varias variantes, ni una
 * variante repetida (vale la primera fila).
 */
export function buildCostPreview(rows: CostSheetRow[], matches: VariantCodeMatch[]): CostPreviewRow[] {
  const byCode = new Map<string, VariantCodeMatch[]>();
  for (const match of matches) {
    const list = byCode.get(match.code) ?? [];
    if (!list.some((item) => item.variantId === match.variantId)) list.push(match);
    byCode.set(match.code, list);
  }
  const firstRowOf = new Map<string, number>();
  return rows.map((row): CostPreviewRow => {
    const base = { row: row.row, code: row.code, variantId: null, productName: null, cost: null as number | null };
    if (!row.code) return { ...base, status: "error", problem: "Falta el SKU." };
    const cost = parseCostValue(row.rawCost);
    const found = byCode.get(row.code) ?? [];
    if (found.length === 0) return { ...base, cost, status: "error", problem: "El SKU no existe en tu catálogo." };
    if (found.length > 1)
      return { ...base, cost, status: "error", problem: `El SKU corresponde a ${found.length} variantes: usa el SKU de la variante.` };
    const [match] = found;
    const named = { ...base, variantId: match.variantId, productName: match.productName || null, cost };
    if (cost === null) return { ...named, status: "error", problem: "Costo inválido: un número de 0 en adelante." };
    const first = firstRowOf.get(match.variantId);
    if (first !== undefined) return { ...named, status: "error", problem: `Repetido: esa variante ya está en la fila ${first}.` };
    firstRowOf.set(match.variantId, row.row);
    return { ...named, status: "ok", problem: null };
  });
}

/** Lo que se envía (solo las filas válidas). */
export function costItems(preview: CostPreviewRow[]): Array<{ variantId: string; averageCost: number }> {
  return preview
    .filter((row) => row.status === "ok" && row.variantId && row.cost !== null)
    .map((row) => ({ variantId: row.variantId as string, averageCost: row.cost as number }));
}
