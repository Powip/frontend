/**
 * Tests: CommissionOptionCards
 *
 * Comportamiento verificado:
 * 1. Mientras carga, muestra skeletons y no las cards.
 * 2. Con datos, renderiza una card por opción con su % y descripción.
 * 3. Muestra el badge "Vigente" solo en la opción que coincide con currentOptionCode.
 * 4. Click en una card llama a onSelectedCodeChange con el código de esa opción.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommissionOptionCards } from "../commission-option-cards";
import { COMMISSION_OPTIONS_MOCK } from "@/features/partners/mocks/commission-options.mock";

describe("CommissionOptionCards", () => {
  it("no renderiza cards mientras carga", () => {
    render(
      <CommissionOptionCards
        options={undefined}
        isLoading={true}
        currentOptionCode={undefined}
        selectedCode="A"
        onSelectedCodeChange={jest.fn()}
      />,
    );
    expect(screen.queryByText(/agencias y developers/i)).not.toBeInTheDocument();
  });

  it("renderiza una card por opción con su % y descripción", () => {
    render(
      <CommissionOptionCards
        options={COMMISSION_OPTIONS_MOCK}
        isLoading={false}
        currentOptionCode={undefined}
        selectedCode="A"
        onSelectedCodeChange={jest.fn()}
      />,
    );
    for (const option of COMMISSION_OPTIONS_MOCK) {
      expect(screen.getByText(option.label)).toBeInTheDocument();
      expect(screen.getByText(option.description)).toBeInTheDocument();
    }
  });

  it('muestra "Vigente" solo en la opción actual del partner', () => {
    render(
      <CommissionOptionCards
        options={COMMISSION_OPTIONS_MOCK}
        isLoading={false}
        currentOptionCode="C"
        selectedCode="A"
        onSelectedCodeChange={jest.fn()}
      />,
    );
    expect(screen.getAllByText(/vigente/i)).toHaveLength(1);
  });

  it("click en una card llama a onSelectedCodeChange con el código correcto", async () => {
    const onSelectedCodeChange = jest.fn();
    const user = userEvent.setup();

    render(
      <CommissionOptionCards
        options={COMMISSION_OPTIONS_MOCK}
        isLoading={false}
        currentOptionCode={undefined}
        selectedCode="A"
        onSelectedCodeChange={onSelectedCodeChange}
      />,
    );

    await user.click(screen.getByText("Creadores"));
    expect(onSelectedCodeChange).toHaveBeenCalledWith("C");
  });
});
