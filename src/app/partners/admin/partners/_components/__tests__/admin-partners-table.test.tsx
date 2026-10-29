/**
 * Tests: AdminPartnersTable
 *
 * Comportamiento verificado:
 * 1. Un partner simulado "por_aprobar" no ofrece aprobar: la aprobación real usa solicitudes.
 * 2. Un partner "activo" muestra el link "Ver ficha".
 * 3. Con una lista vacía, muestra el EmptyState.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { AdminPartnersTable } from "../admin-partners-table";
import { buildAdminPartner } from "@/features/partners/test-utils/admin-partners.fixture";

const POR_APROBAR = buildAdminPartner({ status: "APPLIED", referralCode: null, activatedAt: null });
const ACTIVO = buildAdminPartner();

describe("AdminPartnersTable", () => {
  it('un partner simulado "por_aprobar" no muestra el botón Aprobar', () => {
    render(<AdminPartnersTable partners={[POR_APROBAR]} isLoading={false} />);
    expect(screen.queryByRole("button", { name: /aprobar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver ficha/i })).toHaveAttribute(
      "href",
      `/partners/admin/partners/${POR_APROBAR.id}`,
    );
  });

  it('un partner "activo" muestra el link Ver ficha', () => {
    render(<AdminPartnersTable partners={[ACTIVO]} isLoading={false} />);
    expect(screen.getByRole("link", { name: /ver ficha/i })).toHaveAttribute(
      "href",
      `/partners/admin/partners/${ACTIVO.id}`,
    );
  });

  it("muestra el empty state con una lista vacía", () => {
    render(<AdminPartnersTable partners={[]} isLoading={false} />);
    expect(screen.getByText(/todavía no hay partners/i)).toBeInTheDocument();
  });

  it.each(["ACTIVE", "SUSPENDED", "APPLIED", "REJECTED"] as const)("renders persisted status %s without invented tiers or finances", (status) => {
    render(<AdminPartnersTable partners={[buildAdminPartner({ status })]} isLoading={false} />);
    expect(screen.getByText("Referidos manuales")).toBeInTheDocument();
    expect(screen.getByText("Atribuciones LINK")).toBeInTheDocument();
    expect(screen.queryByText(/Bronce|Oro|Plata|MRR|S\//i)).not.toBeInTheDocument();
  });
});
