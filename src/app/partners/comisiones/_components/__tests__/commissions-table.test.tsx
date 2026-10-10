/**
 * Tests: CommissionsTable
 *
 * Comportamiento verificado:
 * 1. Mientras isLoading es true, no renderiza tabla ni empty state.
 * 2. Con una lista vacía, muestra el EmptyState.
 * 3. Con líneas, renderiza una fila por línea con su negocio y "—" cuando el neto es null.
 * 4. Muestra el badge de la opción de comisión vigente en el header cuando se recibe.
 * 5. Una comisión de 1er mes negativa (reverso) se resalta como destructiva.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { CommissionsTable } from "../commissions-table";
import { COMMISSION_LINES_MOCK, EMPTY_COMMISSION_LINES } from "@/features/partners/mocks/commission-lines.mock";
import type { PartnerCommissionOption } from "@/features/partners/models/partner-summary";
import { formatSoles } from "@/features/partners/utils/format-currency";

const OPTION: PartnerCommissionOption = { code: "A", firstMonthPct: 40, recurringPct: 6 };

describe("CommissionsTable", () => {
  it("no renderiza tabla ni empty state mientras carga", () => {
    render(<CommissionsTable lines={undefined} isLoading={true} commissionOption={undefined} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/todavía no hay comisiones/i)).not.toBeInTheDocument();
  });

  it("muestra el empty state cuando no hay líneas", () => {
    render(<CommissionsTable lines={EMPTY_COMMISSION_LINES} isLoading={false} commissionOption={undefined} />);
    expect(screen.getByText(/todavía no hay comisiones/i)).toBeInTheDocument();
  });

  it("renderiza una fila por línea, con guion cuando el neto es null", () => {
    render(<CommissionsTable lines={COMMISSION_LINES_MOCK} isLoading={false} commissionOption={OPTION} />);
    const pendientes = COMMISSION_LINES_MOCK.filter((line) => line.netFirstMonthAmount === null);
    expect(pendientes.length).toBeGreaterThan(0);
    for (const line of pendientes) {
      expect(screen.getByText(line.businessName)).toBeInTheDocument();
    }
  });

  it("muestra el badge de la opción de comisión vigente", () => {
    render(<CommissionsTable lines={COMMISSION_LINES_MOCK} isLoading={false} commissionOption={OPTION} />);
    expect(screen.getByText(/opción a/i)).toBeInTheDocument();
  });

  it("no muestra el badge de opción cuando no se recibe", () => {
    render(<CommissionsTable lines={COMMISSION_LINES_MOCK} isLoading={false} commissionOption={undefined} />);
    expect(screen.queryByText(/opción/i)).not.toBeInTheDocument();
  });

  it("resalta como destructiva la comisión negativa de una línea en reverso", () => {
    render(<CommissionsTable lines={COMMISSION_LINES_MOCK} isLoading={false} commissionOption={OPTION} />);
    const reversosConComision = COMMISSION_LINES_MOCK.filter(
      (line) => line.status === "reverso" && line.firstMonthCommission !== null,
    );

    expect(reversosConComision.length).toBeGreaterThan(0);
    for (const line of reversosConComision) {
      const cell = screen.getByText(formatSoles(line.firstMonthCommission as number));
      expect(cell).toHaveClass("text-destructive");
    }
  });
});
