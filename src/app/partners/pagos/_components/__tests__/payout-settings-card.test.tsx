/**
 * Tests: PayoutSettingsCard
 *
 * Comportamiento verificado:
 * 1. Mientras carga, muestra skeletons y el botón de editar deshabilitado.
 * 2. Con datos, muestra el método (etiqueta legible), el número/cuenta y el titular.
 * 3. El botón "Editar datos de cobro" llama a onEdit.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PayoutSettingsCard } from "../payout-settings-card";
import type { PayoutSettings } from "@/features/partners/models/payout-settings";

const SETTINGS: PayoutSettings = {
  method: "yape",
  accountNumber: "987 654 321",
  accountHolder: "Joel Coila",
  minimumThreshold: 50,
};

describe("PayoutSettingsCard", () => {
  it("deshabilita el botón de editar mientras carga", () => {
    render(<PayoutSettingsCard settings={undefined} isLoading={true} onEdit={jest.fn()} />);
    expect(screen.getByRole("button", { name: /editar datos de cobro/i })).toBeDisabled();
  });

  it("muestra el método, el número/cuenta y el titular", () => {
    render(<PayoutSettingsCard settings={SETTINGS} isLoading={false} onEdit={jest.fn()} />);
    expect(screen.getByText(/yape/i)).toBeInTheDocument();
    expect(screen.getByText(/987 654 321/)).toBeInTheDocument();
    expect(screen.getByText(/joel coila/i)).toBeInTheDocument();
  });

  it("el botón de editar llama a onEdit", async () => {
    const onEdit = jest.fn();
    const user = userEvent.setup();

    render(<PayoutSettingsCard settings={SETTINGS} isLoading={false} onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: /editar datos de cobro/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
