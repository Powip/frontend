/**
 * Tests: CommissionsKpiRow
 *
 * Comportamiento verificado:
 * 1. Mientras isLoading es true (o no hay summary), muestra los skeletons y no los valores.
 * 2. Con reversals negativo, el KPI de "Reversos" se muestra con signo "–".
 * 3. Con reversals en 0, el KPI de "Reversos" no lleva signo negativo.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { CommissionsKpiRow } from "../commissions-kpi-row";
import type { PartnerSummary } from "@/features/partners/models/partner-summary";

function makeSummary(overrides: Partial<PartnerSummary> = {}): PartnerSummary {
  return {
    tier: { level: "bronce", activeMrr: 0, nextLevelThreshold: 500, extraResidualPct: 0 },
    commissionOption: { code: "A", firstMonthPct: 40, recurringPct: 6 },
    recurringActiveMonthly: 27.48,
    firstMonthCommissionThisMonth: 68.04,
    pendingCommission: 11.34,
    totalPaidToDate: 512.9,
    funnel: [],
    nextPayout: { amount: 0, payoutDate: "2026-08-25", breakdown: [] },
    reversals: 0,
    ...overrides,
  };
}

describe("CommissionsKpiRow", () => {
  it("no muestra valores mientras carga", () => {
    render(<CommissionsKpiRow summary={undefined} isLoading={true} />);
    expect(screen.queryByText(/recurrente activa\/mes/i)).not.toBeInTheDocument();
  });

  it('con reversals negativo, muestra el signo "–"', () => {
    render(<CommissionsKpiRow summary={makeSummary({ reversals: -5.94 })} isLoading={false} />);
    expect(screen.getByText(/– S\/ 5\.94/)).toBeInTheDocument();
  });

  it("con reversals en 0, no muestra signo negativo", () => {
    render(<CommissionsKpiRow summary={makeSummary({ reversals: 0 })} isLoading={false} />);
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
    expect(screen.getByText("S/ 0.00")).toBeInTheDocument();
  });
});
