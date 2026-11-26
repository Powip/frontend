import {
  formatSignedStock,
  isNegativeStockConfirmError,
  negativeAfterExit,
  negativeConfirmLabel,
  negativeStockConfirmMessage,
} from "../stockControl";

// FEAT-24 C-D3 — salidas a negativo con confirmación (control de stock flexible).
describe("stockControl", () => {
  const confirm409 = { response: { status: 409, data: { statusCode: 409, code: "STOCK_NEGATIVO_CONFIRMAR", message: "Queda en −2." } } };

  it("reconoce el 409 de confirmación por su code; el 409 de estricto (sin code) no", () => {
    expect(isNegativeStockConfirmError(confirm409)).toBe(true);
    expect(isNegativeStockConfirmError({ response: { status: 409, data: { message: "Stock insuficiente (control estricto)." } } })).toBe(false);
    expect(isNegativeStockConfirmError(new Error("Network Error"))).toBe(false);
    expect(isNegativeStockConfirmError(null)).toBe(false);
  });

  it("toma el mensaje del servidor, o uno genérico", () => {
    expect(negativeStockConfirmMessage(confirm409)).toBe("Queda en −2.");
    expect(negativeStockConfirmMessage({ response: { data: { message: ["Línea 1 en −2", "Línea 2 en −1"] } } })).toBe("Línea 1 en −2. Línea 2 en −1");
    expect(negativeStockConfirmMessage({ response: { data: {} } })).toBe("La salida deja el físico en negativo: confirma para seguir.");
  });

  it("el signo menos tipográfico y el texto de la casilla", () => {
    expect(formatSignedStock(-3)).toBe("−3");
    expect(formatSignedStock(0)).toBe("0");
    expect(formatSignedStock(4)).toBe("4");
    expect(negativeConfirmLabel(-3)).toBe("Confirmo que el físico quedará en −3");
    expect(negativeConfirmLabel(null)).toBe("Confirmo que el físico quedará en negativo");
    expect(negativeConfirmLabel(2)).toBe("Confirmo que el físico quedará en negativo");
  });

  it("negativeAfterExit: solo las variantes cuyo físico queda bajo 0 (suma líneas repetidas; sin dato no cuenta)", () => {
    const physical = new Map([
      ["v-1", 5],
      ["v-2", 1],
      ["v-3", -4],
    ]);
    const result = negativeAfterExit(
      [
        { variantId: "v-1", quantity: 5 },
        { variantId: "v-2", quantity: 1 },
        { variantId: "v-2", quantity: 1 },
        { variantId: "v-3", quantity: 0 },
        { variantId: "v-9", quantity: 50 },
      ],
      physical,
    );
    expect([...result]).toEqual([["v-2", -1]]);
    expect([...negativeAfterExit([{ variantId: "v-3", quantity: 1 }], physical)]).toEqual([["v-3", -5]]);
  });
});
