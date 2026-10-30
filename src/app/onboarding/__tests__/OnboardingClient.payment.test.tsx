import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { goToExternalPage } from "@/lib/browserNavigation";
import * as api from "@/services/onboardingService";
import type { SubscriptionMe } from "@/types/onboarding";
import OnboardingClient from "../OnboardingClient";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/onboardingService", () => ({
  ...jest.requireActual("@/services/onboardingService"),
  fetchPlans: jest.fn(),
  fetchAddOns: jest.fn(),
  startFlowCheckout: jest.fn(),
  confirmFlowCheckout: jest.fn(),
  fetchMySubscription: jest.fn(),
}));
jest.mock("@/lib/browserNavigation", () => ({ goToExternalPage: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
const mocked = jest.mocked(api);
const refreshSession = jest.fn();
const existing: SubscriptionMe = {
  id: "existing-subscription",
  gateway: "MANUAL",
  status: "ACTIVE",
  autoRenewal: false,
  startDate: "2026-10-01",
  endDate: "2026-11-01",
  plan: { id: "old-plan", name: "Plan anterior", price: 50, durationInDays: 30 },
  addOns: [],
};

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  delete window.Flow;
  mocked.fetchPlans.mockResolvedValue([
    { id: "basic", name: "Basic", price: 99, durationInDays: 30 },
  ]);
  mocked.fetchAddOns.mockResolvedValue([]);
  refreshSession.mockResolvedValue(true);
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "fixture-token", user: { id: "fixture-user" }, company: null },
    login: jest.fn(),
    refreshSession,
  } as unknown as ReturnType<typeof useAuth>);
});

async function openPayment() {
  render(<OnboardingClient planName="Basic" />);
  const next = await screen.findByRole("button", { name: "Continuar al pago" });
  await waitFor(() => expect(next).toBeEnabled());
  fireEvent.click(next);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Registrar tarjeta" }));
  });
}

it.each(["ALREADY_SUBSCRIBED", "PAYMENT_IN_PROGRESS"])(
  "%s no presenta una suscripción manual previa como un nuevo pago",
  async (code) => {
    mocked.startFlowCheckout.mockRejectedValue(
      new AxiosError("Conflict", code, undefined, undefined, {
        status: 409,
        data: { code },
        statusText: "Conflict",
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    mocked.fetchMySubscription.mockResolvedValue(existing);

    await openPayment();

    await screen.findByRole("heading", { name: "Ya tienes una suscripción vigente" });
    expect(screen.getByText("Plan anterior")).toBeInTheDocument();
    expect(screen.queryByText("¡Cuenta activada!")).not.toBeInTheDocument();
    expect(screen.queryByText("Pagado")).not.toBeInTheDocument();
    expect(screen.queryByText("Comprobante de suscripción")).not.toBeInTheDocument();
    expect(mocked.confirmFlowCheckout).not.toHaveBeenCalled();
    expect(refreshSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Continuar con mi plan actual" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/new-company"));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(mocked.startFlowCheckout).toHaveBeenCalledTimes(1);
  },
);

it("un checkout nuevo muestra el registro de Flow y no confirma ni activa por iniciar el pago", async () => {
  mocked.startFlowCheckout.mockResolvedValue({
    subscriptionId: "new-subscription",
    status: "PENDING_PAYMENT",
    cardToken: "fixture-card-token",
    redirectUrl: "https://www.flow.cl/fixture",
  });
  await openPayment();
  await screen.findByText("Cargando widget de pago...");
  expect(screen.queryByText("¡Cuenta activada!")).not.toBeInTheDocument();
  expect(mocked.confirmFlowCheckout).not.toHaveBeenCalled();
  expect(refreshSession).not.toHaveBeenCalled();
});

it("no navega con la suscripción anterior si falla la actualización de sesión", async () => {
  mocked.startFlowCheckout.mockRejectedValue(
    new AxiosError("Conflict", "ALREADY_SUBSCRIBED", undefined, undefined, {
      status: 409,
      data: { code: "ALREADY_SUBSCRIBED" },
      statusText: "Conflict",
      headers: {},
      config: { headers: new AxiosHeaders() },
    }),
  );
  mocked.fetchMySubscription.mockResolvedValue(existing);
  refreshSession.mockResolvedValue(false);
  await openPayment();
  fireEvent.click(await screen.findByRole("button", { name: "Continuar con mi plan actual" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos actualizar tu sesión");
  expect(push).not.toHaveBeenCalled();
});

it("ofrece pagar con Yape y lo manda a la página de Flow, donde está Yape recurrente", async () => {
  mocked.startFlowCheckout.mockResolvedValue({
    subscriptionId: "new-subscription",
    status: "PENDING_PAYMENT",
    cardToken: "fixture-card-token",
    redirectUrl: "https://www.flow.cl/fixture",
  });
  render(<OnboardingClient planName="Basic" />);
  const next = await screen.findByRole("button", { name: "Continuar al pago" });
  await waitFor(() => expect(next).toBeEnabled());
  fireEvent.click(next);
  expect(screen.getByRole("button", { name: "Registrar tarjeta" })).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Pagar con Yape" }));
  });

  await waitFor(() => expect(goToExternalPage).toHaveBeenCalledWith("https://www.flow.cl/fixture"));
  expect(screen.queryByText("Cargando widget de pago...")).not.toBeInTheDocument();
  expect(mocked.confirmFlowCheckout).not.toHaveBeenCalled();
});

it("en el widget de tarjeta deja pasar a la página de Flow para pagar con Yape", async () => {
  mocked.startFlowCheckout.mockResolvedValue({
    subscriptionId: "new-subscription",
    status: "PENDING_PAYMENT",
    cardToken: "fixture-card-token",
    redirectUrl: "https://www.flow.cl/fixture",
  });
  await openPayment();
  const link = await screen.findByRole("link", { name: /Yape/ });
  expect(link).toHaveAttribute("href", "https://www.flow.cl/fixture");
});
