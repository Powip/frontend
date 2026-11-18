/**
 * @jest-environment node
 */
import { jsPDF } from "jspdf";
import { buildLabelsPdf } from "../pdf";
import { SAMPLE_LABEL_LINE, type LabelFormatShape } from "../types";

// FEAT-24 H7 — el generador con el jsPDF real (sin simular): cantidad de páginas y tamaño de cada una.
// Entorno node: el generador no usa el DOM (barras y QR en vector) y jsPDF necesita TextEncoder.

const format = (patch: Partial<LabelFormatShape>): LabelFormatShape => ({
  name: "Prueba",
  widthMm: 50,
  heightMm: 25,
  output: "termica",
  fields: ["name", "variant", "sku", "price", "barcode", "qr"],
  ...patch,
});

function pages(doc: jsPDF) {
  const sizes: Array<[number, number]> = [];
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    sizes.push([
      Math.round(doc.internal.pageSize.getWidth() * 100) / 100,
      Math.round(doc.internal.pageSize.getHeight() * 100) / 100,
    ]);
  }
  return sizes;
}

const build = (f: LabelFormatShape, quantities: number[]) =>
  buildLabelsPdf(
    {
      format: f,
      lines: quantities.map((quantity, i) => ({
        ...SAMPLE_LABEL_LINE,
        variantId: `v${i}`,
        quantity,
        ...(i % 2 ? { code: "PRD-AB12-XL", codeType: "CODE128" as const } : {}),
      })),
      storeName: "Tienda Centro",
      companyName: "LIVII",
    },
    (options) => new jsPDF(options) as never,
  ) as unknown as jsPDF;

describe("buildLabelsPdf con jsPDF real", () => {
  it.each([
    [50, 25],
    [40, 30],
    [50, 50],
    [60, 40],
    [100, 50],
  ])("térmica %i×%i: una página por etiqueta, del tamaño del formato", (widthMm, heightMm) => {
    const doc = build(format({ widthMm, heightMm }), [2, 1]);
    expect(pages(doc)).toEqual([
      [widthMm, heightMm],
      [widthMm, heightMm],
      [widthMm, heightMm],
    ]);
    expect(new TextDecoder().decode(new Uint8Array(doc.output("arraybuffer")).slice(0, 5))).toBe("%PDF-");
  });

  it.each([
    [50, 25, 44],
    [40, 30, 45],
    [50, 50, 20],
    [60, 40, 21],
    [100, 50, 10],
  ])("A4 %i×%i: %i por hoja, hojas de 210×297", (widthMm, heightMm, perPage) => {
    const doc = build(format({ widthMm, heightMm, output: "a4" }), [perPage, 1]);
    expect(pages(doc)).toEqual([
      [210, 297],
      [210, 297],
    ]);
  });

  it("2000 etiquetas en A4 50×25 son 46 hojas", () => {
    const doc = build(format({ output: "a4", fields: ["name", "barcode"] }), [1000, 1000]);
    expect(doc.getNumberOfPages()).toBe(Math.ceil(2000 / 44));
  });
});
