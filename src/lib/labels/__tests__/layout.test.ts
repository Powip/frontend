import { barcodeRects, planLabel, qrRects, wrapText, type LabelElement } from "../layout";
import { SAMPLE_LABEL_LINE, type LabelField, type LabelLine } from "../types";

const format = (fields: LabelField[], widthMm = 50, heightMm = 25) => ({ widthMm, heightMm, fields });
const texts = (elements: LabelElement[]) =>
  elements.filter((e): e is Extract<LabelElement, { kind: "text" }> => e.kind === "text").map((e) => [e.block, e.text]);
const kinds = (elements: LabelElement[]) => elements.map((e) => e.kind);
const line = (patch: Partial<LabelLine> = {}): LabelLine => ({ ...SAMPLE_LABEL_LINE, ...patch });

describe("planLabel — qué se pinta (FEAT-24 H7)", () => {
  it("paints only the active fields", () => {
    const elements = planLabel(format(["name", "sku", "barcode"], 60, 40), line());
    expect(texts(elements)).toEqual([
      ["name", "Polo básico de algodón"],
      ["mid", "POLO-M-NEG"],
      ["caption", "7750123400012"],
    ]);
    expect(kinds(elements)).toContain("barcode");
    expect(kinds(elements)).not.toContain("qr");
    expect(JSON.stringify(elements)).not.toContain("59.90");
    expect(JSON.stringify(elements)).not.toContain("Mi marca");
  });

  it("joins store and brand, and variant, SKU and location, on one line each", () => {
    const elements = planLabel(
      format(["store", "brand", "variant", "sku", "location", "barcode"], 100, 50),
      line(),
      { storeName: "Tienda Centro" },
    );
    expect(texts(elements)).toEqual(
      expect.arrayContaining([
        ["top", "Tienda Centro · Mi marca"],
        ["mid", "M / Negro · POLO-M-NEG · A-01"],
      ]),
    );
  });

  it("formats the price in soles and skips it when the variant has none", () => {
    expect(texts(planLabel(format(["price", "barcode"], 40, 30), line()))).toContainEqual(["price", "S/ 59.90"]);
    expect(texts(planLabel(format(["price", "barcode"], 40, 30), line({ price: null })))).not.toContainEqual(
      expect.arrayContaining(["price"]),
    );
  });

  it("skips data the line does not bring (location and lot arrive with H5 and lots)", () => {
    const elements = planLabel(format(["location", "lot", "barcode"], 100, 50), line({ location: null, lot: null }));
    expect(texts(elements)).toEqual([["caption", "7750123400012"]]);
  });

  it("passes the code and its type to the barcode (EAN-13 or CODE128)", () => {
    const ean = planLabel(format(["barcode"]), line());
    expect(ean.find((e) => e.kind === "barcode")).toMatchObject({ code: "7750123400012", codeType: "EAN13" });
    const code128 = planLabel(format(["barcode"]), line({ code: "PRD-1", codeType: "CODE128" }));
    expect(code128.find((e) => e.kind === "barcode")).toMatchObject({ code: "PRD-1", codeType: "CODE128" });
  });

  it("puts the QR with the system SKU at the right; alone, it fills the label", () => {
    const withText = planLabel(format(["name", "qr"], 50, 50), line());
    const qr = withText.find((e) => e.kind === "qr");
    expect(qr).toMatchObject({ text: "POLO-M-NEG" });
    const name = withText.find((e) => e.kind === "text")!;
    expect(name.x + 0).toBeLessThan((qr as { x: number }).x);
    const alone = planLabel(format(["qr"], 50, 50), line()).find((e) => e.kind === "qr") as { x: number; size: number };
    expect(alone.size).toBeCloseTo(45);
    expect(alone.x).toBeCloseTo(2.5);
  });

  it("writes the company name instead of the logo when there is no image", () => {
    expect(texts(planLabel(format(["logo", "barcode"], 60, 40), line(), { companyName: "LIVII" }))).toContainEqual([
      "logo",
      "LIVII",
    ]);
    const withImage = planLabel(format(["logo", "barcode"], 60, 40), line(), { hasLogo: true });
    expect(kinds(withImage)).toContain("logo");
  });

  it("keeps every element inside the label", () => {
    for (const [w, h] of [[50, 25], [40, 30], [50, 50], [60, 40], [100, 50]]) {
      const all: LabelField[] = ["logo", "store", "brand", "name", "variant", "sku", "location", "lot", "price", "barcode", "qr"];
      for (const e of planLabel(format(all, w, h), line(), { companyName: "LIVII" })) {
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.y).toBeGreaterThanOrEqual(0);
        if (e.kind === "barcode") expect(e.y + e.h).toBeLessThanOrEqual(h);
        if (e.kind === "qr") expect(e.x + e.size).toBeLessThanOrEqual(w + 1e-9);
      }
    }
  });

  it("drops the least important lines when a small label is full, never the price nor the code", () => {
    const all: LabelField[] = ["store", "brand", "name", "variant", "sku", "lot", "price", "barcode"];
    const longName = line({ name: "Polera oversize de algodón pima peruano con capucha" });
    const small = texts(planLabel(format(all, 50, 25), longName));
    const blocks = small.map(([block]) => block);
    // Sale el lote, después tienda/marca y el nombre baja a una línea; variante/SKU, precio y código quedan.
    expect(blocks).toEqual(["name", "mid", "price", "caption"]);
    expect(small[0][1].endsWith("…")).toBe(true);
    // En 100×50 entra todo.
    const big = texts(planLabel(format(all, 100, 50), longName)).map(([block]) => block);
    expect(big).toEqual(expect.arrayContaining(["top", "name", "mid", "lot", "price", "caption"]));
  });
});

describe("wrapText", () => {
  it("wraps by words and cuts the last line with an ellipsis", () => {
    const lines = wrapText("Polo básico de algodón peruano pima extra largo", 20, 7, true, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("splits a word longer than the line", () => {
    expect(wrapText("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 10, 7, false, 5).length).toBeGreaterThan(1);
  });
});

describe("rects", () => {
  it("leaves the quiet zone at both sides of the bars", () => {
    const rects = barcodeRects({ x: 2, y: 3, w: 113, h: 10, codeType: "EAN13" }, [[0, 1], [94, 1]], 95);
    // 95 módulos + 9 de silencio a cada lado = 113 → 1 mm por módulo.
    expect(rects).toEqual([
      { x: 11, y: 3, w: 1, h: 10 },
      { x: 105, y: 3, w: 1, h: 10 },
    ]);
  });

  it("scales the QR runs to the square", () => {
    expect(qrRects({ x: 10, y: 20, size: 21 }, 21, [[2, 3, 4]])).toEqual([{ x: 13, y: 22, w: 4, h: 1 }]);
  });
});
