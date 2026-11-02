import { fireEvent, render, screen } from "@testing-library/react";
import { RegistrarLiquidacionModal } from "../RegistrarLiquidacionModal";
import type { GuiaPorLiquidar } from "../types";

it("cannot register a grouped deposit when any order balance is unknown", () => {
  const onRegistrar = jest.fn();
  const rows = [100, Number.NaN].map((saldoPendiente, i) => ({ id: `ORD-${i}`, courier: "Shalom", saldoPendiente, codNeto: saldoPendiente })) as GuiaPorLiquidar[];
  render(<RegistrarLiquidacionModal open onOpenChange={jest.fn()} guias={rows} onRegistrar={onRegistrar} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Verifica el saldo");
  const submit = screen.getByRole("button", { name: "Registrar liquidación" });
  expect(submit).toBeDisabled();
  fireEvent.click(submit);
  expect(onRegistrar).not.toHaveBeenCalled();
});
