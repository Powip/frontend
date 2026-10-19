import { act, renderHook } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { getStoredOnboardingState, saveOnboardingState } from "@/lib/onboardingStorage";
import * as api from "@/services/onboardingService";
import type { SubscriptionMe } from "@/types/onboarding";
import { useOnboardingFlow } from "../useOnboardingFlow";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/services/onboardingService", () => {
  const actual = jest.requireActual("@/services/onboardingService");
  return {
    ...actual,
    registerAccount: jest.fn(),
    loginAccount: jest.fn(),
    startFlowCheckout: jest.fn(),
    confirmFlowCheckout: jest.fn(),
    fetchMySubscription: jest.fn(),
  };
});

const mocked = api as jest.Mocked<typeof api>;
const plan = { id: "p1", name: "Basic", price: 99, durationInDays: 30 };

/** Lo que devuelve el confirm de una migración programada (Parte 1). */
const scheduled: SubscriptionMe = {
  id: "s1",
  status: "PENDING_PAYMENT",
  gateway: "FLOW",
  autoRenewal: true,
  startDate: "2026-10-29",
  endDate: null,
  plan,
  addOns: [],
};

/** /me de un dueño con la migración programada: sigue el plan MANUAL y suma scheduledFlow. */
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

function apiError(status: number, code: string) {
  const response = { status, data: { code }, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } };
  return new AxiosError("error", String(status), undefined, undefined, response);
}

const setup = (migrate: boolean, onActivated = jest.fn().mockResolvedValue(true)) => {
  const hook = renderHook(() =>
    useOnboardingFlow({ planId: "p1", planName: "Basic", price: 99, initialUserId: "u1", migrate }, jest.fn(), onActivated),
  );
  return { ...hook, onActivated };
};

async function reachWidget(result: ReturnType<typeof setup>["result"]) {
  mocked.startFlowCheckout.mockResolvedValue({
    subscriptionId: "s1",
    status: "PENDING_PAYMENT",
    redirectUrl: "u",
    cardToken: "tk",
  });
  await act(() => result.current.initiateCardRegistration());
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear();
});
afterEach(() => jest.useRealTimers());

it("manda migrate en el checkout y lo guarda para la vuelta de Flow", async () => {
  const { result } = setup(true);

  await reachWidget(result);

  expect(mocked.startFlowCheckout).toHaveBeenCalledWith("p1", [], { migrate: true });
  expect(getStoredOnboardingState("u1")?.migrate).toBe(true);
  expect(result.current.state.step).toBe("CARD_WIDGET");
});

it("sin modo migración el checkout se llama como siempre", async () => {
  const { result } = setup(false);

  await reachWidget(result);

  expect(mocked.startFlowCheckout).toHaveBeenCalledWith("p1", []);
  expect(getStoredOnboardingState("u1")?.migrate).toBeUndefined();
});

it("una migración programada termina con el confirm, sin esperar el cobro", async () => {
  const { result, onActivated } = setup(true);
  await reachWidget(result);
  mocked.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription: scheduled });

  await act(() => result.current.confirmPayment());

  expect(result.current.state.step).toBe("MIGRATION_SCHEDULED");
  expect(result.current.state.firstChargeDate).toBe("2026-10-29");
  expect(mocked.fetchMySubscription).not.toHaveBeenCalled();
  expect(onActivated).toHaveBeenCalledTimes(1);
  expect(getStoredOnboardingState("u1")).toBeNull();
});

it("si estaba vencido, se cobra en el momento y termina como hoy", async () => {
  const { result } = setup(true);
  await reachWidget(result);
  mocked.confirmFlowCheckout.mockResolvedValue({
    pending: false,
    subscription: { ...scheduled, startDate: null },
  });
  mocked.fetchMySubscription.mockResolvedValue({ ...scheduled, status: "ACTIVE", startDate: "2026-10-20", endDate: "2026-11-19" });

  await act(async () => {
    const p = result.current.confirmPayment();
    await jest.advanceTimersByTimeAsync(3000);
    await p;
  });

  expect(result.current.state.step).toBe("DONE");
});

it("si se perdió la respuesta del confirm, reconoce la programada con scheduledFlow", async () => {
  const { result } = setup(true);
  await reachWidget(result);
  mocked.confirmFlowCheckout.mockRejectedValue(apiError(404, "SUBSCRIPTION_NOT_FOUND"));
  mocked.fetchMySubscription.mockResolvedValue(manualWithScheduled);

  await act(() => result.current.confirmPayment());

  expect(result.current.state.step).toBe("MIGRATION_SCHEDULED");
  expect(result.current.state.firstChargeDate).toBe("2026-10-29");
});

it("volver a verificar reconoce la programada", async () => {
  const { result } = setup(true);
  await reachWidget(result);
  mocked.fetchMySubscription.mockResolvedValue(manualWithScheduled);

  await act(() => result.current.checkPaymentAgain());

  expect(result.current.state.step).toBe("MIGRATION_SCHEDULED");
});

it("si ya hay un pago en curso y es la migración programada, lo muestra en vez de cobrar otra vez", async () => {
  const { result } = setup(true);
  mocked.startFlowCheckout.mockRejectedValue(apiError(409, "PAYMENT_IN_PROGRESS"));
  mocked.fetchMySubscription.mockResolvedValue(manualWithScheduled);

  await act(() => result.current.initiateCardRegistration());

  expect(result.current.state.step).toBe("MIGRATION_SCHEDULED");
  expect(result.current.state.firstChargeDate).toBe("2026-10-29");
});

it("no retoma un checkout guardado del onboarding normal", () => {
  saveOnboardingState({ planId: "p1", planName: "Basic", price: 99, addOnIds: [], userId: "u1", cardToken: "tk-normal", subscriptionId: "s0" });

  const { result } = setup(true);

  expect(result.current.state.step).toBe("ADDONS");
  expect(result.current.state.cardToken).toBeNull();
});

it("el onboarding normal no retoma un checkout guardado de la migración", () => {
  saveOnboardingState({ planId: "p1", planName: "Basic", price: 99, addOnIds: [], userId: "u1", cardToken: "tk-mig", subscriptionId: "s1", migrate: true });

  const { result } = setup(false);

  expect(result.current.state.step).toBe("ADDONS");
  expect(result.current.state.cardToken).toBeNull();
});

it("la migración retoma su propio checkout guardado", () => {
  saveOnboardingState({ planId: "p1", planName: "Basic", price: 99, addOnIds: [], userId: "u1", cardToken: "tk-mig", subscriptionId: "s1", migrate: true });

  const { result } = setup(true);

  expect(result.current.state.step).toBe("CARD_WIDGET");
  expect(result.current.state.cardToken).toBe("tk-mig");
});
