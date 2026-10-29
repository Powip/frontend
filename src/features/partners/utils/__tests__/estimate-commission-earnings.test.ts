/**
 * Tests: estimateFirstMonthCommission / estimateRecurringCommission / estimateCommissionEarnings
 *
 * Comportamiento verificado:
 * 1. estimateFirstMonthCommission aplica el descuento antes del %: neto = precio*(1-desc/100),
 *    comisión = neto * firstMonthPct/100.
 * 2. estimateRecurringCommission se calcula sobre el precio full, sin descuento.
 * 3. Con 0% de descuento, estimateFirstMonthCommission coincide con aplicar el % directo al precio.
 * 4. estimateCommissionEarnings multiplica por la cantidad de referidos correctamente.
 * 5. estimateCommissionEarnings con 1 mes de retención no suma meses extra de recurrente
 *    (extraMonths = max(0, retention - 1) = 0).
 * 6. estimateCommissionEarnings con retención > 1 suma (retention - 1) meses de recurrente al total.
 */

import {
  estimateCommissionEarnings,
  estimateFirstMonthCommission,
  estimateRecurringCommission,
} from "../estimate-commission-earnings";

describe("estimateFirstMonthCommission", () => {
  it("aplica el descuento antes del porcentaje de comisión", () => {
    // precio 189, 10% dcto -> neto 170.1, 40% de eso = 68.04
    expect(estimateFirstMonthCommission(189, 40, 10)).toBeCloseTo(68.04, 2);
  });

  it("con 0% de descuento, aplica el % directo sobre el precio", () => {
    expect(estimateFirstMonthCommission(200, 25, 0)).toBe(50);
  });
});

describe("estimateRecurringCommission", () => {
  it("se calcula sobre el precio full, sin descuento", () => {
    expect(estimateRecurringCommission(189, 6)).toBeCloseTo(11.34, 2);
  });
});

describe("estimateCommissionEarnings", () => {
  it("multiplica la comisión por referido por la cantidad de referidos", () => {
    const result = estimateCommissionEarnings({
      referralsCount: 10,
      monthlyPlanPrice: 189,
      retentionMonths: 1,
      firstMonthPct: 40,
      recurringPct: 6,
      discountPct: 10,
    });

    expect(result.firstMonthTotal).toBeCloseTo(result.perReferralFirstMonth * 10, 2);
    expect(result.monthlyRecurringTotal).toBeCloseTo(result.perReferralMonthly * 10, 2);
  });

  it("con retención de 1 mes, el total proyectado es solo la comisión de 1er mes", () => {
    const result = estimateCommissionEarnings({
      referralsCount: 5,
      monthlyPlanPrice: 100,
      retentionMonths: 1,
      firstMonthPct: 40,
      recurringPct: 6,
      discountPct: 0,
    });

    expect(result.projectedTotal).toBeCloseTo(result.firstMonthTotal, 2);
  });

  it("con retención > 1, suma (retención - 1) meses de recurrente al proyectado", () => {
    const result = estimateCommissionEarnings({
      referralsCount: 5,
      monthlyPlanPrice: 100,
      retentionMonths: 4,
      firstMonthPct: 40,
      recurringPct: 6,
      discountPct: 0,
    });

    const expected = result.firstMonthTotal + result.perReferralMonthly * 3 * 5;
    expect(result.projectedTotal).toBeCloseTo(expected, 2);
  });
});
