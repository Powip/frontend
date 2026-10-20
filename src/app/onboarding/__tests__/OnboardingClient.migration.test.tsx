import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { useAuth } from "@/contexts/AuthContext";
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
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/components/onboarding/FlowWidgetStep", () => ({
  __esModule: true,
  default: ({ onSuccess }: { onSuccess: () => Promise<void> }) => (
    <button type="button" onClick={() => void onSuccess()}>
      Tarjeta registrada en Flow
    </button>
  ),
}));
jest.mock("@/lib/flowMigration", () => ({
  ...jest.requireActual("@/lib/flowMigration"),
  limaToday: () => "2026-10-20",
}));

const mocked = jest.mocked(api);
const goToDashboard = jest.fn();
const plan = { id: "basic", name: "Basic", price: 99, durationInDays: 30 };
const courier = { id: "a-courier", code: "courier", name: "Courier", amount: 30, annualAmount: 360, currency: "PEN" };
const sunat = { id: "a-sunat", code: "sunat", name: "SUNAT", amount: 30, annualAmount: 360, currency: "PEN" };

const manualWithScheduled: SubscriptionMe = {
  id: "m1",
  status: "ACTIVE",
  gateway: "MANUAL",
  autoRenewal: false,
  startDate: "2026-09-28",
  endDate: "2026-10-28",
  plan,
  addOns: [{ code: "courier", name: "Courier", amount: 30 }],
  scheduledFlow: { id: "s1", firstChargeDate: "2026-10-29", plan, addOns: [] },
};

function conflict(code: string) {
  return new AxiosError("Conflict", code, undefined, undefined, {
    status: 409,
    data: { code },
    statusText: "Conflict",
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  mocked.fetchPlans.mockResolvedValue([plan]);
  mocked.fetchAddOns.mockResolvedValue([courier, sunat]);
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "fixture-token", user: { id: "owner" }, company: { id: "c1" } },
    login: jest.fn(),
    refreshSession: jest.fn().mockResolvedValue(true),
  } as unknown as ReturnType<typeof useAuth>);
});

function renderMigration(props: Partial<React.ComponentProps<typeof OnboardingClient>> = {}) {
  return render(
    <OnboardingClient
      mode="migration"
      initialAuth={{ userId: "owner" }}
      planId="basic"
      planName="Basic"
      price={99}
      initialAddOnCodes={["courier"]}
      paidUntil="2026-10-28"
      onGoToDashboard={goToDashboard}
      {...props}
    />,
  );
}

async function openPayment() {
  const next = await screen.findByRole("button", { name: "Continuar al pago" });
  await waitFor(() => expect(next).toBeEnabled());
  await screen.findByText("Integración Courier");
  fireEvent.click(next);
}

it("arranca en el plan, sin registro, con su plan y su add-on marcados", async () => {
  renderMigration();

  expect(await screen.findByRole("heading", { name: "Pasate a Flow", level: 1 })).toBeInTheDocument();
  const progress = screen.getByRole("navigation", { name: "Progreso de la suscripción" });
  expect(within(progress).queryByText("Cuenta")).not.toBeInTheDocument();
  expect(within(progress).getByText("Tarjeta")).toBeInTheDocument();

  await openPayment();

  // Basic 99 + Courier 30 (SUNAT no estaba contratado).
  expect(screen.getByText(/Tu primer cobro será el jueves 29\/10: S\/ 129\/mes/)).toBeInTheDocument();
});

it("con días pagados explica que hoy no se cobra y cuándo es el primer cobro", async () => {
  renderMigration();
  await openPayment();

  expect(
    screen.getByText(
      "Hoy no te cobramos nada. Tu primer cobro será el jueves 29/10: S/ 129/mes. Hasta entonces sigues con tu plan actual.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Acceso inmediato al activar/)).not.toBeInTheDocument();
});

it("vencido avisa que se cobra hoy", async () => {
  renderMigration({ paidUntil: null });
  await openPayment();

  expect(screen.getByText("Se cobra hoy al registrar la tarjeta: S/ 129/mes.")).toBeInTheDocument();
});

it("manda migrate y, si ya quedó programada, muestra el primer cobro y vuelve a Powip", async () => {
  mocked.startFlowCheckout.mockRejectedValue(conflict("PAYMENT_IN_PROGRESS"));
  mocked.fetchMySubscription.mockResolvedValue(manualWithScheduled);
  renderMigration();
  await openPayment();

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Registrar tarjeta" }));
  });

  expect(mocked.startFlowCheckout).toHaveBeenCalledWith("basic", ["a-courier"], { migrate: true });
  expect(await screen.findByRole("heading", { name: "¡Listo, ya estás en Flow!" })).toBeInTheDocument();
  expect(
    screen.getByText("Tu primer cobro es el jueves 29/10. Hasta entonces sigues con tu plan actual."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ir a Powip" }));
  expect(goToDashboard).toHaveBeenCalledTimes(1);
});

it("si ya tenía Flow vigente no muestra 'Ya tienes una suscripción vigente' sino que ya está en Flow", async () => {
  mocked.startFlowCheckout.mockRejectedValue(conflict("ALREADY_SUBSCRIBED"));
  mocked.fetchMySubscription.mockResolvedValue({ ...manualWithScheduled, gateway: "FLOW", scheduledFlow: null });
  renderMigration();
  await openPayment();

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Registrar tarjeta" }));
  });

  expect(await screen.findByText("Ya estás en Flow.")).toBeInTheDocument();
  expect(screen.queryByText("Ya tienes una suscripción vigente")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ir a Powip" }));
  expect(goToDashboard).toHaveBeenCalledTimes(1);
});

it("con cobro inmediato termina en 'Tu plan está activo' e Ir a Powip, sin configurar la empresa", async () => {
  mocked.startFlowCheckout.mockResolvedValue({
    subscriptionId: "s1",
    status: "PENDING_PAYMENT",
    redirectUrl: "https://flow.fixture/register",
    cardToken: "tk",
  });
  mocked.confirmFlowCheckout.mockResolvedValue({
    pending: false,
    subscription: { ...manualWithScheduled, id: "s1", gateway: "FLOW", status: "ACTIVE", startDate: "2026-10-20", endDate: "2026-11-19", scheduledFlow: null },
  });
  renderMigration({ paidUntil: null, blocked: true });
  await openPayment();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Registrar tarjeta" }));
  });

  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Tarjeta registrada en Flow" }));
  });

  expect(await screen.findByRole("heading", { name: "¡Listo, ya estás en Flow!" })).toBeInTheDocument();
  expect(screen.getByText("Tu plan está activo.")).toBeInTheDocument();
  expect(screen.queryByText("Configurar mi empresa")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ir a Powip" }));
  expect(goToDashboard).toHaveBeenCalledTimes(1);
});

it("bloqueado explica que el acceso está suspendido", async () => {
  renderMigration({ blocked: true, paidUntil: null });

  expect(
    await screen.findByText("Tu acceso a Powip está suspendido. Registra tu tarjeta para volver a usarlo."),
  ).toBeInTheDocument();
});

it("el onboarding normal no cambia", async () => {
  render(<OnboardingClient initialAuth={{ userId: "owner" }} planName="Basic" />);
  const next = await screen.findByRole("button", { name: "Continuar al pago" });
  await waitFor(() => expect(next).toBeEnabled());
  fireEvent.click(next);

  expect(screen.getByRole("heading", { name: "Configura tu cuenta", level: 1 })).toBeInTheDocument();
  expect(screen.getByText(/Acceso inmediato al activar/)).toBeInTheDocument();
  expect(screen.queryByText(/Hoy no te cobramos nada/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Se cobra hoy al registrar la tarjeta/)).not.toBeInTheDocument();
});
