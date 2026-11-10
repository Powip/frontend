/**
 * B3 · plantilla de carga masiva. Usa ExcelJS REAL (sin mocks): se genera la plantilla, se llena
 * como la llenaría un cliente, se vuelve a leer con el parser y se valida.
 */
import ExcelJS from "exceljs";
import { formatVariantLabel } from "@/lib/variantAttributes";
import {
  EXAMPLE_MARKER,
  LEGACY_TEMPLATE_MESSAGE,
  TEMPLATE_VERSION,
  buildAttributes,
  buildColumnIndexMap,
  buildParsedRow,
  buildTemplateWorkbook,
  canonicalAttributeName,
  canonicalProductNames,
  cellToText,
  describeRowError,
  formatAttributes,
  isLegacyHeader,
  readCellNumber,
  readHeaderTexts,
  readSheetRows,
  validateRows,
  type CellNum,
  type ParsedRow,
  type RawSheetRow,
} from "../importTemplate";

const num = (value: number): CellNum => ({ kind: "number", value });
const EMPTY: CellNum = { kind: "empty" };

let seq = 1;
function raw(overrides: Partial<RawSheetRow> = {}): RawSheetRow {
  return {
    rowNumber: (seq += 1),
    categoryName: "Ropa",
    subcategoryName: "Polos",
    name: "Polo básico",
    description: "",
    companySku: "",
    size: "",
    color: "",
    otherAttrs: "",
    priceBase: num(15),
    priceVta: num(35),
    quantity: num(10),
    min_stock: num(2),
    ...overrides,
  };
}
const resolved = (subcategoryId = "sub-polos") => ({ subcategoryId });
const rowOf = (overrides: Partial<RawSheetRow> = {}, sub = "sub-polos"): ParsedRow => buildParsedRow(raw(overrides), resolved(sub));
const errorsOf = (rows: ParsedRow[]) => validateRows(rows).map((r) => r.error);

beforeEach(() => {
  seq = 1;
});

/* ───────────────────────── atributos ───────────────────────── */

describe("buildAttributes", () => {
  it("Talla y Color van en su propia columna", () => {
    expect(buildAttributes("M", "Rojo", "")).toEqual({ attributes: { Talla: "M", Color: "Rojo" }, errors: [] });
  });

  it("sin valores no hay atributos y no es un error de esta función", () => {
    expect(buildAttributes("", "", "")).toEqual({ attributes: {}, errors: [] });
  });

  it("Otros atributos: Nombre:Valor separados por punto y coma", () => {
    expect(buildAttributes("", "", "Material:Algodón; Diseño:Liso").attributes).toEqual({ Material: "Algodón", Diseño: "Liso" });
  });

  it.each([
    ["S"], // solo el valor, sin nombre: el caso que antes se perdía en silencio
    ["Talla=M"],
    [":M"],
    ["Talla:"],
  ])("rechaza %j en Otros atributos (antes se descartaba sin avisar)", (text) => {
    const { attributes, errors } = buildAttributes("", "", text);
    expect(errors).toHaveLength(1);
    expect(attributes).toEqual({});
  });

  it("rechaza varios atributos separados por coma en lugar de punto y coma", () => {
    const { errors } = buildAttributes("", "", "Material:Algodón, Diseño:Liso");
    expect(errors[0]).toMatch(/punto y coma/);
  });

  it("rechaza repetir en Otros atributos lo que ya está en su columna", () => {
    const { errors } = buildAttributes("M", "", "Talla:L");
    expect(errors[0]).toMatch(/Talla/);
  });

  it.each([["talle"], ["TALLA"], ["Tallas"], [" talla "]])("%j se guarda como Talla", (name) => {
    expect(canonicalAttributeName(name)).toBe("Talla");
    expect(buildAttributes("", "", `${name}:M`).attributes).toEqual({ Talla: "M" });
  });

  it("colapsa espacios dentro del valor", () => {
    expect(buildAttributes("  XL  ", "Azul   marino", "").attributes).toEqual({ Talla: "XL", Color: "Azul marino" });
  });

  it("formatAttributes", () => {
    expect(formatAttributes({ Talla: "S", Color: "Rojo" })).toBe("Talla: S · Color: Rojo");
    expect(formatAttributes({})).toBe("—");
  });
});

/* ───────────────────────── celdas ───────────────────────── */

describe("readCellNumber / cellToText", () => {
  it.each([
    [12, { kind: "number", value: 12 }],
    ["12", { kind: "number", value: 12 }],
    ["12,50", { kind: "number", value: 12.5 }],
    ["S/ 12.50", { kind: "number", value: 12.5 }],
    [" 7 ", { kind: "number", value: 7 }],
    ["", { kind: "empty" }],
    [null, { kind: "empty" }],
    [undefined, { kind: "empty" }],
    ["abc", { kind: "invalid", text: "abc" }],
    ["12 soles", { kind: "invalid", text: "12 soles" }],
    ["1,234.50", { kind: "invalid", text: "1,234.50" }],
  ])("%j", (value, expected) => {
    expect(readCellNumber(value)).toEqual(expected);
  });

  it("lee el resultado de una fórmula y el texto enriquecido", () => {
    expect(readCellNumber({ formula: "=A1*2", result: 40 })).toEqual({ kind: "number", value: 40 });
    expect(cellToText({ richText: [{ text: "Polo " }, { text: "básico" }] })).toBe("Polo básico");
    expect(cellToText({ text: "Polo", hyperlink: "x" })).toBe("Polo");
  });
});

describe("encabezados", () => {
  it("detecta la plantilla anterior por su columna Atributos", () => {
    expect(isLegacyHeader("Atributos (Color:Rojo,Talle:M)")).toBe(true);
    expect(isLegacyHeader("atributos")).toBe(true);
    expect(isLegacyHeader("Talla")).toBe(false);
    expect(isLegacyHeader("Otros atributos")).toBe(false);
  });
});

/* ───────────────────────── validación ───────────────────────── */

describe("validateRows · el caso del cliente (un producto con varias tallas)", () => {
  it("un polo en S, M, L y XL queda válido y con la talla en los atributos", () => {
    const rows = ["S", "M", "L", "XL"].map((size) => rowOf({ size }));
    const result = validateRows(rows);
    expect(result.map((r) => r.error)).toEqual([undefined, undefined, undefined, undefined]);
    expect(result.map((r) => r.attributes)).toEqual([{ Talla: "S" }, { Talla: "M" }, { Talla: "L" }, { Talla: "XL" }]);
  });

  it("el mismo producto con talla y color también es válido", () => {
    const rows = [
      rowOf({ size: "40", color: "Negro" }),
      rowOf({ size: "40", color: "Blanco" }),
      rowOf({ size: "41", color: "Negro" }),
    ];
    expect(errorsOf(rows)).toEqual([undefined, undefined, undefined]);
  });

  it("EL BUG: 4 filas del mismo producto sin ningún atributo ya no se cargan como 'Variante 1, 2, 3, 4'", () => {
    const rows = [rowOf(), rowOf(), rowOf(), rowOf()];
    const errors = errorsOf(rows);
    errors.forEach((e) => expect(e).toMatch(/tiene 4 filas: indica Talla, Color u otro atributo/));
  });

  it("EL BUG: una celda de atributos mal escrita ('S' sin nombre) es un error, no una variante vacía", () => {
    const rows = ["S", "M", "L", "XL"].map((otherAttrs) => rowOf({ otherAttrs }));
    const errors = errorsOf(rows);
    errors.forEach((e) => {
      expect(e).toMatch(/no tiene el formato Nombre:Valor/);
    });
  });

  it("un producto de una sola fila puede ir sin atributos", () => {
    expect(errorsOf([rowOf({ name: "Cuaderno" })])).toEqual([undefined]);
  });

  it("agrupa por nombre sin importar mayúsculas, tildes ni espacios", () => {
    const rows = [rowOf({ name: "Polo básico", size: "S" }), rowOf({ name: "  polo   BASICO ", size: "M" })];
    expect(errorsOf(rows)).toEqual([undefined, undefined]);
    // dos filas con el mismo nombre escrito distinto y sin atributos: también se detectan como un solo producto
    expect(errorsOf([rowOf({ name: "Polo" }), rowOf({ name: "polo" })])[0]).toMatch(/tiene 2 filas/);
  });

  it("todas las filas de un producto viajan con el nombre de la primera", () => {
    const rows = [rowOf({ name: "Polo básico", size: "S" }), rowOf({ name: "polo  BASICO", size: "M" })];
    const names = canonicalProductNames(rows);
    expect(names.get("polo basico")).toBe("Polo básico");
    expect(names.size).toBe(1);
  });

  it("rechaza la variante repetida y dice con qué fila choca", () => {
    const first = rowOf({ size: "S" });
    const second = rowOf({ size: "s" });
    const result = validateRows([first, second]);
    expect(result[0].error).toBeUndefined();
    expect(result[1].error).toMatch(new RegExp(`la fila ${first.rowNumber} ya tiene Talla: s`));
  });

  it("rechaza filas del mismo producto con distinta categoría/subcategoría", () => {
    const rows = [rowOf({ size: "S" }, "sub-polos"), rowOf({ size: "M" }, "sub-camisas")];
    const result = validateRows(rows);
    expect(result[0].error).toBeUndefined();
    expect(result[1].error).toMatch(/misma categoría y subcategoría/);
  });

  it("rechaza dos productos distintos con el mismo SKU Empresa (el servidor los fusionaría)", () => {
    const rows = [rowOf({ name: "Polo rojo", companySku: "POLO" }), rowOf({ name: "Polo azul", companySku: "polo" })];
    const result = validateRows(rows);
    expect(result[0].error).toBeUndefined();
    expect(result[1].error).toMatch(/ya lo usa otro producto/);
  });

  it("variantes del mismo producto con SKU Empresa propio no chocan entre sí", () => {
    const rows = [rowOf({ size: "S", companySku: "POLO-S" }), rowOf({ size: "M", companySku: "POLO-M" })];
    expect(errorsOf(rows)).toEqual([undefined, undefined]);
  });
});

describe("validateRows · errores por fila que el cliente entiende", () => {
  it("falta el nombre", () => {
    expect(rowOf({ name: "" }).rowProblems).toContain("Falta el nombre del producto.");
  });

  it("números mal escritos ya no se convierten en 0 en silencio", () => {
    const row = rowOf({ priceBase: { kind: "invalid", text: "quince" }, priceVta: EMPTY, quantity: { kind: "invalid", text: "diez" } });
    expect(row.rowProblems.join(" ")).toMatch(/Precio Compra no es un número: «quince»/);
    expect(row.rowProblems.join(" ")).toMatch(/Falta el Precio Venta/);
    expect(row.rowProblems.join(" ")).toMatch(/La cantidad no es un número: «diez»/);
  });

  it("precio de venta 0 y precios negativos", () => {
    expect(rowOf({ priceVta: num(0) }).rowProblems).toContain("Precio Venta debe ser mayor a 0.");
    expect(rowOf({ priceBase: num(-1) }).rowProblems).toContain("Precio Compra no puede ser negativo.");
    expect(rowOf({ priceBase: num(0) }).rowProblems).toEqual([]);
  });

  it("cantidad: vacía, decimal, negativa y por encima del máximo", () => {
    expect(rowOf({ quantity: EMPTY }).rowProblems.join(" ")).toMatch(/Falta la cantidad/);
    expect(rowOf({ quantity: num(2.5) }).rowProblems).toContain("La cantidad debe ser un número entero.");
    expect(rowOf({ quantity: num(-3) }).rowProblems).toContain("Cantidad inválida.");
    expect(rowOf({ quantity: num(10001) }).rowProblems.length).toBe(1);
    expect(rowOf({ quantity: num(0) }).rowProblems).toEqual([]);
  });

  it("subcategoría sin resolver: usa el motivo del archivo y se limpia al elegirla", () => {
    const base = buildParsedRow(raw({ size: "S" }), { problem: 'Subcategoría "Poloss" no encontrada' });
    expect(validateRows([base])[0].error).toMatch(/Poloss/);
    expect(validateRows([{ ...base, subcategoryId: "sub-polos" }])[0].error).toBeUndefined();
  });

  it("al corregir una cosa no se borran los otros errores de la fila", () => {
    const base = buildParsedRow(raw({ size: "S", priceVta: EMPTY }), { problem: "Elige una subcategoría." });
    const fixedSub = validateRows([{ ...base, subcategoryId: "sub-polos" }])[0];
    expect(fixedSub.error).toMatch(/Falta el Precio Venta/);
  });

  it("describeRowError nombra la fila y el producto", () => {
    const row = validateRows([rowOf({ name: "Polo", priceVta: EMPTY })])[0];
    expect(describeRowError(row)).toMatch(new RegExp(`^Fila ${row.rowNumber} · Polo: Falta el Precio Venta`));
  });
});

/* ───────────────────── plantilla real de punta a punta ───────────────────── */

async function roundTrip(workbook: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer as ArrayBuffer);
  return loaded;
}

function parseWorkbook(workbook: ExcelJS.Workbook, subcategoryId = "sub-polos") {
  const sheet = workbook.getWorksheet("Productos")!;
  const map = buildColumnIndexMap(sheet.getRow(1));
  const { rows, ignoredExamples } = readSheetRows(sheet, map);
  const parsed = rows.map((r) => buildParsedRow(r, { subcategoryId }));
  return { parsed: validateRows(parsed), ignoredExamples, map, headers: readHeaderTexts(sheet.getRow(1)) };
}

describe("plantilla v2 generada (ExcelJS real)", () => {
  const validCategories = [
    { category: "Ropa", subcategory: "Polos" },
    { category: "Ropa", subcategory: "Camisas" },
    { category: "Calzado", subcategory: "Zapatillas" },
  ];

  it("trae instrucciones, productos, referencia y la versión en la metadata", async () => {
    const wb = await roundTrip(buildTemplateWorkbook({ isBase: true, inventoryId: "inv-1", validCategories }));
    expect(wb.worksheets.map((s) => s.name)).toEqual(["_metadata", "Instrucciones", "Productos", "Categorías Válidas"]);
    const meta = wb.getWorksheet("_metadata")!;
    expect(meta.state).toBe("hidden");
    expect(meta.getRow(2).getCell(1).value).toBe("templateVersion");
    expect(meta.getRow(2).getCell(2).value).toBe(TEMPLATE_VERSION);
    const guide = wb.getWorksheet("Instrucciones")!;
    const text = guide.getSheetValues().flat().join("\n");
    expect(text).toMatch(/Una fila por variante/);
    expect(text).toMatch(/Talla distinta/);
    expect(text).toMatch(/\(EJEMPLO\)/);
  });

  it("los encabezados de la plantilla los reconoce el parser y no hay columna 'Atributos'", async () => {
    const { headers, map } = parseWorkbook(await roundTrip(buildTemplateWorkbook({ isBase: true, inventoryId: "", validCategories })));
    expect(headers.some(isLegacyHeader)).toBe(false);
    expect(Object.keys(map).sort()).toEqual(
      ["categoryName", "color", "companySku", "description", "min_stock", "name", "otherAttrs", "priceBase", "priceVta", "quantity", "size", "subcategoryName"].sort(),
    );
  });

  it("trae un polo en S, M, L y XL y otro producto con talla y color, marcados como ejemplo", async () => {
    const wb = await roundTrip(buildTemplateWorkbook({ isBase: true, inventoryId: "", validCategories }));
    const sheet = wb.getWorksheet("Productos")!;
    const rows = readSheetRows(sheet, buildColumnIndexMap(sheet.getRow(1)));
    // todas son de ejemplo: no se cargan
    expect(rows.rows).toHaveLength(0);
    expect(rows.ignoredExamples).toBe(7);
    const names = [2, 3, 4, 5, 6, 7, 8].map((r) => String(sheet.getRow(r).getCell(3).value));
    expect(names.slice(0, 4).every((n) => n === `${EXAMPLE_MARKER} Polo básico`)).toBe(true);
    expect([2, 3, 4, 5].map((r) => sheet.getRow(r).getCell(6).value)).toEqual(["S", "M", "L", "XL"]);
    expect(sheet.getRow(6).getCell(6).value).toBe("40");
    expect(sheet.getRow(6).getCell(7).value).toBe("Negro");
  });

  it("la plantilla personalizada usa la categoría y subcategoría elegidas", async () => {
    const wb = await roundTrip(
      buildTemplateWorkbook({ isBase: false, inventoryId: "inv-1", categoryName: "Ropa", subcategoryName: "Camisas", validCategories }),
    );
    const sheet = wb.getWorksheet("Productos")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Ropa");
    expect(sheet.getRow(2).getCell(2).value).toBe("Camisas");
  });

  it("incluye listas desplegables y validaciones en las filas de datos", async () => {
    const wb = await roundTrip(buildTemplateWorkbook({ isBase: true, inventoryId: "", validCategories }));
    const sheet = wb.getWorksheet("Productos")!;
    const dv = (row: number, col: number) => (sheet.getRow(row).getCell(col).dataValidation ?? {}) as ExcelJS.DataValidation;
    // fila 20 está vacía: la lista sigue ahí para cuando el cliente escriba
    expect(dv(20, 6).type).toBe("list");
    expect(dv(20, 6).formulae?.[0]).toMatch(/S,M,L,XL/);
    expect(dv(20, 7).type).toBe("list");
    expect(dv(20, 1).type).toBe("list");
    expect(dv(20, 1).formulae?.[0]).toMatch(/Ropa,Calzado/);
    expect(dv(20, 2).type).toBe("list");
    expect(dv(20, 2).formulae?.[0]).toBe("'Categorías Válidas'!$B$2:$B$4");
    expect(dv(20, 9).type).toBe("decimal");
    expect(dv(20, 10).type).toBe("decimal");
    expect(dv(20, 11).type).toBe("whole");
  });

  it("sin referencia de categorías la plantilla se descarga igual, sin listas de categoría", async () => {
    const wb = await roundTrip(buildTemplateWorkbook({ isBase: true, inventoryId: "" }));
    expect(wb.getWorksheet("Categorías Válidas")).toBeUndefined();
    const sheet = wb.getWorksheet("Productos")!;
    expect(sheet.getRow(20).getCell(1).dataValidation).toBeUndefined();
    expect((sheet.getRow(20).getCell(6).dataValidation as ExcelJS.DataValidation).type).toBe("list");
  });
});

describe("caso del cliente de punta a punta: un producto con varias tallas", () => {
  /** Agrega filas reales (no de ejemplo) a la plantilla, como las llenaría el cliente. */
  async function fill(rows: Array<(string | number)[]>): Promise<ExcelJS.Workbook> {
    const wb = buildTemplateWorkbook({
      isBase: true,
      inventoryId: "",
      validCategories: [{ category: "Ropa", subcategory: "Polos" }],
    });
    const sheet = wb.getWorksheet("Productos")!;
    // borra los ejemplos y escribe las filas del cliente desde la fila 2
    for (let r = 2; r <= 8; r += 1) sheet.getRow(r).values = [];
    rows.forEach((values, i) => {
      // Arreglo contiguo (sin hueco inicial): ExcelJS lo escribe desde la columna A.
      sheet.getRow(2 + i).values = values;
    });
    return roundTrip(wb);
  }
  // Orden de columnas: Categoría, Subcategoría, Nombre, Descripción, SKU, Talla, Color, Otros, Compra, Venta, Cantidad, Mínimo

  it("las 4 tallas llegan como atributos y el detalle del producto las muestra (no 'Variante N' vacío)", async () => {
    const wb = await fill([
      ["Ropa", "Polos", "Polo oversize", "", "", "S", "", "", 18, 49.9, 10, 2],
      ["Ropa", "Polos", "Polo oversize", "", "", "M", "", "", 18, 49.9, 12, 2],
      ["Ropa", "Polos", "Polo oversize", "", "", "L", "", "", 18, 49.9, 8, 2],
      ["Ropa", "Polos", "Polo oversize", "", "", "XL", "", "", 18, 49.9, 5, 2],
    ]);
    const { parsed } = parseWorkbook(wb);
    expect(parsed).toHaveLength(4);
    expect(parsed.map((r) => r.error)).toEqual([undefined, undefined, undefined, undefined]);

    // Lo que se enviaría a POST /products/bulk-import, y lo que guarda el servidor en attributeValues
    const names = canonicalProductNames(parsed);
    const payloadRows = parsed.map((r) => ({
      name: names.get(r.name.toLowerCase())!,
      attributes: r.attributes,
      priceBase: r.priceBase,
      priceVta: r.priceVta,
      quantity: r.quantity,
    }));
    expect(new Set(payloadRows.map((r) => r.name)).size).toBe(1);

    // El detalle rotula cada variante con formatVariantLabel(variant.attributes)
    expect(payloadRows.map((r) => formatVariantLabel(r.attributes, " | "))).toEqual([
      "Talla: S",
      "Talla: M",
      "Talla: L",
      "Talla: XL",
    ]);
    expect(payloadRows.map((r) => r.quantity)).toEqual([10, 12, 8, 5]);
    expect(payloadRows[0].priceVta).toBe(49.9);
  });

  it("talla y color juntos", async () => {
    const wb = await fill([
      ["Ropa", "Polos", "Polo estampado", "", "", "S", "Rojo", "", 18, 40, 4, 1],
      ["Ropa", "Polos", "Polo estampado", "", "", "S", "Azul", "", 18, 40, 4, 1],
    ]);
    const { parsed } = parseWorkbook(wb);
    expect(parsed.map((r) => r.error)).toEqual([undefined, undefined]);
    expect(parsed.map((r) => formatVariantLabel(r.attributes, " | "))).toEqual(["Talla: S | Color: Rojo", "Talla: S | Color: Azul"]);
  });

  it("el cliente de verdad: las tallas escritas en 'Otros atributos' sin nombre ya NO se pierden en silencio", async () => {
    const wb = await fill([
      ["Ropa", "Polos", "Polo oversize", "", "", "", "", "S", 18, 49.9, 10, 2],
      ["Ropa", "Polos", "Polo oversize", "", "", "", "", "M", 18, 49.9, 12, 2],
      ["Ropa", "Polos", "Polo oversize", "", "", "", "", "L", 18, 49.9, 8, 2],
      ["Ropa", "Polos", "Polo oversize", "", "", "", "", "XL", 18, 49.9, 5, 2],
    ]);
    const { parsed } = parseWorkbook(wb);
    expect(parsed.every((r) => !!r.error)).toBe(true);
    expect(describeRowError(parsed[0])).toMatch(/Otros atributos: «S» no tiene el formato Nombre:Valor/);
  });

  it("el cliente de verdad: la talla en una columna que no existe se detecta como producto con varias filas sin atributos", async () => {
    // columna "Medida" no reconocida: sus valores no entran; las 4 filas quedan sin atributos
    const wb = await fill([
      ["Ropa", "Polos", "Polo oversize", "", "", "", "", "", 18, 49.9, 10, 2],
      ["Ropa", "Polos", "Polo oversize", "", "", "", "", "", 18, 49.9, 12, 2],
      ["Ropa", "Polos", "Polo oversize", "", "", "", "", "", 18, 49.9, 8, 2],
      ["Ropa", "Polos", "Polo oversize", "", "", "", "", "", 18, 49.9, 5, 2],
    ]);
    const { parsed } = parseWorkbook(wb);
    expect(parsed.every((r) => /tiene 4 filas/.test(r.error ?? ""))).toBe(true);
  });

  it("ignora filas en blanco y la de ejemplo olvidada; no ignora una fila con números y sin nombre", async () => {
    const wb = await fill([
      ["Ropa", "Polos", "Polo oversize", "", "", "S", "", "", 18, 49.9, 10, 2],
      [],
      ["Ropa", "Polos", `${EXAMPLE_MARKER} algo`, "", "", "M", "", "", 1, 1, 1, 1],
      ["Ropa", "Polos", "", "", "", "L", "", "", 18, 49.9, 8, 2],
    ]);
    const { parsed, ignoredExamples } = parseWorkbook(wb);
    expect(ignoredExamples).toBe(1);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].error).toMatch(/Falta el nombre/);
  });

  it("lee celdas de fórmula (precio calculado) como número", async () => {
    const wb = buildTemplateWorkbook({ isBase: true, inventoryId: "", validCategories: [{ category: "Ropa", subcategory: "Polos" }] });
    const sheet = wb.getWorksheet("Productos")!;
    for (let r = 2; r <= 8; r += 1) sheet.getRow(r).values = [];
    sheet.getRow(2).values = ["Ropa", "Polos", "Gorra", "", "", "", "Negro", "", 10, { formula: "I2*2", result: 20 }, 3, 1];
    const { parsed } = parseWorkbook(await roundTrip(wb));
    expect(parsed[0].priceVta).toBe(20);
    expect(parsed[0].error).toBeUndefined();
  });
});

describe("plantilla anterior", () => {
  it("el archivo viejo se reconoce por su columna Atributos y el mensaje es claro", async () => {
    const legacy = new ExcelJS.Workbook();
    legacy.addWorksheet("_metadata").addRow(["inventoryId", "inv-1"]);
    const sheet = legacy.addWorksheet("Productos");
    sheet.addRow([
      "Categoría *", "Subcategoría *", "Nombre *", "Descripción", "SKU Empresa",
      "Atributos (Color:Rojo,Talle:M)", "Precio Compra *", "Precio Venta *", "Cantidad *", "Stock Mínimo",
    ]);
    sheet.addRow(["Ropa", "Polos", "Polo", "", "", "S", 15, 35, 10, 2]);
    const wb = await roundTrip(legacy);
    const headers = readHeaderTexts(wb.getWorksheet("Productos")!.getRow(1));
    expect(headers.some(isLegacyHeader)).toBe(true);
    expect(LEGACY_TEMPLATE_MESSAGE).toMatch(/plantilla nueva/);
    expect(LEGACY_TEMPLATE_MESSAGE).toMatch(/No se cargó ningún producto/);
  });
});
