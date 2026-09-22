/**
 * Tests: ReferralsTable
 *
 * Comportamiento verificado:
 * 1. Mientras isLoading es true, no renderiza tabla ni empty state.
 * 2. Si el partner no tiene ningún referido (hasAnyReferral=false), muestra el EmptyState
 *    con acción "Registrar referido" que dispara onRegisterReferral.
 * 3. Si hay referidos pero el filtro no matchea a ninguno, muestra el mensaje de filtro vacío
 *    (no el EmptyState general).
 * 4. Con referidos, renderiza una fila por referido y el click en la fila llama a onSelectReferral
 *    con el referido correcto.
 * 5. Presionar Enter sobre una fila también llama a onSelectReferral (accesible por teclado).
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReferralsTable } from "../referrals-table";
import type { PartnerReferral } from "@/features/partners/models/partner-referral";

jest.mock("date-fns", () => ({
  format: jest.fn(() => "01 ago"),
}));

jest.mock("date-fns/locale", () => ({
  es: {},
}));

const REFERRAL: PartnerReferral = {
  id: "ref-1",
  businessName: "Zapatería Andes",
  origin: "link",
  status: "en_revision",
  registeredAt: "2026-08-09",
  planName: null,
  firstMonthCommission: null,
  recurringCommission: null,
};

describe("ReferralsTable", () => {
  const noop = () => {};

  it("no renderiza tabla mientras carga", () => {
    render(
      <ReferralsTable
        referrals={undefined}
        isLoading={true}
        hasAnyReferral={false}
        onSelectReferral={noop}
        onRegisterReferral={noop}
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra el empty state general cuando el partner no tiene ningún referido", async () => {
    const onRegisterReferral = jest.fn();
    const user = userEvent.setup();

    render(
      <ReferralsTable
        referrals={[]}
        isLoading={false}
        hasAnyReferral={false}
        onSelectReferral={noop}
        onRegisterReferral={onRegisterReferral}
      />,
    );

    expect(screen.getByText(/todavía no tenés referidos/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /registrar referido/i }));
    expect(onRegisterReferral).toHaveBeenCalledTimes(1);
  });

  it("muestra el mensaje de filtro vacío cuando hay referidos pero el filtro no matchea", () => {
    render(
      <ReferralsTable
        referrals={[]}
        isLoading={false}
        hasAnyReferral={true}
        onSelectReferral={noop}
        onRegisterReferral={noop}
      />,
    );

    expect(screen.getByText(/no hay referidos en este filtro/i)).toBeInTheDocument();
    expect(screen.queryByText(/todavía no tenés referidos/i)).not.toBeInTheDocument();
  });

  it("el click en una fila llama a onSelectReferral con el referido correcto", async () => {
    const onSelectReferral = jest.fn();
    const user = userEvent.setup();

    render(
      <ReferralsTable
        referrals={[REFERRAL]}
        isLoading={false}
        hasAnyReferral={true}
        onSelectReferral={onSelectReferral}
        onRegisterReferral={noop}
      />,
    );

    await user.click(screen.getByText("Zapatería Andes"));
    expect(onSelectReferral).toHaveBeenCalledWith(REFERRAL);
  });

  it("Enter sobre una fila también llama a onSelectReferral", async () => {
    const onSelectReferral = jest.fn();
    const user = userEvent.setup();

    render(
      <ReferralsTable
        referrals={[REFERRAL]}
        isLoading={false}
        hasAnyReferral={true}
        onSelectReferral={onSelectReferral}
        onRegisterReferral={noop}
      />,
    );

    const row = screen.getByText("Zapatería Andes").closest("tr")!;
    row.focus();
    await user.keyboard("{Enter}");
    expect(onSelectReferral).toHaveBeenCalledWith(REFERRAL);
  });
});
