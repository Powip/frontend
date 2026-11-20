/**
 * FEAT-24 H4 (H4-D9) — Excel v2: lectura de la respuesta de `POST /products/bulk-import[?dryRun=true]`
 * y armado de las filas que se mandan. Sin React.
 */

export type BulkImportRowStatus = "crear" | "actualizar" | "error";

export interface BulkImportRowResult {
  /** Posición en `rows` (desde 0). */
  index: number;
  status: BulkImportRowStatus;
  errors: string[];
  warnings: string[];
  productName: string | null;
  productSku: string | null;
  variantSku: string | null;
}

export interface BulkImportSummary {
  total: number;
  crear: number;
  actualizar: number;
  error: number;
  productosNuevos: number;
  marcasNuevas: string[];
}

export interface BulkImportResponse {
  dryRun: boolean;
  message: string;
  created: number;
  updated: number;
  errors: number;
  errorDetails: string[];
  rows: BulkImportRowResult[];
  summary: BulkImportSummary;
}

export const ROW_STATUS_LABEL: Record<BulkImportRowStatus, string> = {
  crear: "Crear",
  actualizar: "Actualizar",
  error: "Error",
};

const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
const textOrNull = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

/**
 * Normaliza la respuesta. Un backend anterior (sin `rows`/`summary`) no sirve para la vista previa:
 * se avisa en vez de mostrar una tabla vacía como si todo estuviera bien.
 */
export function parseBulkImportResponse(data: unknown): BulkImportResponse {
  const body = (data ?? {}) as Record<string, unknown>;
  if (!Array.isArray(body.rows) || typeof body.summary !== "object" || body.summary === null) {
    throw new Error("El servidor no devolvió la vista previa de la importación. Actualiza la página e inténtalo de nuevo.");
  }
  const rows = (body.rows as unknown[]).map((raw, position) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const status = row.status === "crear" || row.status === "actualizar" ? row.status : "error";
    return {
      index: Number.isInteger(row.index) ? (row.index as number) : position,
      status: strings(row.errors).length ? "error" : status,
      errors: strings(row.errors),
      warnings: strings(row.warnings),
      productName: textOrNull(row.productName),
      productSku: textOrNull(row.productSku),
      variantSku: textOrNull(row.variantSku),
    } satisfies BulkImportRowResult;
  });
  const summary = body.summary as Record<string, unknown>;
  return {
    dryRun: body.dryRun === true,
    message: typeof body.message === "string" ? body.message : "",
    created: num(body.created),
    updated: num(body.updated),
    errors: num(body.errors),
    errorDetails: strings(body.errorDetails),
    rows,
    summary: {
      total: num(summary.total) || rows.length,
      crear: num(summary.crear),
      actualizar: num(summary.actualizar),
      error: num(summary.error),
      productosNuevos: num(summary.productosNuevos),
      marcasNuevas: strings(summary.marcasNuevas),
    },
  };
}

export interface PreviewRow extends BulkImportRowResult {
  /** Fila de la hoja de Excel (para que el cliente sepa cuál corregir). */
  excelRow: number | null;
}

/** Une cada resultado con su fila del Excel (`rowNumbers[i]` es la fila que viajó en la posición i). */
export function previewRows(response: BulkImportResponse, rowNumbers: number[]): PreviewRow[] {
  return [...response.rows]
    .sort((a, b) => a.index - b.index)
    .map((row) => ({ ...row, excelRow: rowNumbers[row.index] ?? null }));
}

/** Se importa solo si la vista previa no tiene errores y hay algo para crear o actualizar. */
export function canImportPreview(response: BulkImportResponse | null): boolean {
  return Boolean(response && response.summary.error === 0 && response.summary.crear + response.summary.actualizar > 0);
}

export function previewSummaryText(summary: BulkImportSummary): string {
  const parts = [`${summary.crear} para crear`, `${summary.actualizar} para actualizar`, `${summary.error} con errores`];
  if (summary.productosNuevos) parts.push(`${summary.productosNuevos} productos nuevos`);
  return parts.join(" · ");
}

/** Resultado de la importación real para el aviso final. */
export function importResultText(response: BulkImportResponse): { ok: boolean; text: string } {
  const done = response.created + response.updated;
  if (done === 0) {
    return { ok: false, text: response.errors > 0 ? `No se importó nada: ${response.errors} filas con errores.` : "No se importó ninguna fila." };
  }
  const pieces = [`${response.created} variantes creadas`, `${response.updated} actualizadas`];
  if (response.errors > 0) pieces.push(`${response.errors} filas con errores`);
  return { ok: response.errors === 0, text: `Importación completada: ${pieces.join(", ")}.` };
}

/** Fila de la planilla ya validada en el navegador (lo que hace falta para armar el cuerpo). */
export interface ImportSourceRow {
  name: string;
  description: string;
  companySku: string;
  variantSku?: string;
  barcode?: string;
  brand?: string;
  purchaseUnit?: string;
  purchaseFactor?: number | null;
  attributes: Record<string, string>;
  priceBase: number;
  priceVta: number;
  quantity: number;
  min_stock: number;
  subcategoryId?: string;
}

const optional = (value: string | undefined) => {
  const clean = (value ?? "").trim();
  return clean ? clean : undefined;
};

/** Cuerpo de cada fila de `bulk-import` (columnas v2 solo si vienen: el servidor trata vacío = no informado). */
export function buildBulkImportRow(row: ImportSourceRow, canonicalName: string) {
  const out: Record<string, unknown> = {
    name: canonicalName,
    description: row.description,
    companySku: row.companySku,
    attributes: row.attributes,
    priceBase: row.priceBase,
    priceVta: row.priceVta,
    quantity: row.quantity,
    min_stock: row.min_stock,
    subcategoryId: row.subcategoryId,
  };
  const extras: Array<[string, string | undefined]> = [
    ["variantSku", optional(row.variantSku)],
    ["barcode", optional(row.barcode)?.replace(/\s+/g, "")],
    ["brand", optional(row.brand)],
    ["purchaseUnit", optional(row.purchaseUnit)],
  ];
  for (const [key, value] of extras) if (value) out[key] = value;
  if (row.purchaseFactor) out.purchaseFactor = row.purchaseFactor;
  return out;
}
