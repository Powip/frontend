import { barcodeModules, barRuns, qrMatrix } from "../codes";

describe("barcodeModules (FEAT-24 H7)", () => {
  it("encodes a valid EAN-13 in 95 modules with the guard bars", () => {
    const modules = barcodeModules("7750123400012", "EAN13");
    expect(modules).toHaveLength(95);
    expect(modules!.startsWith("101")).toBe(true);
    expect(modules!.endsWith("101")).toBe(true);
  });

  it("encodes the POWIP EAN-13", () => {
    expect(barcodeModules("2000000000015", "EAN13")).toHaveLength(95);
  });

  it("returns null for an EAN-13 with a wrong check digit", () => {
    expect(barcodeModules("7750123400011", "EAN13")).toBeNull();
  });

  it("encodes a SKU as CODE128 and rejects characters CODE128 does not have", () => {
    expect(barcodeModules("POLO-M-NEG", "CODE128")).toMatch(/^1[01]+1$/);
    expect(barcodeModules("ñandú", "CODE128")).toBeNull();
  });
});

describe("barRuns", () => {
  it("groups the consecutive black modules", () => {
    expect(barRuns("1101000111")).toEqual([
      [0, 2],
      [3, 1],
      [7, 3],
    ]);
    expect(barRuns("000")).toEqual([]);
  });
});

describe("qrMatrix", () => {
  it("builds the QR of the SKU as dark runs per row", () => {
    const matrix = qrMatrix("POLO-M-NEG");
    expect(matrix!.size).toBe(21);
    // El patrón de esquina: la primera fila empieza con 7 módulos oscuros.
    expect(matrix!.runs[0]).toEqual([0, 0, 7]);
  });
});
