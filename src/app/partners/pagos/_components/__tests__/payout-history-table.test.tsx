/**
 * Tests: PayoutHistoryTable
 *
 * Comportamiento verificado:
 * 1. Mientras isLoading es true, no renderiza tabla ni empty state.
 * 2. Con una lista vacía, muestra el EmptyState.
 * 3. Con entradas, renderiza una fila por entrada con su concepto y monto formateado.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { PayoutHistoryTable } from "../payout-history-table";
import { EMPTY_PAYOUT_HISTORY, PAYOUT_HISTORY_MOCK } from "@/features/partners/mocks/payout-history.mock";
import { formatSoles } from "@/features/partners/utils/format-currency";

jest.mock("date-fns", () => ({
  format: jest.fn(() => "25 ago 2026"),
}));

jest.mock("date-fns/locale", () => ({
  es: {},
}));

describe("PayoutHistoryTable", () => {
  it("no renderiza tabla ni empty state mientras carga", () => {
    render(<PayoutHistoryTable entries={undefined} isLoading={true} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/todavía no tenés liquidaciones/i)).not.toBeInTheDocument();
  });

  it("muestra el empty state cuando no hay entradas", () => {
    render(<PayoutHistoryTable entries={EMPTY_PAYOUT_HISTORY} isLoading={false} />);
    expect(screen.getByText(/todavía no tenés liquidaciones/i)).toBeInTheDocument();
  });

  it("renderiza una fila por entrada con su concepto y monto", () => {
    render(<PayoutHistoryTable entries={PAYOUT_HISTORY_MOCK} isLoading={false} />);
    for (const entry of PAYOUT_HISTORY_MOCK) {
      expect(screen.getByText(entry.concept)).toBeInTheDocument();
      expect(screen.getByText(formatSoles(entry.amount))).toBeInTheDocument();
    }
  });
});
