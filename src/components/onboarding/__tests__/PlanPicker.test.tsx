import { fireEvent, render, screen } from "@testing-library/react";
import PlanPicker from "../PlanPicker";
import type { BackendPlan } from "@/types/onboarding";

const plans: BackendPlan[] = [
  { id: "m1", name: "Basic", price: 99, durationInDays: 30 },
  { id: "m2", name: "Medium", price: 149, durationInDays: 30 },
  { id: "e", name: "Enterprise", price: 0, durationInDays: 30 },
  { id: "a1", name: "Basic Anual", price: 799, durationInDays: 365 },
];

function setup(props: Partial<React.ComponentProps<typeof PlanPicker>> = {}) {
  const handlers = { onSelect: jest.fn(), onCycleChange: jest.fn(), onEnterprise: jest.fn() };
  render(<PlanPicker plans={plans} selectedPlanId="" isAnnual={false} {...handlers} {...props} />);
  return handlers;
}

describe("PlanPicker", () => {
  it("muestra solo los planes del ciclo elegido", () => {
    setup();
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.queryByText("Basic Anual")).not.toBeInTheDocument();
  });

  it("anual muestra los planes anuales con el nombre base", () => {
    setup({ isAnnual: true });
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("S/ 799")).toBeInTheDocument();
    expect(screen.queryByText("Medium")).not.toBeInTheDocument();
  });

  it("elegir una tarjeta avisa el plan", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Medium/ }));
    expect(onSelect).toHaveBeenCalledWith(plans[1]);
  });

  it("Enterprise va a ventas en vez de seleccionarse", () => {
    const { onSelect, onEnterprise } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Enterprise/ }));
    expect(onEnterprise).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("el toggle cambia de ciclo", () => {
    const { onCycleChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Anual" }));
    expect(onCycleChange).toHaveBeenCalledWith(true);
  });

  it("marca el plan seleccionado", () => {
    setup({ selectedPlanId: "m1" });
    expect(screen.getByRole("button", { name: /Basic/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Medium/ })).toHaveAttribute("aria-pressed", "false");
  });
});
