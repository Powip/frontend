/**
 * Tests: CommissionComparisonTable
 *
 * Comportamiento verificado:
 * 1. Mientras carga, no renderiza la tabla.
 * 2. Renderiza una fila por plan (Basic/Standard/Full) con su precio.
 * 3. Cada celda de opción muestra la comisión de 1er mes y la recurrente calculadas
 *    con las mismas funciones puras del simulador (consistencia entre vistas).
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { CommissionComparisonTable } from "../commission-comparison-table";
import { COMMISSION_OPTIONS_MOCK } from "@/features/partners/mocks/commission-options.mock";
import { PARTNER_PLAN_OPTIONS } from "@/features/partners/models/plan-option";
import {
  estimateFirstMonthCommission,
  estimateRecurringCommission,
} from "@/features/partners/utils/estimate-commission-earnings";
import { formatSoles } from "@/features/partners/utils/format-currency";

describe("CommissionComparisonTable", () => {
  it("no renderiza la tabla mientras carga", () => {
    render(<CommissionComparisonTable options={undefined} isLoading={true} discountPct={10} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renderiza una fila por plan con su precio", () => {
    render(
      <CommissionComparisonTable options={COMMISSION_OPTIONS_MOCK} isLoading={false} discountPct={10} />,
    );
    for (const plan of PARTNER_PLAN_OPTIONS) {
      expect(screen.getByText(plan.label)).toBeInTheDocument();
      expect(screen.getByText(formatSoles(plan.monthlyPrice))).toBeInTheDocument();
    }
  });

  it("calcula la comisión de cada celda igual que el simulador", () => {
    render(
      <CommissionComparisonTable options={COMMISSION_OPTIONS_MOCK} isLoading={false} discountPct={10} />,
    );

    const standardPlan = PARTNER_PLAN_OPTIONS.find((plan) => plan.value === "standard")!;
    const optionA = COMMISSION_OPTIONS_MOCK.find((option) => option.code === "A")!;
    const firstMonth = estimateFirstMonthCommission(standardPlan.monthlyPrice, optionA.firstMonthPct, 10);
    const recurring = estimateRecurringCommission(standardPlan.monthlyPrice, optionA.recurringPct);

    expect(
      screen.getByText(`${formatSoles(firstMonth)} / ${formatSoles(recurring)}`),
    ).toBeInTheDocument();
  });
});
