import {
  CONFIRM_UNITS_THRESHOLD,
  MAX_ITEM_UNITS,
  MAX_ITEM_UNITS_MESSAGE,
  largeQuantityConfirmText,
  needsQuantityConfirmation,
} from "@/lib/stockLimits";

describe("stockLimits (FEAT-24 H0)", () => {
  it("usa los mismos valores que el backend", () => {
    expect(MAX_ITEM_UNITS).toBe(10_000);
    expect(CONFIRM_UNITS_THRESHOLD).toBe(1_000);
    expect(MAX_ITEM_UNITS_MESSAGE).toBe("La cantidad máxima por variante y almacén es 10,000 unidades.");
  });

  it("pide confirmar desde 1.001", () => {
    expect(needsQuantityConfirmation(1000)).toBe(false);
    expect(needsQuantityConfirmation(1001)).toBe(true);
  });

  it("arma el texto de confirmación", () => {
    expect(largeQuantityConfirmText(2500)).toBe("Estás cargando 2,500 unidades. ¿Confirmas la cantidad?");
  });
});
