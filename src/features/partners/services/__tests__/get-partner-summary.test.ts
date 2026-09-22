/**
 * Tests: getPartnerSummary
 *
 * Comportamiento verificado:
 * 1. Resuelve una promesa con el shape completo de PartnerSummary.
 * 2. Los campos de comisión son números (no hay cálculo, solo el valor del mock).
 * 3. El resultado es el mismo objeto mockeado en partner-summary.mock.ts (fuente de verdad única).
 */

import { getPartnerSummary } from "../get-partner-summary";
import { PARTNER_SUMMARY_MOCK } from "../../mocks/partner-summary.mock";

describe("getPartnerSummary", () => {
  it("resuelve con el PartnerSummary mockeado", async () => {
    const result = await getPartnerSummary();
    expect(result).toEqual(PARTNER_SUMMARY_MOCK);
  });

  it("incluye tier, commissionOption, funnel y nextPayout", async () => {
    const result = await getPartnerSummary();
    expect(result.tier).toBeDefined();
    expect(result.commissionOption).toBeDefined();
    expect(Array.isArray(result.funnel)).toBe(true);
    expect(result.nextPayout).toBeDefined();
  });

  it("los montos de comisión son números", async () => {
    const result = await getPartnerSummary();
    expect(typeof result.recurringActiveMonthly).toBe("number");
    expect(typeof result.firstMonthCommissionThisMonth).toBe("number");
    expect(typeof result.pendingCommission).toBe("number");
    expect(typeof result.totalPaidToDate).toBe("number");
  });
});
