import { buildLabelsPdf, downloadLabelsPdf, labelsPdfFileName, totalLabels, type LabelsPdfDoc } from "../pdf";
import { applyQuantities, buildLabelsRequest, printBlocker } from "../request";
import { SAMPLE_LABEL_LINE, type LabelFormatShape, type LabelLine } from "../types";

jest.mock("jspdf", () => ({ jsPDF: jest.fn() }));

/** jsPDF falso: guarda las llamadas y las páginas. */
function fakeDoc() {
  const calls: Array<[string, unknown[]]> = [];
  const doc = new Proxy(
    {},
    {
      get: (_target, prop: string) =>
        (...args: unknown[]) => {
          calls.push([prop, args]);
          return doc;
        },
    },
  ) as LabelsPdfDoc;
  return { doc, calls, of: (name: string) => calls.filter(([n]) => n === name).map(([, args]) => args) };
}

const line = (patch: Partial<LabelLine> = {}): LabelLine => ({ ...SAMPLE_LABEL_LINE, ...patch });
const format = (patch: Partial<LabelFormatShape> = {}): LabelFormatShape => ({
  name: "Básica",
  widthMm: 50,
  heightMm: 25,
  output: "termica",
  fields: ["name", "variant", "sku", "barcode"],
  ...patch,
});

describe("buildLabelsPdf (FEAT-24 H7-D1/D6)", () => {
  it("thermal: one page per label with the format size", () => {
    const fake = fakeDoc();
    const factory = jest.fn(() => fake.doc);
    buildLabelsPdf({ format: format(), lines: [line({ quantity: 2 }), line({ variantId: "v2", quantity: 1 })] }, factory);
    expect(factory).toHaveBeenCalledWith({ unit: "mm", format: [50, 25], orientation: "landscape" });
    expect(fake.of("addPage")).toEqual([
      [[50, 25], "landscape"],
      [[50, 25], "landscape"],
    ]);
    // Sin guías de corte en la térmica.
    expect(fake.of("rect").filter((args) => args[4] === "S")).toHaveLength(0);
  });

  it("thermal 50×50 is portrait", () => {
    const fake = fakeDoc();
    const factory = jest.fn(() => fake.doc);
    buildLabelsPdf({ format: format({ widthMm: 50, heightMm: 50 }), lines: [line()] }, factory);
    expect(factory).toHaveBeenCalledWith({ unit: "mm", format: [50, 50], orientation: "portrait" });
  });

  it("A4: a grid with cut guides, a new sheet every 44 labels of 50×25", () => {
    const fake = fakeDoc();
    const factory = jest.fn(() => fake.doc);
    buildLabelsPdf({ format: format({ output: "a4" }), lines: [line({ quantity: 45 })] }, factory);
    expect(factory).toHaveBeenCalledWith({ unit: "mm", format: "a4", orientation: "portrait" });
    expect(fake.of("addPage")).toEqual([["a4", "portrait"]]);
    const guides = fake.of("rect").filter((args) => args[4] === "S");
    expect(guides).toHaveLength(45);
    expect(guides[0]).toEqual([5, 11, 50, 25, "S"]);
    expect(guides[44]).toEqual([5, 11, 50, 25, "S"]); // primera de la segunda hoja
  });

  it("paints only the active fields", () => {
    const fake = fakeDoc();
    buildLabelsPdf({ format: format({ fields: ["name", "barcode"] }), lines: [line()] }, () => fake.doc);
    const written = fake.of("text").map(([text]) => text);
    expect(written).toEqual(["Polo básico de algodón", "7750123400012"]);
  });

  it("draws the EAN-13 and the CODE128 as vector bars", () => {
    const ean = fakeDoc();
    buildLabelsPdf({ format: format({ fields: ["barcode"] }), lines: [line()] }, () => ean.doc);
    const eanBars = ean.of("rect").filter((args) => args[4] === "F");
    expect(eanBars.length).toBeGreaterThan(20);
    const code128 = fakeDoc();
    buildLabelsPdf(
      { format: format({ fields: ["barcode"] }), lines: [line({ code: "PRD-ABC-1", codeType: "CODE128" })] },
      () => code128.doc,
    );
    expect(code128.of("rect").filter((args) => args[4] === "F").length).toBeGreaterThan(10);
    expect(code128.of("text").map(([t]) => t)).toEqual(["PRD-ABC-1"]);
  });

  it("keeps the code written when it cannot draw the bars", () => {
    const fake = fakeDoc();
    buildLabelsPdf(
      { format: format({ fields: ["barcode"] }), lines: [line({ code: "ñandú", codeType: "CODE128" })] },
      () => fake.doc,
    );
    expect(fake.of("rect")).toHaveLength(0);
    expect(fake.of("text").map(([t]) => t)).toEqual(["ñandú"]);
  });

  it("draws the QR and the logo image when the format has them", () => {
    const fake = fakeDoc();
    buildLabelsPdf(
      {
        format: format({ widthMm: 60, heightMm: 40, fields: ["logo", "name", "qr"] }),
        lines: [line()],
        logoDataUrl: "data:image/png;base64,AAAA",
      },
      () => fake.doc,
    );
    expect(fake.of("addImage")).toHaveLength(1);
    expect(fake.of("addImage")[0][1]).toBe("PNG");
    expect(fake.of("rect").filter((args) => args[4] === "F").length).toBeGreaterThan(20);
  });

  it("skips lines with quantity 0", () => {
    const fake = fakeDoc();
    buildLabelsPdf({ format: format(), lines: [line({ quantity: 0 }), line({ quantity: 1 })] }, () => fake.doc);
    expect(fake.of("addPage")).toHaveLength(0);
  });

  it("refuses 0 labels and more than 2000", () => {
    expect(() => buildLabelsPdf({ format: format(), lines: [line({ quantity: 0 })] }, () => fakeDoc().doc)).toThrow(
      "No hay etiquetas para imprimir.",
    );
    expect(() =>
      buildLabelsPdf({ format: format(), lines: [line({ quantity: 1500 }), line({ quantity: 501 })] }, () => fakeDoc().doc),
    ).toThrow("Son 2001 etiquetas y el máximo por impresión es 2000.");
  });

  it("downloads with a file name from the format", () => {
    const fake = fakeDoc();
    expect(downloadLabelsPdf({ format: format({ name: "Con precio Ñ" }), lines: [line({ quantity: 3 })] }, () => fake.doc)).toBe(3);
    expect(fake.of("save")).toEqual([["etiquetas-con-precio-n.pdf"]]);
    expect(labelsPdfFileName("***")).toBe("etiquetas-formato.pdf");
  });

  it("counts the labels, ignoring negatives and decimals", () => {
    expect(totalLabels([{ quantity: 2.7 }, { quantity: -1 }, { quantity: 3 }])).toBe(5);
  });
});

describe("labels request", () => {
  it("prints the products 1 each, or by the stock of the chosen warehouse", () => {
    const source = { kind: "products" as const, productIds: ["p1", "p1", "p2"] };
    expect(buildLabelsRequest(source, "fixed")).toEqual({ origin: "products", ids: ["p1", "p2"] });
    expect(buildLabelsRequest(source, "stock")).toBeNull();
    expect(buildLabelsRequest(source, "stock", { inventoryId: "w1" })).toEqual({
      origin: "stock",
      inventoryId: "w1",
      ids: ["p1", "p2"],
    });
    expect(buildLabelsRequest({ kind: "products", productIds: [] }, "fixed")).toBeNull();
  });

  it("prints the catalog filtered by category or brand", () => {
    expect(buildLabelsRequest({ kind: "catalog" }, "fixed", { filter: { categoryId: "c1" } })).toEqual({
      origin: "products",
      categoryId: "c1",
    });
    expect(buildLabelsRequest({ kind: "catalog" }, "stock", { inventoryId: "w1", filter: { brandId: "b1" } })).toEqual({
      origin: "stock",
      inventoryId: "w1",
      brandId: "b1",
    });
  });

  it("applies the edited quantities and blocks 0 or more than 2000", () => {
    const lines = [line({ variantId: "a", quantity: 1 }), line({ variantId: "b", quantity: 4 })];
    expect(applyQuantities(lines, { b: 2.9 }).map((l) => l.quantity)).toEqual([1, 2]);
    expect(printBlocker(applyQuantities(lines, { a: 0, b: 0 }))).toBe("No hay etiquetas para imprimir.");
    expect(printBlocker(applyQuantities(lines, { b: 2000 }))).toMatch(/^Son 2001 etiquetas/);
    expect(printBlocker(lines)).toBeNull();
  });
});
