import { fireEvent, render, screen } from "@testing-library/react";
import PlanPicker from "../PlanPicker";
import type { BackendPlan } from "@/types/onboarding";

const plans: BackendPlan[] = [
  { id: "m1", name: "Basic", price: 99, durationInDays: 30 },
  { id: "m2", name: "Medium", price: 189, durationInDays: 30 },
  { id: "s1", name: "Scale", price: 269, durationInDays: 30 },
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
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.queryByText("Basic Anual")).not.toBeInTheDocument();
  });

  it("Medium y Scale se muestran como Standard y Full, sin cambiar el plan que se elige", () => {
    const { onSelect } = setup();
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.queryByText("Medium")).not.toBeInTheDocument();
    expect(screen.queryByText("Scale")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Full/ }));
    expect(onSelect).toHaveBeenCalledWith(plans[2]);
  });

  it("cada tarjeta muestra el límite de pedidos y todas las características", () => {
    setup();
    expect(screen.getByText("Hasta 1,000 pedidos/mes")).toBeInTheDocument();
    expect(screen.getByText("Hasta 2,000 pedidos/mes")).toBeInTheDocument();
    expect(screen.getByText("Hasta 6,000 pedidos/mes")).toBeInTheDocument();
    expect(screen.getAllByText("Soporte por chat")).toHaveLength(3);
    expect(screen.getAllByText("Automatización de envíos")).toHaveLength(3);
  });

  it("el título invita a empezar y aclara que solo cambia el volumen de pedidos", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Elige tu plan y empieza hoy", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Todos los planes incluyen lo mismo, solo cambia el volumen de pedidos."),
    ).toBeInTheDocument();
  });

  it("anual muestra los planes anuales con el nombre base", () => {
    setup({ isAnnual: true });
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("S/ 799")).toBeInTheDocument();
    expect(screen.queryByText("Standard")).not.toBeInTheDocument();
  });

  it("elegir una tarjeta avisa el plan", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Standard/ }));
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
    expect(screen.getByRole("button", { name: /Standard/ })).toHaveAttribute("aria-pressed", "false");
  });
});
