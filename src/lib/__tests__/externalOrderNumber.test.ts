import {
  EXTERNAL_ORDER_NUMBER_LABEL,
  hasExternalOrderNumbers,
} from "../externalOrderNumber";

describe("hasExternalOrderNumbers (FEAT-31)", () => {
  it("la etiqueta compartida es «N° Externo»", () => {
    expect(EXTERNAL_ORDER_NUMBER_LABEL).toBe("N° Externo");
  });

  it("sin filas no hay columna", () => {
    expect(hasExternalOrderNumbers([])).toBe(false);
  });

  it.each([
    [[{}]],
    [[{ externalOrderNumber: null }]],
    [[{ externalOrderNumber: undefined }]],
    [[{ externalOrderNumber: "" }]],
    [[{ externalOrderNumber: "   " }]],
  ])("sin ningún número útil no hay columna: %j", (rows) => {
    expect(hasExternalOrderNumbers(rows)).toBe(false);
  });

  it("alcanza con que una sola fila lo traiga", () => {
    expect(
      hasExternalOrderNumbers([{}, { externalOrderNumber: "AGPE923190" }, { externalOrderNumber: null }]),
    ).toBe(true);
  });
});
