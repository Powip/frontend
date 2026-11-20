import { buildCostPreview, cellValue, costItems, MAX_COST_ROWS, parseCostValue, rowsFromSheet } from "../costImport";
import type { VariantCodeMatch } from "@/services/variantCodesService";

// FEAT-24 H3-E (H3-D17) — Excel de costos: lectura de columnas, costo de cada
// celda y vista previa contra el catálogo.

const match = (code: string, variantId: string, productName = "Polo"): VariantCodeMatch => ({
  code,
  variantId,
  sku: code,
  companySku: code,
  productId: "p-1",
  productName,
  matchedBy: "companySku",
});

describe("rowsFromSheet", () => {
  it("encuentra las columnas por nombre (sin tildes ni mayúsculas) y salta las filas vacías", () => {
    const sheet = rowsFromSheet(["Producto", "SKU de la Empresa", "COSTO"], [
      { row: 2, cells: ["Polo", "POLO-M", 18.5] },
      { row: 3, cells: [null, null, null] },
      { row: 4, cells: ["Gorra", { richText: [{ text: "GOR" }, { text: "RA" }] }, { formula: "A1*2", result: 7 }] },
    ]);
    expect(sheet).toEqual({
      error: null,
      rows: [
        { row: 2, code: "POLO-M", rawCost: 18.5 },
        { row: 4, code: "GORRA", rawCost: 7 },
      ],
    });
  });

  it("sin las columnas avisa qué falta", () => {
    expect(rowsFromSheet(["SKU", "Precio"], [{ row: 2, cells: ["A", 1] }]).error).toMatch(/«SKU de la empresa» y «Costo»/);
  });

  it("sin filas o con demasiadas filas no carga nada", () => {
    expect(rowsFromSheet(["SKU", "Costo"], []).error).toBe("El archivo no tiene filas con datos.");
    const many = Array.from({ length: MAX_COST_ROWS + 1 }, (_, index) => ({ row: index + 2, cells: [`S-${index}`, 1] }));
    expect(rowsFromSheet(["SKU", "Costo"], many).error).toMatch(/carga hasta 1000 por vez/);
  });

  it("cellValue lee hipervínculos y fórmulas", () => {
    expect(cellValue({ text: "SKU-1", hyperlink: "http://x" })).toBe("SKU-1");
    expect(cellValue({ formula: "1+1", result: 2 })).toBe(2);
    expect(cellValue(undefined)).toBeNull();
  });
});

describe("parseCostValue", () => {
  it("acepta números, coma decimal, soles y miles; redondea a 4 decimales", () => {
    expect(parseCostValue(18.5)).toBe(18.5);
    expect(parseCostValue("12,50")).toBe(12.5);
    expect(parseCostValue("S/ 1,234.50")).toBe(1234.5);
    expect(parseCostValue(12.123456)).toBe(12.1235);
    expect(parseCostValue(0)).toBe(0);
  });

  it("rechaza negativos, texto y vacío", () => {
    expect(parseCostValue(-1)).toBeNull();
    expect(parseCostValue("abc")).toBeNull();
    expect(parseCostValue("")).toBeNull();
    expect(parseCostValue(null)).toBeNull();
  });
});

describe("buildCostPreview", () => {
  it("una fila buena se carga; un SKU que no existe y un costo inválido no", () => {
    const preview = buildCostPreview(
      [
        { row: 2, code: "POLO-M", rawCost: "18,50" },
        { row: 3, code: "NO-EXISTE", rawCost: 10 },
        { row: 4, code: "GORRA", rawCost: "gratis" },
      ],
      [match("POLO-M", "v-1"), match("GORRA", "v-2", "Gorra")],
    );
    expect(preview).toEqual([
      { row: 2, code: "POLO-M", status: "ok", problem: null, variantId: "v-1", productName: "Polo", cost: 18.5 },
      { row: 3, code: "NO-EXISTE", status: "error", problem: "El SKU no existe en tu catálogo.", variantId: null, productName: null, cost: 10 },
      {
        row: 4,
        code: "GORRA",
        status: "error",
        problem: "Costo inválido: un número de 0 en adelante.",
        variantId: "v-2",
        productName: "Gorra",
        cost: null,
      },
    ]);
    expect(costItems(preview)).toEqual([{ variantId: "v-1", averageCost: 18.5 }]);
  });

  it("una variante repetida vale la primera fila; un SKU de varias variantes no se carga", () => {
    const preview = buildCostPreview(
      [
        { row: 2, code: "POLO-M", rawCost: 10 },
        { row: 3, code: "POLO-M", rawCost: 11 },
        { row: 4, code: "POLO", rawCost: 9 },
        { row: 5, code: "", rawCost: 9 },
      ],
      [match("POLO-M", "v-1"), match("POLO", "v-1"), match("POLO", "v-2")],
    );
    expect(preview.map((row) => row.problem)).toEqual([
      null,
      "Repetido: esa variante ya está en la fila 2.",
      "El SKU corresponde a 2 variantes: usa el SKU de la variante.",
      "Falta el SKU.",
    ]);
    expect(costItems(preview)).toEqual([{ variantId: "v-1", averageCost: 10 }]);
  });
});
