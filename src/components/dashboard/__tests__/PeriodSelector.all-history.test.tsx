import { fireEvent, render, screen } from "@testing-library/react";
import { PeriodSelector } from "../PeriodSelector";

describe("PeriodSelector con «Todo el historial»", () => {
  it("empieza sin fechas y no impone el mes actual", () => {
    const onChange = jest.fn();
    render(<PeriodSelector allowAll value={{ from: "", to: "" }} onPeriodChange={onChange} />);

    expect(screen.getByRole("button", { name: /Todo el historial/ })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("muestra un rango abierto y permite volver a todo el historial", () => {
    const onChange = jest.fn();
    render(<PeriodSelector allowAll value={{ from: "2026-09-01", to: "" }} onPeriodChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Desde 1 de septiembre/ }));
    fireEvent.click(screen.getByRole("button", { name: "Todo el historial" }));

    expect(onChange).toHaveBeenCalledWith("", "");
  });

  it("sin la opción, las demás pantallas siguen empezando en el mes actual", () => {
    const onChange = jest.fn();
    render(<PeriodSelector onPeriodChange={onChange} />);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-01$/);
    expect(screen.queryByText("Todo el historial")).not.toBeInTheDocument();
  });
});
