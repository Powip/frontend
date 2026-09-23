/**
 * Tests: AdminPartnersTable
 *
 * Comportamiento verificado:
 * 1. Un partner "por_aprobar" muestra el botón "Aprobar" (no "Ver ficha").
 * 2. Click en "Aprobar" llama a onApprove con el id del partner.
 * 3. Un partner "activo" muestra el link "Ver ficha" (no el botón Aprobar).
 * 4. El botón "Aprobar" del partner que se está aprobando muestra "Aprobando..." y está deshabilitado.
 * 5. Con una lista vacía, muestra el EmptyState.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPartnersTable } from "../admin-partners-table";
import { ADMIN_PARTNERS_MOCK } from "@/features/partners/mocks/admin-partners.mock";

const POR_APROBAR = ADMIN_PARTNERS_MOCK.find((p) => p.status === "por_aprobar")!;
const ACTIVO = ADMIN_PARTNERS_MOCK.find((p) => p.status === "activo")!;

describe("AdminPartnersTable", () => {
  it('un partner "por_aprobar" muestra el botón Aprobar', () => {
    render(
      <AdminPartnersTable partners={[POR_APROBAR]} isLoading={false} approvingId={null} onApprove={jest.fn()} />,
    );
    expect(screen.getByRole("button", { name: /^aprobar$/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ver ficha/i })).not.toBeInTheDocument();
  });

  it("click en Aprobar llama a onApprove con el id correcto", async () => {
    const onApprove = jest.fn();
    const user = userEvent.setup();
    render(
      <AdminPartnersTable partners={[POR_APROBAR]} isLoading={false} approvingId={null} onApprove={onApprove} />,
    );

    await user.click(screen.getByRole("button", { name: /^aprobar$/i }));
    expect(onApprove).toHaveBeenCalledWith(POR_APROBAR.id);
  });

  it('un partner "activo" muestra el link Ver ficha', () => {
    render(<AdminPartnersTable partners={[ACTIVO]} isLoading={false} approvingId={null} onApprove={jest.fn()} />);
    expect(screen.getByRole("link", { name: /ver ficha/i })).toHaveAttribute(
      "href",
      `/partners/admin/partners/${ACTIVO.id}`,
    );
  });

  it('muestra "Aprobando..." y deshabilita el botón del partner que se está aprobando', () => {
    render(
      <AdminPartnersTable
        partners={[POR_APROBAR]}
        isLoading={false}
        approvingId={POR_APROBAR.id}
        onApprove={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /aprobando/i })).toBeDisabled();
  });

  it("muestra el empty state con una lista vacía", () => {
    render(<AdminPartnersTable partners={[]} isLoading={false} approvingId={null} onApprove={jest.fn()} />);
    expect(screen.getByText(/todavía no hay partners/i)).toBeInTheDocument();
  });
});
