/**
 * Tests: RecentReferralsTable
 *
 * Comportamiento verificado:
 * 1. Mientras isLoading es true, no renderiza la tabla ni el empty state.
 * 2. Con una lista vacía, muestra el EmptyState con su título.
 * 3. Con referidos, renderiza una fila por referido con su nombre de negocio.
 * 4. Con referidos, muestra "—" para las comisiones que son null (aún no generadas).
 * 5. Con referidos, formatea las comisiones numéricas en soles.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { RecentReferralsTable } from "../recent-referrals-table";
import { EMPTY_PARTNER_REFERRALS, PARTNER_REFERRALS_MOCK } from "@/features/partners/mocks/partner-referrals.mock";

jest.mock("date-fns", () => ({
  format: jest.fn(() => "01 ago"),
}));

jest.mock("date-fns/locale", () => ({
  es: {},
}));

describe("RecentReferralsTable", () => {
  it("no renderiza tabla ni empty state mientras carga", () => {
    render(<RecentReferralsTable referrals={undefined} isLoading={true} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/todavía no tenés referidos/i)).not.toBeInTheDocument();
  });

  it("muestra el empty state cuando no hay referidos", () => {
    render(<RecentReferralsTable referrals={EMPTY_PARTNER_REFERRALS} isLoading={false} />);
    expect(screen.getByText(/todavía no tenés referidos/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renderiza una fila por referido con su nombre de negocio", () => {
    render(<RecentReferralsTable referrals={PARTNER_REFERRALS_MOCK} isLoading={false} />);
    for (const referral of PARTNER_REFERRALS_MOCK) {
      expect(screen.getByText(referral.businessName)).toBeInTheDocument();
    }
  });

  it('muestra "—" cuando la comisión es null', () => {
    const referralSinComision = PARTNER_REFERRALS_MOCK.find(
      (referral) => referral.firstMonthCommission === null,
    );
    expect(referralSinComision).toBeDefined();

    render(<RecentReferralsTable referrals={[referralSinComision!]} isLoading={false} />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("formatea la comisión numérica en soles", () => {
    const referralConComision = PARTNER_REFERRALS_MOCK.find(
      (referral) => referral.firstMonthCommission === 68.04,
    );
    expect(referralConComision).toBeDefined();

    render(<RecentReferralsTable referrals={[referralConComision!]} isLoading={false} />);
    expect(screen.getByText("S/ 68.04")).toBeInTheDocument();
  });
});
