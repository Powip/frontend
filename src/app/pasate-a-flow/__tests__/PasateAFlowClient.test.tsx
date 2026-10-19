import { act, fireEvent, render, screen } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMySubscription } from "@/services/onboardingService";
import type { SubscriptionMe } from "@/types/onboarding";
import type { SubscriptionAccess } from "@/types/subscriptionAccess";
import PasateAFlowClient from "../PasateAFlowClient";

const push = jest.fn();
const onboardingProps = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/onboardingService", () => ({ fetchMySubscription: jest.fn() }));
jest.mock("@/lib/flowMigration", () => ({
  ...jest.requireActual("@/lib/flowMigration"),
  limaToday: () => "2026-10-20",
}));
jest.mock("@/app/onboarding/OnboardingClient", () => ({
  __esModule: true,
  default: (props: { mode?: string }) => {
    onboardingProps(props);
    return <p>onboarding en modo {props.mode}</p>;
  },
}));

const plan = { id: "basic", name: "Basic", price: 99, durationInDays: 30 };
const manual: SubscriptionMe = {
  id: "m1",
  status: "ACTIVE",
  gateway: "MANUAL",
  autoRenewal: false,
  startDate: "2026-09-28",
  endDate: "2026-10-28",
  plan,
  addOns: [{ code: "courier", name: "Courier", amount: 30 }],
  scheduledFlow: null,
};
const aviso: SubscriptionAccess = { state: "AVISO", deadline: "2026-10-28", firstChargeDate: null, owner: true };
const logout = jest.fn().mockResolvedValue(undefined);
const refreshSubscription = jest.fn().mockResolvedValue(undefined);
const refreshSession = jest.fn().mockResolvedValue(true);

function renderWith(access: SubscriptionAccess | null, me: SubscriptionMe | null | Error = manual) {
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: "owner", email: "dueno@test.pe" }, company: { id: "c1" }, access },
    logout,
    refreshSubscription,
    refreshSession,
  } as unknown as ReturnType<typeof useAuth>);
  if (me instanceof Error) jest.mocked(fetchMySubscription).mockRejectedValue(me);
  else jest.mocked(fetchMySubscription).mockResolvedValue(me);
  return render(<PasateAFlowClient />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("el personal no puede pagar desde acá", async () => {
  renderWith({ ...aviso, owner: false });

  expect(await screen.findByText("Solo el dueño de la cuenta puede registrar la tarjeta.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
  expect(onboardingProps).not.toHaveBeenCalled();
});

it("sin dato de acceso no ofrece pagar y deja reintentar", async () => {
  renderWith(null);

  expect(await screen.findByText("No pudimos verificar tu cuenta.")).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); });
  expect(refreshSubscription).toHaveBeenCalledTimes(1);
  expect(onboardingProps).not.toHaveBeenCalled();
});

it("si /me falla no ofrece pagar", async () => {
  renderWith(aviso, new Error("500"));

  expect(await screen.findByText("No pudimos cargar tu plan.")).toBeInTheDocument();
  expect(onboardingProps).not.toHaveBeenCalled();
});

it("con Flow vigente avisa que ya está en Flow", async () => {
  renderWith({ ...aviso, state: "OK", deadline: null }, { ...manual, gateway: "FLOW" });

  expect(await screen.findByText("Ya estás en Flow.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir a Powip" })).toHaveAttribute("href", "/");
  expect(onboardingProps).not.toHaveBeenCalled();
});

it("con la migración programada muestra el primer cobro y no ofrece pagar otra vez", async () => {
  renderWith(
    { state: "OK", deadline: null, firstChargeDate: "2026-10-29", owner: true },
    { ...manual, scheduledFlow: { id: "s1", firstChargeDate: "2026-10-29", plan, addOns: [] } },
  );

  expect(await screen.findByText("Ya estás en Flow. Tu primer cobro es el jueves 29/10.")).toBeInTheDocument();
  expect(onboardingProps).not.toHaveBeenCalled();
});

it("si la fecha del primer cobro ya pasó, avisa que se está procesando", async () => {
  renderWith(
    { state: "OK", deadline: null, firstChargeDate: null, owner: true },
    { ...manual, scheduledFlow: { id: "s1", firstChargeDate: "2026-10-19", plan, addOns: [] } },
  );

  expect(await screen.findByText("Estamos procesando tu primer cobro.")).toBeInTheDocument();
  expect(onboardingProps).not.toHaveBeenCalled();
});

it("al dueño MANUAL le abre el pago con su plan, sus add-ons y lo que ya pagó", async () => {
  renderWith(aviso);

  expect(await screen.findByText("onboarding en modo migration")).toBeInTheDocument();
  expect(onboardingProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      mode: "migration",
      initialAuth: { userId: "owner" },
      planId: "basic",
      planName: "Basic",
      price: 99,
      initialAddOnCodes: ["courier"],
      paidUntil: "2026-10-28",
      blocked: false,
    }),
  );
});

it("bloqueado abre el pago con el aviso de suspendido y sin días pagados", async () => {
  renderWith({ ...aviso, state: "BLOQUEADO" }, { ...manual, status: "EXPIRED", endDate: "2026-09-30" });

  await screen.findByText("onboarding en modo migration");
  expect(onboardingProps).toHaveBeenLastCalledWith(expect.objectContaining({ blocked: true, paidUntil: null }));
});

it("sin suscripción previa abre el pago sin nada preseleccionado", async () => {
  renderWith(aviso, null);

  await screen.findByText("onboarding en modo migration");
  expect(onboardingProps).toHaveBeenLastCalledWith(
    expect.objectContaining({ planId: "", planName: "", price: 0, initialAddOnCodes: [], paidUntil: null }),
  );
});

it("Ir a Powip recarga la sesión y vuelve al inicio", async () => {
  renderWith(aviso);
  await screen.findByText("onboarding en modo migration");
  const { onGoToDashboard } = onboardingProps.mock.lastCall[0] as { onGoToDashboard: () => Promise<void> };

  await act(async () => { await onGoToDashboard(); });

  expect(refreshSession).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith("/");
});

it("Cerrar sesión cierra la sesión y va al login", async () => {
  renderWith({ ...aviso, owner: false });
  await screen.findByText("Solo el dueño de la cuenta puede registrar la tarjeta.");

  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" })); });

  expect(logout).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith("/login");
});
