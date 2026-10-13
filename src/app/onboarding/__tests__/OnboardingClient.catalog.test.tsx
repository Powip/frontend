import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingFlow } from "@/hooks/useOnboardingFlow";
import * as onboardingService from "@/services/onboardingService";
import type { BackendAddOn, BackendPlan, SubscriptionMe } from "@/types/onboarding";
import OnboardingClient from "../OnboardingClient";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/useOnboardingFlow", () => ({ useOnboardingFlow: jest.fn() }));
jest.mock("@/services/onboardingService", () => ({
  fetchPlans: jest.fn(),
  fetchAddOns: jest.fn(),
  registerAccount: jest.fn(),
  loginAccount: jest.fn(),
  startFlowCheckout: jest.fn(),
  confirmFlowCheckout: jest.fn(),
  fetchMySubscription: jest.fn(),
  apiErrorCode: jest.fn(),
}));
jest.mock("@/components/onboarding/FlowWidgetStep", () => ({
  __esModule: true,
  default: ({ token, onSuccess }: { token: string; onSuccess: () => void }) => (
    <>
      <p>Tarjeta de prueba: {token}</p>
      <button type="button" onClick={onSuccess}>
        Confirmar tarjeta de prueba
      </button>
    </>
  ),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const USER = "catalog-fixture-user";
const plans: BackendPlan[] = [
  { id: "basic", name: "Basic", price: 99, durationInDays: 30 },
  { id: "medium", name: "Medium", price: 189, durationInDays: 30 },
];
const courier: BackendAddOn = {
  id: "courier-addon",
  code: "courier",
  name: "Integración Courier",
  amount: 29,
  annualAmount: 348,
  currency: "PEN",
};
const service = jest.mocked(onboardingService);
const mockedFlow = jest.mocked(useOnboardingFlow);

function currentFlow() {
  const result = mockedFlow.mock.results[mockedFlow.mock.results.length - 1];
  if (result?.type !== "return") throw new Error("Falta el estado del flujo");
  return result.value as ReturnType<typeof useOnboardingFlow>;
}

function currentProgressStep() {
  return screen
    .getByRole("navigation", { name: "Progreso de la suscripción" })
    .querySelector('[aria-current="step"]');
}

async function renderAtPlanStep() {
  render(<OnboardingClient planName="Basic" initialAuth={{ userId: USER }} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Continuar al pago" })).toBeEnabled(),
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "catalog-fixture-token", user: { id: USER } },
    login: jest.fn(),
    refreshSession: jest.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useAuth>);
  // Keep the real state transitions while observing them through the mocked boundary.
  mockedFlow.mockImplementation(
    jest.requireActual<typeof import("@/hooks/useOnboardingFlow")>("@/hooks/useOnboardingFlow")
      .useOnboardingFlow,
  );
  service.fetchPlans.mockResolvedValue(plans);
  service.fetchAddOns.mockResolvedValue([courier]);
  service.fetchMySubscription.mockResolvedValue(null);
  service.startFlowCheckout.mockResolvedValue({
    subscriptionId: "catalog-fixture-checkout",
    status: "PENDING_PAYMENT",
    redirectUrl: "https://flow.fixture.invalid/card",
    cardToken: "catalog-fixture-card-token",
  });
});

it("conserva el paso Plan cuando falla el catálogo y recupera los planes al reintentar", async () => {
  service.fetchPlans.mockRejectedValueOnce(new Error("fixture network failure"));
  render(<OnboardingClient planName="Basic" initialAuth={{ userId: USER }} />);

  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los planes");
  expect(currentFlow().state.step).toBe("ADDONS");
  expect(currentProgressStep()).toHaveTextContent("Plan");
  expect(screen.getByRole("button", { name: "Elige un plan para continuar" })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Reintentar carga de planes" }));

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Continuar al pago" })).toBeEnabled(),
  );
  expect(service.fetchPlans).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(currentFlow().state.step).toBe("ADDONS");
  expect(currentFlow().state.planId).toBe("basic");
  expect(service.startFlowCheckout).not.toHaveBeenCalled();
});

it("muestra el error de add-ons y permite continuar sin ellos", async () => {
  service.fetchAddOns.mockRejectedValueOnce(new Error("fixture add-ons failure"));
  await renderAtPlanStep();

  expect(screen.getByRole("alert")).toHaveTextContent(
    "No pudimos cargar los add-ons. Puedes omitirlos y activarlos después.",
  );
  expect(screen.getByRole("button", { name: "Reintentar carga de add-ons" })).toBeEnabled();
  expect(currentFlow().state.step).toBe("ADDONS");
  const skip = screen.getByRole("button", { name: /^Omitir por ahora/ });
  expect(skip).toBeEnabled();
  fireEvent.click(skip);

  expect(screen.getByRole("heading", { name: "Resumen de tu suscripción" })).toBeInTheDocument();
  expect(currentFlow().state.step).toBe("CARD_REDIRECT");
  expect(currentFlow().state.addOnIds).toEqual([]);
});

it("Omitir vacía los add-ons seleccionados y el checkout no envía sus IDs", async () => {
  await renderAtPlanStep();
  fireEvent.click(screen.getByRole("button", { name: /Integración Courier/ }));
  expect(screen.getByRole("button", { name: "Continuar con 1 add-on" })).toBeEnabled();
  expect(screen.getByText("Plan S/99 + Add-ons S/29")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /^Omitir por ahora/ }));
  expect(currentFlow().state.addOnIds).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: /Registrar.*tarjeta/i }));

  await screen.findByText("Tarjeta de prueba: catalog-fixture-card-token");
  expect(service.startFlowCheckout).toHaveBeenCalledTimes(1);
  expect(service.startFlowCheckout).toHaveBeenCalledWith("basic", []);
});

it("un catálogo tardío no sustituye el plan ni la tarjeta de un checkout recuperado", async () => {
  let resolvePlans: (value: BackendPlan[]) => void = () => {};
  const pendingPlans = new Promise<BackendPlan[]>((resolve) => {
    resolvePlans = resolve;
  });
  service.fetchPlans.mockReturnValueOnce(pendingPlans);
  render(<OnboardingClient planName="Medium" initialAuth={{ userId: USER }} />);
  expect(currentFlow().state.step).toBe("ADDONS");

  act(() =>
    currentFlow().restoreFromStorage({
      planId: "restored-basic",
      planName: "Basic",
      price: 111,
      addOnIds: [courier.id],
      userId: USER,
      cardToken: "restored-card-token",
    }),
  );
  expect(screen.getByText("Tarjeta de prueba: restored-card-token")).toBeInTheDocument();

  await act(async () => {
    resolvePlans(plans);
    await pendingPlans;
  });

  expect(currentFlow().state).toMatchObject({
    step: "CARD_WIDGET",
    planId: "restored-basic",
    planName: "Basic",
    price: 111,
    addOnIds: [courier.id],
    cardToken: "restored-card-token",
  });
  expect(screen.getByText("Tarjeta de prueba: restored-card-token")).toBeInTheDocument();
  expect(service.startFlowCheckout).not.toHaveBeenCalled();
});

it("el comprobante toma nombre, precio y período de la suscripción confirmada", async () => {
  const subscription: SubscriptionMe = {
    id: "confirmed-receipt",
    status: "ACTIVE",
    gateway: "FLOW",
    autoRenewal: true,
    startDate: "2026-10-13T12:00:00Z",
    endDate: "2027-10-13T12:00:00Z",
    plan: { id: "premium-annual", name: "Premium Anual", price: 1425, durationInDays: 365 },
    addOns: [{ code: "sunat", name: "SUNAT confirmada", amount: 348 }],
  };
  service.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription });
  await renderAtPlanStep();
  fireEvent.click(screen.getByRole("button", { name: "Continuar al pago" }));
  fireEvent.click(screen.getByRole("button", { name: /Registrar.*tarjeta/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar tarjeta de prueba" }));

  const title = await screen.findByText("Comprobante de suscripción");
  const receipt = title.parentElement?.parentElement;
  if (!receipt) throw new Error("Falta el comprobante de suscripción");
  expect(within(receipt).getByText("Plan Premium Anual")).toBeInTheDocument();
  expect(within(receipt).getByText("S/ 1425/año")).toBeInTheDocument();
  expect(within(receipt).getByText(/2026.*→.*2027/)).toBeInTheDocument();
  expect(within(receipt).getByText("SUNAT confirmada")).toBeInTheDocument();
  expect(within(receipt).queryByText("Plan Basic")).not.toBeInTheDocument();
  expect(within(receipt).queryByText("S/ 99/mes")).not.toBeInTheDocument();
  expect(currentFlow().state.step).toBe("DONE");
  expect(service.confirmFlowCheckout).toHaveBeenCalledWith("catalog-fixture-card-token");
});
