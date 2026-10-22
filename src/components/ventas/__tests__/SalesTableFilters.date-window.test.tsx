import { render, screen, fireEvent } from "@testing-library/react";
import { SalesTableFilters, emptySalesFilters } from "../SalesTableFilters";

const today = "2026-10-20";
const defaultFromDate = "2026-09-21";

function setup(withWindow = true, value = { fromDate: "2026-10-01", toDate: "2026-10-10" }) {
  const onFiltersChange = jest.fn();
  const onChange = jest.fn();
  render(
    <SalesTableFilters
      filters={emptySalesFilters}
      onFiltersChange={onFiltersChange}
      dateWindow={
        withWindow ? { value, today, defaultFromDate, onChange } : undefined
      }
    />
  );
  return { onFiltersChange, onChange };
}

describe("SalesTableFilters - control de período", () => {
  it.each([
    ["7 días", "2026-10-14"],
    ["15 días", "2026-10-06"],
    ["30 días", "2026-09-21"],
  ])("atajo %s", (label, from) => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(onChange).toHaveBeenCalledWith({ fromDate: from, toDate: "" });
  });

  it("vaciar Desde vuelve al default y conserva Hasta", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({
      fromDate: defaultFromDate,
      toDate: "2026-10-10",
    });
  });

  it("cambiar Hasta conserva Desde", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-01" } });
    expect(onChange).toHaveBeenCalledWith({ fromDate: "2026-10-01", toDate: "2026-10-01" });
  });

  it("con dateWindow el panel no muestra Fecha Desde", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.queryByText("Fecha Desde")).toBeNull();
  });

  it("sin dateWindow el panel sí muestra Fecha Desde y no hay atajos", () => {
    setup(false);
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.getByText("Fecha Desde")).toBeInTheDocument();
    expect(screen.queryByText("7 días")).toBeNull();
  });

  it("Limpiar no toca dateWindow", () => {
    const onFiltersChange = jest.fn();
    const onChange = jest.fn();
    render(
      <SalesTableFilters
        filters={{ ...emptySalesFilters, search: "x" }}
        onFiltersChange={onFiltersChange}
        dateWindow={{ value: { fromDate: "2026-10-01", toDate: "" }, today, defaultFromDate, onChange }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Limpiar/ }));
    expect(onFiltersChange).toHaveBeenCalledWith(emptySalesFilters);
    expect(onChange).not.toHaveBeenCalled();
  });
});
