/**
 * Tests: getCommissionOptions
 *
 * Comportamiento verificado:
 * 1. Resuelve con las 3 opciones del mock (A, B, C).
 * 2. Cada opción tiene un código único.
 */

import { getCommissionOptions } from "../get-commission-options";

describe("getCommissionOptions", () => {
  it("resuelve con las 3 opciones del catálogo", async () => {
    const result = await getCommissionOptions();
    expect(result).toHaveLength(3);
    expect(result.map((option) => option.code).sort()).toEqual(["A", "B", "C"]);
  });

  it("cada opción tiene un código único", async () => {
    const result = await getCommissionOptions();
    const codes = result.map((option) => option.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
