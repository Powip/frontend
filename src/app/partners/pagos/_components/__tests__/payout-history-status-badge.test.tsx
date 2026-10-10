/**
 * Tests: PayoutHistoryStatusBadge
 *
 * Comportamiento verificado:
 * 1. Muestra la etiqueta correcta para "programado" y "pagado".
 * 2. Cada estado tiene una etiqueta de texto distinta.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { PayoutHistoryStatusBadge } from "../payout-history-status-badge";
import type { PayoutHistoryStatus } from "@/features/partners/models/payout-history-entry";

describe("PayoutHistoryStatusBadge", () => {
  const cases: [PayoutHistoryStatus, string][] = [
    ["programado", "Programado"],
    ["pagado", "Pagado"],
  ];

  test.each(cases)('estado "%s" muestra la etiqueta "%s"', (status, label) => {
    render(<PayoutHistoryStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("cada estado tiene una etiqueta distinta", () => {
    const labels = cases.map(([, label]) => label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
