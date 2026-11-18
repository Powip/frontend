import {
  buildBulkImportRow,
  canImportPreview,
  importResultText,
  parseBulkImportResponse,
  previewRows,
  previewSummaryText,
  type ImportSourceRow,
} from "../bulkImportPreview";

const RESPONSE = {
  dryRun: true,
  success: false,
  message: "Vista previa: 1 para crear, 1 para actualizar, 1 con errores",
  created: 0,
  updated: 0,
  errors: 1,
  errorDetails: ["Fila 3 («Gorra»): El SKU GOR-1 ya existe en tu empresa (producto «Gorra vieja»)"],
  rows: [
    { index: 2, status: "error", errors: ["El SKU GOR-1 ya existe en tu empresa (producto «Gorra vieja»)"], warnings: [], productName: "Gorra", productSku: null, variantSku: "GOR-1" },
    { index: 0, status: "crear", errors: [], warnings: [], productName: "Polo", productSku: "POL0042", variantSku: "POL0042-S" },
    { index: 1, status: "actualizar", errors: [], warnings: ["La cantidad no se aplica a una variante que ya existe."], productName: "Polo", productSku: "POL0042", variantSku: "POL0042-M" },
  ],
  summary: { total: 3, crear: 1, actualizar: 1, error: 1, productosNuevos: 1, marcasNuevas: ["Nike"] },
};

describe("bulkImportPreview (FEAT-24 H4)", () => {
  it("lee la vista previa y une cada fila con su número de fila del Excel", () => {
    const parsed = parseBulkImportResponse(RESPONSE);
    const rows = previewRows(parsed, [2, 3, 7]);
    expect(rows.map((r) => [r.excelRow, r.status])).toEqual([[2, "crear"], [3, "actualizar"], [7, "error"]]);
    expect(rows[1].warnings).toEqual(["La cantidad no se aplica a una variante que ya existe."]);
    expect(parsed.summary.marcasNuevas).toEqual(["Nike"]);
    expect(previewSummaryText(parsed.summary)).toBe("1 para crear · 1 para actualizar · 1 con errores · 1 productos nuevos");
  });

  it("no deja importar con errores ni sin nada para hacer", () => {
    expect(canImportPreview(parseBulkImportResponse(RESPONSE))).toBe(false);
    const ok = { ...RESPONSE, rows: RESPONSE.rows.slice(1), summary: { ...RESPONSE.summary, error: 0 } };
    expect(canImportPreview(parseBulkImportResponse(ok))).toBe(true);
    expect(canImportPreview(parseBulkImportResponse({ ...ok, summary: { ...ok.summary, crear: 0, actualizar: 0 } }))).toBe(false);
    expect(canImportPreview(null)).toBe(false);
  });

  it("una fila con errores cuenta como error aunque diga otro estado", () => {
    const parsed = parseBulkImportResponse({ ...RESPONSE, rows: [{ index: 0, status: "crear", errors: ["x"], warnings: [] }] });
    expect(parsed.rows[0].status).toBe("error");
  });

  it("un backend sin vista previa se avisa en vez de mostrar una tabla vacía", () => {
    expect(() => parseBulkImportResponse({ created: 1, errors: 0, message: "ok" })).toThrow(/no devolvió la vista previa/);
  });

  it("resume el resultado de la importación real", () => {
    const done = parseBulkImportResponse({ ...RESPONSE, dryRun: false, created: 4, updated: 2, errors: 0 });
    expect(importResultText(done)).toEqual({ ok: true, text: "Importación completada: 4 variantes creadas, 2 actualizadas." });
    expect(importResultText(parseBulkImportResponse({ ...RESPONSE, created: 0, updated: 0, errors: 3 }))).toEqual({ ok: false, text: "No se importó nada: 3 filas con errores." });
  });

  it("arma la fila: columnas v2 solo si vienen", () => {
    const base: ImportSourceRow = {
      name: "polo", description: "", companySku: "POL", attributes: { Talla: "S" }, priceBase: 10, priceVta: 20, quantity: 3, min_stock: 1, subcategoryId: "sub-1",
    };
    expect(buildBulkImportRow(base, "Polo")).toEqual({
      name: "Polo", description: "", companySku: "POL", attributes: { Talla: "S" }, priceBase: 10, priceVta: 20, quantity: 3, min_stock: 1, subcategoryId: "sub-1",
    });
    expect(buildBulkImportRow({ ...base, variantSku: " POL-S ", barcode: "775 123", brand: "Nike", purchaseUnit: "Caja", purchaseFactor: 12 }, "Polo")).toMatchObject({
      variantSku: "POL-S", barcode: "775123", brand: "Nike", purchaseUnit: "Caja", purchaseFactor: 12,
    });
    expect(buildBulkImportRow({ ...base, variantSku: "  ", purchaseFactor: null }, "Polo")).not.toHaveProperty("variantSku");
  });
});
