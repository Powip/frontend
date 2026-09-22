/**
 * Tests: getCommissionLines
 *
 * Comportamiento verificado:
 * 1. Resuelve con la lista completa de líneas de comisión del mock.
 * 2. Cada línea tiene un id único.
 * 3. Las líneas en estado "reverso" pueden tener comisión de 1er mes negativa.
 */

import { getCommissionLines } from "../get-commission-lines";
import { COMMISSION_LINES_MOCK } from "../../mocks/commission-lines.mock";

describe("getCommissionLines", () => {
  it("resuelve con la lista completa del mock", async () => {
    const result = await getCommissionLines();
    expect(result).toHaveLength(COMMISSION_LINES_MOCK.length);
  });

  it("cada línea tiene un id único", async () => {
    const result = await getCommissionLines();
    const ids = result.map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('una línea "reverso" puede tener comisión de 1er mes negativa', async () => {
    const result = await getCommissionLines();
    const reversos = result.filter(
      (line) => line.status === "reverso" && line.firstMonthCommission !== null,
    );

    expect(reversos.length).toBeGreaterThan(0);
    for (const line of reversos) {
      expect(line.firstMonthCommission).toBeLessThan(0);
    }
  });
});
