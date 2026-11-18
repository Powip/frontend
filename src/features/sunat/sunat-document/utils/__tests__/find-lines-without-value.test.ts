import { describeLinesWithoutValue, findLinesWithoutValue } from "../find-lines-without-value";

const line = (productName: string, unitPrice: number, discountAmount = 0, quantity = 1) => ({
  productName,
  quantity,
  unitPrice,
  discountAmount,
});

describe("findLinesWithoutValue", () => {
  it("no marca nada cuando todas las líneas tienen valor", () => {
    expect(findLinesWithoutValue([line("Kit", 168.64), line("Envío", 8.47)])).toEqual([]);
  });

  it("marca un regalo con precio 0, con su número de línea", () => {
    expect(findLinesWithoutValue([line("Regalo", 0), line("Kit", 168.64)])).toEqual([
      { lineNumber: 1, productName: "Regalo" },
    ]);
  });

  it("marca el envío gratis: descuento igual al precio, aunque tenga muchos decimales", () => {
    const net = 10 / 1.18;

    expect(
      findLinesWithoutValue([line("Kit", 160.17), line("Servicio de entrega", net, net)]),
    ).toEqual([{ lineNumber: 2, productName: "Servicio de entrega" }]);
  });

  it("marca un producto con descuento del 100% en varias unidades", () => {
    expect(findLinesWithoutValue([line("Promo", 25, 50, 2)])).toEqual([
      { lineNumber: 1, productName: "Promo" },
    ]);
  });

  it("no marca un descuento parcial", () => {
    expect(findLinesWithoutValue([line("Kit", 168.64, 8.47)])).toEqual([]);
  });
});

describe("describeLinesWithoutValue", () => {
  it("nombra los productos", () => {
    expect(
      describeLinesWithoutValue([
        { lineNumber: 1, productName: "Regalo" },
        { lineNumber: 3, productName: "Servicio de entrega" },
      ]),
    ).toBe("«Regalo» y «Servicio de entrega»");
  });
});
