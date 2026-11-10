/**
 * Plantilla de carga masiva de productos (B3) — lógica pura, sin React.
 *
 * Qué corrige respecto de la versión anterior:
 * - Las tallas y colores iban en UNA celda "Atributos (Color:Rojo,Talle:M)". Si la celda venía
 *   vacía, con otro formato ("S", "Talla=M") o la columna no se reconocía, el atributo se
 *   descartaba SIN AVISO y la variante quedaba vacía: el detalle del producto mostraba
 *   "Variante 1, 2, 3, 4" sin la talla. Ahora Talla y Color tienen su propia columna y
 *   cualquier celda mal escrita es un error de esa fila.
 * - Las filas de un mismo producto se agrupan por nombre (el servidor agrupa por nombre
 *   exacto): aquí se normaliza para que "Polo básico" y "polo  basico" sean el mismo producto.
 * - Un producto con varias filas exige atributos en todas y no admite variantes repetidas.
 * - Los números mal escritos ya no se convierten en 0 en silencio.
 */
import ExcelJS from "exceljs";
import { MAX_ITEM_UNITS, MAX_ITEM_UNITS_MESSAGE } from "@/lib/stockLimits";

/* ───────────────────────── constantes ───────────────────────── */

export const TEMPLATE_VERSION = "2";
/** Las filas cuyo Nombre empieza así son de ejemplo y no se cargan. */
export const EXAMPLE_MARKER = "(EJEMPLO)";
/** Cuántas filas de la hoja "Productos" llevan listas desplegables y validaciones. */
export const VALIDATED_ROWS = 500;

export const SIZE_SUGGESTIONS = ["XS", "S", "M", "L", "XL", "XXL", "Única"];
export const COLOR_SUGGESTIONS = [
  "Negro", "Blanco", "Rojo", "Azul", "Verde", "Amarillo", "Rosado", "Gris", "Beige", "Marrón", "Morado", "Naranja",
];

export type ParsedRowFieldKey =
  | "categoryName"
  | "subcategoryName"
  | "name"
  | "description"
  | "companySku"
  | "size"
  | "color"
  | "otherAttrs"
  | "priceBase"
  | "priceVta"
  | "quantity"
  | "min_stock";

/** Quita tildes y pasa a minúsculas: "Categoría" y "categoria" son la misma columna. */
export const fold = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Header normalizado (sin tildes, sin "*", sin mayúsculas) → campo interno. */
export const HEADER_COLUMN_KEYS: Record<string, ParsedRowFieldKey> = {
  categoria: "categoryName",
  subcategoria: "subcategoryName",
  nombre: "name",
  descripcion: "description",
  "sku empresa": "companySku",
  talla: "size",
  color: "color",
  "otros atributos": "otherAttrs",
  "precio compra": "priceBase",
  "precio venta": "priceVta",
  cantidad: "quantity",
  "stock minimo": "min_stock",
};

export const REQUIRED_HEADERS: { header: string; key: ParsedRowFieldKey }[] = [
  { header: "Nombre *", key: "name" },
  { header: "Categoría *", key: "categoryName" },
  { header: "Subcategoría *", key: "subcategoryName" },
  { header: "Precio Compra *", key: "priceBase" },
  { header: "Precio Venta *", key: "priceVta" },
  { header: "Cantidad *", key: "quantity" },
];

export const normalizeHeaderText = (value: unknown): string => fold(String(value ?? "").replace(/\*/g, ""));

/** La plantilla anterior tenía una sola columna "Atributos (Color:Rojo,Talle:M)". */
export const isLegacyHeader = (value: unknown): boolean => normalizeHeaderText(value).startsWith("atributos");

export const LEGACY_TEMPLATE_MESSAGE =
  "Esta plantilla es de una versión anterior (tiene la columna «Atributos») y ya no se puede cargar: " +
  "ahí las tallas y colores se perdían sin avisar y los productos quedaban como «Variante 1, 2, 3…». " +
  "Descarga la plantilla nueva, pasa tus productos (una fila por talla o color) y súbela de nuevo. " +
  "No se cargó ningún producto.";

/* ───────────────────────── lectura de celdas ───────────────────────── */

/** Texto de una celda de ExcelJS, incluidas las de fórmula, texto enriquecido e hipervínculo. */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return v.richText.map((part) => String((part as { text?: unknown }).text ?? "")).join("").trim();
    }
    if ("result" in v) return cellToText(v.result);
    if ("text" in v) return cellToText(v.text);
  }
  return String(value).trim();
}

export type CellNum =
  | { kind: "empty" }
  | { kind: "number"; value: number }
  | { kind: "invalid"; text: string };

export function readCellNumber(value: unknown): CellNum {
  const raw = typeof value === "number" ? value : cellToText(value);
  if (typeof raw === "number") return Number.isFinite(raw) ? { kind: "number", value: raw } : { kind: "invalid", text: String(raw) };
  if (raw === "") return { kind: "empty" };
  // Tolera "S/ 12,50" y "12,5": una coma decimal sin punto. Lo demás (letras, "1,234.5") es inválido.
  let text = raw.replace(/\s/g, "").replace(/^S\/\.?/i, "");
  if (text.includes(",") && !text.includes(".")) text = text.replace(",", ".");
  const parsed = Number(text);
  return text !== "" && Number.isFinite(parsed) ? { kind: "number", value: parsed } : { kind: "invalid", text: raw };
}

/* ───────────────────────── atributos ───────────────────────── */

const ATTRIBUTE_ALIASES: Record<string, string> = {
  talla: "Talla",
  talle: "Talla",
  tallas: "Talla",
  color: "Color",
  colores: "Color",
};

/** "talle", "TALLA" y "Tallas" son todos "Talla": así no se parte el mismo atributo en tres. */
export function canonicalAttributeName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  return ATTRIBUTE_ALIASES[fold(clean)] ?? clean;
}

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

export function buildAttributes(
  size: string,
  color: string,
  otherAttrs: string,
): { attributes: Record<string, string>; errors: string[] } {
  const attributes: Record<string, string> = {};
  const errors: string[] = [];
  if (size.trim()) attributes.Talla = collapse(size);
  if (color.trim()) attributes.Color = collapse(color);

  for (const piece of otherAttrs.split(/[;\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const at = piece.indexOf(":");
    if (at < 1) {
      errors.push(`Otros atributos: «${piece}» no tiene el formato Nombre:Valor (separa varios con punto y coma).`);
      continue;
    }
    const name = canonicalAttributeName(piece.slice(0, at));
    const value = collapse(piece.slice(at + 1));
    if (!name || !value) {
      errors.push(`Otros atributos: «${piece}» no tiene el formato Nombre:Valor.`);
      continue;
    }
    if (value.includes(":")) {
      errors.push(`Otros atributos: «${piece}» mezcla varios atributos; sepáralos con punto y coma (;).`);
      continue;
    }
    if (attributes[name] !== undefined) {
      errors.push(`Otros atributos: «${name}» ya tiene su propia columna o está repetido; no lo repitas.`);
      continue;
    }
    attributes[name] = value;
  }
  return { attributes, errors };
}

export function formatAttributes(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes);
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(" · ") : "—";
}

/* ───────────────────────── filas ───────────────────────── */

export interface ParsedRow {
  /** Número de fila en la hoja de Excel, para decirle al cliente cuál corregir. */
  rowNumber: number;
  categoryName?: string;
  subcategoryName?: string;
  subcategoryId?: string;
  /** Por qué no se pudo resolver la subcategoría al leer el archivo. */
  subcategoryProblem?: string;
  name: string;
  description: string;
  companySku: string;
  size: string;
  color: string;
  otherAttrs: string;
  attributes: Record<string, string>;
  priceBase: number;
  priceVta: number;
  quantity: number;
  min_stock: number;
  /** Problemas de la propia fila (nombre, números, atributos), calculados al leer. */
  rowProblems: string[];
  /** Resultado final de validar: problemas de la fila + los del producto al que pertenece. */
  error?: string;
}

export interface RawSheetRow {
  rowNumber: number;
  categoryName: string;
  subcategoryName: string;
  name: string;
  description: string;
  companySku: string;
  size: string;
  color: string;
  otherAttrs: string;
  priceBase: CellNum;
  priceVta: CellNum;
  quantity: CellNum;
  min_stock: CellNum;
}

export const isExampleName = (name: string): boolean => name.trim().toUpperCase().startsWith(EXAMPLE_MARKER);

/** Misma regla que usa el servidor para agrupar (nombre exacto), pero tolerante a espacios, tildes y mayúsculas. */
export const productGroupKey = (name: string): string => fold(name);

/** Pasa una fila leída del Excel a la fila de trabajo, con sus problemas propios. */
export function buildParsedRow(
  raw: RawSheetRow,
  resolved: { subcategoryId?: string; problem?: string },
): ParsedRow {
  const problems: string[] = [];
  const { attributes, errors: attrErrors } = buildAttributes(raw.size, raw.color, raw.otherAttrs);
  problems.push(...attrErrors);

  if (!raw.name.trim()) problems.push("Falta el nombre del producto.");

  const money = (label: string, cell: CellNum, positive: boolean): number => {
    if (cell.kind === "empty") {
      problems.push(`Falta el ${label}.`);
      return 0;
    }
    if (cell.kind === "invalid") {
      problems.push(`${label} no es un número: «${cell.text}». Escribe solo el número, sin letras.`);
      return 0;
    }
    if (cell.value < 0) problems.push(`${label} no puede ser negativo.`);
    else if (positive && cell.value === 0) problems.push(`${label} debe ser mayor a 0.`);
    return cell.value;
  };
  const priceBase = money("Precio Compra", raw.priceBase, false);
  const priceVta = money("Precio Venta", raw.priceVta, true);

  let quantity = 0;
  if (raw.quantity.kind === "empty") problems.push("Falta la cantidad (escribe 0 si no hay stock).");
  else if (raw.quantity.kind === "invalid") problems.push(`La cantidad no es un número: «${raw.quantity.text}».`);
  else {
    quantity = raw.quantity.value;
    if (quantity < 0) problems.push("Cantidad inválida.");
    else if (!Number.isInteger(quantity)) problems.push("La cantidad debe ser un número entero.");
    else if (quantity > MAX_ITEM_UNITS) problems.push(MAX_ITEM_UNITS_MESSAGE);
  }

  let min_stock = 0;
  if (raw.min_stock.kind === "invalid") problems.push(`El stock mínimo no es un número: «${raw.min_stock.text}».`);
  else if (raw.min_stock.kind === "number") {
    min_stock = raw.min_stock.value;
    if (min_stock < 0) problems.push("Stock mínimo inválido.");
  }

  return {
    rowNumber: raw.rowNumber,
    categoryName: raw.categoryName,
    subcategoryName: raw.subcategoryName,
    subcategoryId: resolved.subcategoryId ?? "",
    subcategoryProblem: resolved.problem,
    name: collapse(raw.name),
    description: raw.description,
    companySku: raw.companySku,
    size: raw.size,
    color: raw.color,
    otherAttrs: raw.otherAttrs,
    attributes,
    priceBase,
    priceVta,
    quantity,
    min_stock,
    rowProblems: problems,
  };
}

/**
 * Calcula `error` de cada fila desde cero (se puede volver a llamar tras editar una fila):
 * problemas propios + subcategoría + reglas del producto (filas con el mismo nombre).
 */
export function validateRows(rows: ParsedRow[]): ParsedRow[] {
  const issues: string[][] = rows.map((row) => {
    const own = [...row.rowProblems];
    if (!row.subcategoryId) own.unshift(row.subcategoryProblem ?? "Elige una subcategoría.");
    return own;
  });

  const groups = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = productGroupKey(row.name);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });

  const skuOwner = new Map<string, number>();

  groups.forEach((indexes) => {
    const first = rows[indexes[0]];
    const label = `«${first.name}»`;

    if (indexes.length > 1) {
      const seen = new Map<string, number>();
      for (const i of indexes) {
        const row = rows[i];
        const entries = Object.entries(row.attributes);
        if (entries.length === 0) {
          issues[i].push(
            `${label} tiene ${indexes.length} filas: indica Talla, Color u otro atributo en cada una para distinguir las variantes.`,
          );
          continue;
        }
        const signature = entries.map(([k, v]) => `${fold(k)}=${fold(v)}`).sort().join("|");
        const earlier = seen.get(signature);
        if (earlier !== undefined) {
          issues[i].push(
            `Variante repetida: la fila ${rows[earlier].rowNumber} ya tiene ${formatAttributes(row.attributes)} para ${label}.`,
          );
        } else {
          seen.set(signature, i);
        }
      }
      for (const i of indexes.slice(1)) {
        const row = rows[i];
        const sameDestination = first.subcategoryId
          ? row.subcategoryId === first.subcategoryId
          : fold(row.subcategoryName) === fold(first.subcategoryName) && fold(row.categoryName) === fold(first.categoryName);
        if (!sameDestination) {
          issues[i].push(`Las filas de ${label} deben tener la misma categoría y subcategoría (como la fila ${first.rowNumber}).`);
        }
      }
    }

    // El servidor busca el producto primero por SKU Empresa: dos productos con el mismo SKU se fusionarían.
    for (const i of indexes) {
      const sku = rows[i].companySku.trim().toLowerCase();
      if (!sku) continue;
      const owner = skuOwner.get(sku);
      if (owner === undefined) skuOwner.set(sku, i);
      else if (productGroupKey(rows[owner].name) !== productGroupKey(rows[i].name)) {
        issues[i].push(
          `El SKU Empresa «${rows[i].companySku}» ya lo usa otro producto («${rows[owner].name}», fila ${rows[owner].rowNumber}): cada producto necesita el suyo.`,
        );
      }
    }
  });

  return rows.map((row, i) => ({ ...row, error: issues[i].length ? issues[i].join(" ") : undefined }));
}

/** Nombre único por producto: todas las filas del grupo viajan con el nombre de la primera. */
export function canonicalProductNames(rows: ParsedRow[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const row of rows) {
    const key = productGroupKey(row.name);
    if (key && !names.has(key)) names.set(key, row.name);
  }
  return names;
}

/** "Fila 7 · Polo básico: …" para listar los errores al cliente. */
export function describeRowError(row: ParsedRow): string {
  return `Fila ${row.rowNumber}${row.name ? ` · ${row.name}` : ""}: ${row.error}`;
}

/* ───────────────────── lectura de la hoja de Excel ───────────────────── */

export function buildColumnIndexMap(headerRow: ExcelJS.Row): Partial<Record<ParsedRowFieldKey, number>> {
  const map: Partial<Record<ParsedRowFieldKey, number>> = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = HEADER_COLUMN_KEYS[normalizeHeaderText(cell.value)];
    if (key) map[key] = colNumber;
  });
  return map;
}

export function readHeaderTexts(headerRow: ExcelJS.Row): string[] {
  const texts: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => texts.push(cellToText(cell.value)));
  return texts;
}

/** Filas de datos de la hoja "Productos". Ignora filas vacías y de ejemplo; informa cuántas de ejemplo. */
export function readSheetRows(
  sheet: ExcelJS.Worksheet,
  columnIndexMap: Partial<Record<ParsedRowFieldKey, number>>,
): { rows: RawSheetRow[]; ignoredExamples: number } {
  const text = (row: ExcelJS.Row, key: ParsedRowFieldKey) => {
    const col = columnIndexMap[key];
    return col ? cellToText(row.getCell(col).value) : "";
  };
  const num = (row: ExcelJS.Row, key: ParsedRowFieldKey): CellNum => {
    const col = columnIndexMap[key];
    return col ? readCellNumber(row.getCell(col).value) : { kind: "empty" };
  };

  const rows: RawSheetRow[] = [];
  let ignoredExamples = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: RawSheetRow = {
      rowNumber,
      categoryName: text(row, "categoryName"),
      subcategoryName: text(row, "subcategoryName"),
      name: text(row, "name"),
      description: text(row, "description"),
      companySku: text(row, "companySku"),
      size: text(row, "size"),
      color: text(row, "color"),
      otherAttrs: text(row, "otherAttrs"),
      priceBase: num(row, "priceBase"),
      priceVta: num(row, "priceVta"),
      quantity: num(row, "quantity"),
      min_stock: num(row, "min_stock"),
    };
    if (isExampleName(raw.name)) {
      ignoredExamples += 1;
      return;
    }
    const numbersEmpty = [raw.priceBase, raw.priceVta, raw.quantity].every((c) => c.kind === "empty");
    // Fila en blanco o rótulo suelto (sin nombre ni números): no es un producto.
    if (!raw.name && numbersEmpty) return;
    rows.push(raw);
  });
  return { rows, ignoredExamples };
}

/* ───────────────────────── plantilla descargable ───────────────────────── */

export const PRODUCT_COLUMNS: { header: string; key: ParsedRowFieldKey; width: number }[] = [
  { header: "Categoría *", key: "categoryName", width: 22 },
  { header: "Subcategoría *", key: "subcategoryName", width: 22 },
  { header: "Nombre *", key: "name", width: 32 },
  { header: "Descripción", key: "description", width: 34 },
  { header: "SKU Empresa", key: "companySku", width: 16 },
  { header: "Talla", key: "size", width: 11 },
  { header: "Color", key: "color", width: 13 },
  { header: "Otros atributos", key: "otherAttrs", width: 28 },
  { header: "Precio Compra *", key: "priceBase", width: 16 },
  { header: "Precio Venta *", key: "priceVta", width: 15 },
  { header: "Cantidad *", key: "quantity", width: 12 },
  { header: "Stock Mínimo", key: "min_stock", width: 13 },
];

export const INSTRUCTIONS: string[] = [
  "CÓMO LLENAR LA PLANTILLA DE PRODUCTOS",
  "",
  "1. Una fila por variante. Un polo con 4 tallas son 4 filas: el MISMO Nombre y una Talla distinta en cada una.",
  "2. Escribe el Nombre igual en todas las filas del producto. Así se agrupan en un solo producto.",
  "3. Talla y Color: un valor por fila (S, M, L, XL / Rojo, Negro…). Si el producto solo tiene talla, deja Color vacío, y al revés.",
  "4. Otros atributos (opcional): Nombre:Valor, separando varios con punto y coma. Ejemplo: Material:Algodón; Diseño:Liso.",
  "5. Si un producto tiene varias filas, cada una necesita al menos un atributo (Talla, Color u Otros) para distinguirse.",
  "6. No repitas la misma combinación de atributos dentro de un producto (dos filas con Talla S del mismo polo).",
  "7. Categoría y Subcategoría: elige de la lista desplegable. Los nombres válidos están en la hoja «Categorías Válidas».",
  "8. Precio Compra, Precio Venta y Cantidad: solo números, sin «S/» ni letras. Cantidad: entero entre 0 y 10,000.",
  "9. El stock se carga en el almacén que elijas en el Paso 3 (un almacén por archivo).",
  "10. Las filas cuyo Nombre empieza con (EJEMPLO) se ignoran al cargar: puedes borrarlas o dejarlas.",
  "11. Antes de crear nada, el sistema revisa todas las filas y te dice cuál corregir. No se crea ningún producto hasta que todas estén bien.",
  "",
  `Plantilla versión ${TEMPLATE_VERSION}`,
];

interface ExampleRow {
  name: string;
  size?: string;
  color?: string;
  other?: string;
  sku?: string;
  priceBase: number;
  priceVta: number;
  quantity: number;
  min_stock: number;
}

const EXAMPLES: ExampleRow[] = [
  { name: `${EXAMPLE_MARKER} Polo básico`, size: "S", priceBase: 15, priceVta: 35, quantity: 10, min_stock: 2 },
  { name: `${EXAMPLE_MARKER} Polo básico`, size: "M", priceBase: 15, priceVta: 35, quantity: 12, min_stock: 2 },
  { name: `${EXAMPLE_MARKER} Polo básico`, size: "L", priceBase: 15, priceVta: 35, quantity: 8, min_stock: 2 },
  { name: `${EXAMPLE_MARKER} Polo básico`, size: "XL", priceBase: 15, priceVta: 35, quantity: 5, min_stock: 2 },
  { name: `${EXAMPLE_MARKER} Zapatillas urbanas`, size: "40", color: "Negro", other: "Material:Cuero", priceBase: 60, priceVta: 120, quantity: 6, min_stock: 1 },
  { name: `${EXAMPLE_MARKER} Zapatillas urbanas`, size: "40", color: "Blanco", other: "Material:Cuero", priceBase: 60, priceVta: 120, quantity: 4, min_stock: 1 },
  { name: `${EXAMPLE_MARKER} Zapatillas urbanas`, size: "41", color: "Negro", other: "Material:Cuero", priceBase: 60, priceVta: 120, quantity: 3, min_stock: 1 },
];

export interface TemplateOptions {
  isBase: boolean;
  inventoryId: string;
  /** Categoría/subcategoría elegidas en el Paso 1 (plantilla personalizada). */
  categoryName?: string;
  subcategoryName?: string;
  /** Pares válidos para la hoja de referencia y las listas desplegables. */
  validCategories?: { category: string; subcategory: string }[];
}

const headerStyle = (row: ExcelJS.Row) => {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  row.alignment = { horizontal: "center" };
};

export function templateFileName(opts: TemplateOptions): string {
  return opts.isBase
    ? "Plantilla_Base_Importacion.xlsx"
    : `Plantilla_${opts.categoryName || "Cat"}_${opts.subcategoryName || "Sub"}.xlsx`;
}

/** Libro de la plantilla v2: instrucciones, productos (con ejemplos y listas), referencia y metadata. */
export function buildTemplateWorkbook(opts: TemplateOptions): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  const meta = workbook.addWorksheet("_metadata");
  meta.state = "hidden";
  meta.addRow(["inventoryId", opts.isBase ? "" : opts.inventoryId]);
  meta.addRow(["templateVersion", TEMPLATE_VERSION]);

  const guide = workbook.addWorksheet("Instrucciones");
  guide.getColumn(1).width = 130;
  INSTRUCTIONS.forEach((line) => guide.addRow([line]));
  const title = guide.getRow(1);
  title.font = { bold: true, size: 14 };
  if (!opts.isBase && opts.categoryName) {
    guide.addRow([]);
    guide.addRow([`Categoría de esta plantilla: ${opts.categoryName}${opts.subcategoryName ? ` → ${opts.subcategoryName}` : ""}`]);
  }

  const sheet = workbook.addWorksheet("Productos");
  sheet.columns = PRODUCT_COLUMNS.map(({ header, key, width }) => ({ header, key, width }));
  headerStyle(sheet.getRow(1));

  const category = opts.categoryName || "Ropa";
  const subcategory = opts.subcategoryName || "Polos";
  const examples = opts.isBase ? EXAMPLES : EXAMPLES.slice(0, 4);
  examples.forEach((example, index) => {
    const row = sheet.addRow({
      categoryName: opts.isBase && index >= 4 ? "Calzado" : category,
      subcategoryName: opts.isBase && index >= 4 ? "Zapatillas" : subcategory,
      name: example.name,
      description: "",
      companySku: example.sku ?? "",
      size: example.size ?? "",
      color: example.color ?? "",
      otherAttrs: example.other ?? "",
      priceBase: example.priceBase,
      priceVta: example.priceVta,
      quantity: example.quantity,
      min_stock: example.min_stock,
    });
    row.font = { italic: true, color: { argb: "FF7A7A7A" } };
  });

  const valid = opts.validCategories ?? [];
  if (valid.length > 0) {
    const ref = workbook.addWorksheet("Categorías Válidas");
    ref.columns = [
      { header: "Categoría", key: "category", width: 28 },
      { header: "Subcategoría", key: "subcategory", width: 28 },
    ];
    headerStyle(ref.getRow(1));
    valid.forEach((pair) => ref.addRow({ category: pair.category, subcategory: pair.subcategory }));
  }

  // Listas desplegables y validaciones (en la fila de datos, no solo en la de ejemplo).
  const colOf = (key: ParsedRowFieldKey) => PRODUCT_COLUMNS.findIndex((c) => c.key === key) + 1;
  const sizeList = `"${SIZE_SUGGESTIONS.join(",")}"`;
  const colorList = `"${COLOR_SUGGESTIONS.join(",")}"`;
  const categories = Array.from(new Set(valid.map((p) => p.category)));
  const categoryList = categories.join(",");
  for (let r = 2; r <= VALIDATED_ROWS + 1; r += 1) {
    const row = sheet.getRow(r);
    row.getCell(colOf("size")).dataValidation = { type: "list", allowBlank: true, formulae: [sizeList], showErrorMessage: false };
    row.getCell(colOf("color")).dataValidation = { type: "list", allowBlank: true, formulae: [colorList], showErrorMessage: false };
    if (valid.length > 0) {
      if (categoryList.length <= 250) {
        row.getCell(colOf("categoryName")).dataValidation = {
          type: "list", allowBlank: true, formulae: [`"${categoryList}"`], showErrorMessage: true,
          errorTitle: "Categoría", error: "Elige una categoría de la lista (hoja «Categorías Válidas»).",
        };
      }
      row.getCell(colOf("subcategoryName")).dataValidation = {
        type: "list", allowBlank: true, formulae: [`'Categorías Válidas'!$B$2:$B$${valid.length + 1}`], showErrorMessage: true,
        errorTitle: "Subcategoría", error: "Elige una subcategoría de la lista (hoja «Categorías Válidas»).",
      };
    }
    for (const key of ["priceBase", "priceVta"] as const) {
      row.getCell(colOf(key)).dataValidation = {
        type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [0], showErrorMessage: true,
        errorTitle: "Precio", error: "Escribe solo un número mayor o igual a 0, sin «S/».",
      };
    }
    row.getCell(colOf("quantity")).dataValidation = {
      type: "whole", operator: "between", allowBlank: true, formulae: [0, MAX_ITEM_UNITS], showErrorMessage: true,
      errorTitle: "Cantidad", error: `La cantidad es un número entero entre 0 y ${MAX_ITEM_UNITS.toLocaleString("en-US")}.`,
    };
  }

  return workbook;
}
