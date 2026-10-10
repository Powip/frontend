/**
 * Tests: CommissionStatusBadge
 *
 * Comportamiento verificado:
 * 1. Muestra la etiqueta correcta para cada CommissionLineStatus.
 * 2. Cada estado tiene una etiqueta de texto distinta (no depende solo del color).
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { CommissionStatusBadge } from "../commission-status-badge";
import type { CommissionLineStatus } from "@/features/partners/models/commission-line";

describe("CommissionStatusBadge", () => {
  const cases: [CommissionLineStatus, string][] = [
    ["activa", "Activa"],
    ["pendiente", "Pendiente"],
    ["reverso", "Reverso"],
  ];

  test.each(cases)('estado "%s" muestra la etiqueta "%s"', (status, label) => {
    render(<CommissionStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("cada estado tiene una etiqueta distinta", () => {
    const labels = cases.map(([, label]) => label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
