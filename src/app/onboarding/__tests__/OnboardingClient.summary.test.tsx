/**
 * Tests: resúmenes del onboarding (app/onboarding/OnboardingClient.tsx)
 *
 * Comportamiento verificado:
 * 1. Paso Plan: la descripción y las tarjetas muestran el precio del catálogo y
 *    el total se actualiza con cero, uno y varios add-ons.
 * 2. Paso Pago: el panel lateral muestra plan, add-ons y total, igual que el
 *    resumen principal; sin add-ons muestra solo plan y total.
 * 3. Volver al paso Plan conserva la selección y el cambio se refleja al
 *    regresar al paso Pago.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import OnboardingClient from "../OnboardingClient";
import { fetchAddOns, fetchPlans } from "@/services/onboardingService";
import type { BackendAddOn, BackendPlan } from "@/types/onboarding";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "token" },
    login: jest.fn(),
    refreshSession: jest.fn(),
  }),
}));

jest.mock("@/services/onboardingService", () => ({
  fetchAddOns: jest.fn(),
  fetchPlans: jest.fn(),
}));

jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const addOn = (id: string, code: string, name: string): BackendAddOn => ({
  id,
  code,
  name,
  amount: 29,
  annualAmount: 348,
  currency: "PEN",
});

const catalog = [
  addOn("c", "courier", "Integración Courier"),
  addOn("m", "marketplace", "Integración Marketplace"),
  addOn("s", "sunat", "Integración SUNAT"),
];

const plans: BackendPlan[] = [
  { id: "basic", name: "Basic", price: 99, durationInDays: 30 },
  { id: "medium", name: "Medium", price: 189, durationInDays: 30 },
];

const sidePanel = () => screen.getByRole("region", { name: "Resumen de tu suscripción" });
const toggle = (name: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
const goToPayment = () => fireEvent.click(screen.getByRole("button", { name: /^Continuar/ }));
const backToPlan = () => fireEvent.click(screen.getByRole("button", { name: /Volver a add-ons/ }));

async function renderAtPlanStep() {
  render(<OnboardingClient planName="Medium" initialAuth={{ userId: "u1" }} />);
  await screen.findByRole("button", { name: /Integración Courier/ });
  await waitFor(() => expect(screen.getByText("Plan S/189")).toBeInTheDocument());
}

describe("OnboardingClient — resúmenes", () => {
  beforeEach(() => {
    (fetchAddOns as jest.Mock).mockResolvedValue(catalog);
    (fetchPlans as jest.Mock).mockResolvedValue(plans);
  });

  it("calcula el total del paso Plan con cero, uno y varios add-ons", async () => {
    await renderAtPlanStep();

    expect(screen.getByText(/^S\/ 29\/mes cada uno/)).toBeInTheDocument();
    expect(screen.getAllByText("+ S/ 29/mes")).toHaveLength(3);
    expect(screen.getByText("S/ 189/mes")).toBeInTheDocument();

    toggle("Integración Courier");
    expect(screen.getByText("Plan S/189 + Add-ons S/29")).toBeInTheDocument();
    expect(screen.getByText("S/ 218/mes")).toBeInTheDocument();

    toggle("Integración Marketplace");
    toggle("Integración SUNAT");
    expect(screen.getByText("Plan S/189 + Add-ons S/87")).toBeInTheDocument();
    expect(screen.getByText("S/ 276/mes")).toBeInTheDocument();
  });

  it("sin add-ons, el panel lateral del paso Pago muestra solo plan y total", async () => {
    await renderAtPlanStep();
    goToPayment();

    const panel = sidePanel();
    expect(within(panel).getByText("Plan Medium")).toBeInTheDocument();
    expect(within(panel).getByText("Total mensual")).toBeInTheDocument();
    expect(within(panel).getAllByRole("term")).toHaveLength(2);
    expect(within(panel).getAllByText("S/ 189/mes")).toHaveLength(2);
  });

  it("sincroniza ambos resúmenes y conserva la selección al volver", async () => {
    await renderAtPlanStep();
    toggle("Integración Courier");
    goToPayment();

    // Resumen principal y panel lateral: mismo add-on y mismo total.
    expect(within(sidePanel()).getByText("Integración Courier")).toBeInTheDocument();
    expect(within(sidePanel()).getByText("+S/ 29/mes")).toBeInTheDocument();
    expect(within(sidePanel()).getByText("S/ 218/mes")).toBeInTheDocument();
    expect(screen.getAllByText("S/ 218/mes")).toHaveLength(2);
    expect(screen.getAllByText("+S/ 29/mes")).toHaveLength(2);

    backToPlan();
    expect(screen.getByRole("button", { name: /Integración Courier/ })).toHaveStyle({
      borderColor: "#4F3A96",
    });
    expect(screen.getByText("S/ 218/mes")).toBeInTheDocument();

    toggle("Integración SUNAT");
    goToPayment();

    const panel = sidePanel();
    expect(within(panel).getByText("Integración Courier")).toBeInTheDocument();
    expect(within(panel).getByText("Integración SUNAT")).toBeInTheDocument();
    expect(within(panel).getByText("S/ 247/mes")).toBeInTheDocument();
    expect(screen.getAllByText("S/ 247/mes")).toHaveLength(2);
  });
});
