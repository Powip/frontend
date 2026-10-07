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
import { ADMIN_PARTNERS_MOCK } from "@/features/partners/mocks/admin-partners.mock";

const POR_APROBAR = ADMIN_PARTNERS_MOCK.find((p) => p.status === "por_aprobar")!;
const ACTIVO = ADMIN_PARTNERS_MOCK.find((p) => p.status === "activo")!;

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
});
