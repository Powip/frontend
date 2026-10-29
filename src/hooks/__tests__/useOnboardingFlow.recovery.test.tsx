import { act, renderHook } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { toast } from "sonner";
import { getStoredOnboardingState, saveOnboardingState } from "@/lib/onboardingStorage";
import * as api from "@/services/onboardingService";
import type { FlowCheckoutResponse, SubscriptionMe } from "@/types/onboarding";
import { PAYMENT_MAX_ATTEMPTS, POLL_DELAY_MS, useOnboardingFlow } from "../useOnboardingFlow";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/services/onboardingService", () => ({
  ...jest.requireActual("@/services/onboardingService"),
  registerAccount: jest.fn(),
  loginAccount: jest.fn(),
  startFlowCheckout: jest.fn(),
  confirmFlowCheckout: jest.fn(),
  fetchMySubscription: jest.fn(),
}));
const mocked = jest.mocked(api);
const checkout: FlowCheckoutResponse = {
  subscriptionId: "s1",
  status: "PENDING_PAYMENT",
  cardToken: "fixture-card-token",
  redirectUrl: "https://flow.fixture.invalid/card",
};
const active: SubscriptionMe = {
  id: "s1",
  status: "ACTIVE",
  gateway: "FLOW",
  autoRenewal: true,
  startDate: null,
  endDate: null,
  plan: { id: "p1", name: "Basic", price: 99, durationInDays: 30 },
  addOns: [],
};
const pending: SubscriptionMe = { ...active, status: "PENDING_PAYMENT" };
const stored = {
  planId: "p1",
  planName: "Basic",
  price: 99,
  addOnIds: ["a1"],
  userId: "u1",
  cardToken: checkout.cardToken,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function error(code: string, status = 404) {
  return new AxiosError("fixture", code, undefined, undefined, {
    status,
    data: { code },
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}
function setup(onActivated = jest.fn()) {
  return renderHook(() =>
    useOnboardingFlow(
      { planId: "p1", planName: "Basic", price: 99, initialUserId: "u1" },
      jest.fn().mockResolvedValue({}),
      onActivated,
    ),
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  localStorage.clear();
  mocked.startFlowCheckout.mockResolvedValue(checkout);
  mocked.fetchMySubscription.mockResolvedValue(pending);
});
afterEach(() => jest.useRealTimers());

it("no duplica checkout ni confirmación ante llamadas simultáneas", async () => {
  const creation = deferred<FlowCheckoutResponse>();
  mocked.startFlowCheckout.mockReturnValueOnce(creation.promise);
  const { result } = setup();
  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = result.current.initiateCardRegistration();
    second = result.current.initiateCardRegistration();
  });
  expect(mocked.startFlowCheckout).toHaveBeenCalledTimes(1);
  await act(async () => {
    creation.resolve(checkout);
    await Promise.all([first, second]);
  });
  const confirmation = deferred<{ pending: false; subscription: SubscriptionMe }>();
  mocked.confirmFlowCheckout.mockReturnValueOnce(confirmation.promise);
  act(() => {
    first = result.current.confirmPayment();
    second = result.current.confirmPayment();
  });
  expect(mocked.confirmFlowCheckout).toHaveBeenCalledTimes(1);
  await act(async () => {
    confirmation.resolve({ pending: false, subscription: active });
    await Promise.all([first, second]);
  });
  expect(result.current.state.step).toBe("DONE");
});

it("un checkout resuelto después de desmontar no escribe storage ni emite toast", async () => {
  const request = deferred<FlowCheckoutResponse>();
  mocked.startFlowCheckout.mockReturnValueOnce(request.promise);
  const { result, unmount } = setup();
  let task!: Promise<void>;
  act(() => {
    task = result.current.initiateCardRegistration();
  });
  unmount();
  await act(async () => {
    request.resolve(checkout);
    await task;
  });
  expect(getStoredOnboardingState()).toBeNull();
  expect(toast.error).not.toHaveBeenCalled();
});

it("volver a planes invalida el checkout pendiente y no lo vuelve a abrir", async () => {
  const request = deferred<FlowCheckoutResponse>();
  mocked.startFlowCheckout.mockReturnValueOnce(request.promise);
  const { result } = setup();
  let task!: Promise<void>;
  act(() => {
    task = result.current.initiateCardRegistration();
  });
  act(() => result.current.goBack());
  await act(async () => {
    request.resolve(checkout);
    await task;
  });
  expect(result.current.state.step).toBe("ADDONS");
  expect(result.current.state.cardToken).toBeNull();
  expect(getStoredOnboardingState()).toBeNull();
});

it("refresh recupera el checkout únicamente para su usuario", () => {
  saveOnboardingState(stored);
  const same = setup();
  expect(same.result.current.state).toMatchObject({
    step: "CARD_WIDGET",
    cardToken: checkout.cardToken,
    addOnIds: ["a1"],
  });
  same.unmount();
  const other = renderHook(() =>
    useOnboardingFlow(
      { planId: "p2", planName: "Medium", price: 189, initialUserId: "u2" },
      jest.fn(),
    ),
  );
  expect(other.result.current.state).toMatchObject({
    step: "ADDONS",
    userId: "u2",
    cardToken: null,
    planId: "p2",
  });
});

it("reintenta confirmación usando el mismo checkout sin crear otro", async () => {
  const { result } = setup();
  await act(() => result.current.initiateCardRegistration());
  act(() => result.current.setError("Conexión interrumpida"));
  act(() => result.current.retry());
  expect(result.current.state.step).toBe("CARD_WIDGET");
  expect(result.current.state.cardToken).toBe(checkout.cardToken);
  expect(mocked.startFlowCheckout).toHaveBeenCalledTimes(1);
});

it("reconoce ACTIVE en la última consulta disponible", async () => {
  const { result } = setup();
  await act(() => result.current.initiateCardRegistration());
  mocked.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription: pending });
  for (let i = 0; i < PAYMENT_MAX_ATTEMPTS - 1; i++)
    mocked.fetchMySubscription.mockResolvedValueOnce(pending);
  mocked.fetchMySubscription.mockResolvedValueOnce(active);
  await act(async () => {
    const task = result.current.confirmPayment();
    await jest.advanceTimersByTimeAsync(POLL_DELAY_MS * PAYMENT_MAX_ATTEMPTS);
    await task;
  });
  expect(result.current.state.step).toBe("DONE");
});

it("no vuelve a consultar al desmontar durante la espera de polling", async () => {
  const { result, unmount } = setup();
  await act(() => result.current.initiateCardRegistration());
  mocked.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription: pending });
  let task!: Promise<void>;
  await act(async () => {
    task = result.current.confirmPayment();
    await Promise.resolve();
  });
  unmount();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(POLL_DELAY_MS);
    await task;
  });
  expect(mocked.fetchMySubscription).not.toHaveBeenCalled();
});

it("recupera una confirmación 200 perdida si el siguiente confirm da 404 y /me está ACTIVE", async () => {
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  mocked.confirmFlowCheckout.mockRejectedValue(error("SUBSCRIPTION_NOT_FOUND"));
  mocked.fetchMySubscription.mockResolvedValue(active);
  await act(() => result.current.confirmPayment());
  expect(result.current.state.step).toBe("DONE");
  expect(onActivated).toHaveBeenCalledTimes(1);
  expect(getStoredOnboardingState()).toBeNull();
});

it("ALREADY_SUBSCRIBED no fabrica DONE cuando /me no confirma plan vigente", async () => {
  mocked.startFlowCheckout.mockRejectedValue(error("ALREADY_SUBSCRIBED", 409));
  mocked.fetchMySubscription.mockResolvedValue(null);
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  expect(result.current.state.step).not.toBe("DONE");
  expect(onActivated).not.toHaveBeenCalled();
  expect(result.current.state.isLoading).toBe(false);
});

it("PAYMENT_IN_PROGRESS recupera PENDING_PAYMENT y solo permite verificar el checkout existente", async () => {
  mocked.startFlowCheckout.mockRejectedValue(error("PAYMENT_IN_PROGRESS", 409));
  mocked.fetchMySubscription.mockResolvedValue(pending);
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  expect(result.current.state).toMatchObject({
    step: "PAYMENT_PENDING",
    subscription: pending,
    isLoading: false,
  });
  expect(onActivated).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
  act(() => result.current.retry());
  await act(() => result.current.initiateCardRegistration());
  expect(mocked.startFlowCheckout).toHaveBeenCalledTimes(1);
  mocked.fetchMySubscription.mockResolvedValue(active);
  await act(() => result.current.checkPaymentAgain());
  expect(result.current.state.step).toBe("EXISTING_SUBSCRIPTION");
  expect(onActivated).not.toHaveBeenCalled();
  expect(mocked.confirmFlowCheckout).not.toHaveBeenCalled();
});

it("PAYMENT_IN_PROGRESS recupera una suscripción ya activa sin otro checkout", async () => {
  mocked.startFlowCheckout.mockRejectedValue(error("PAYMENT_IN_PROGRESS", 409));
  mocked.fetchMySubscription.mockResolvedValue(active);
  const onActivated = jest.fn().mockResolvedValue(true);
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  expect(result.current.state).toMatchObject({
    step: "EXISTING_SUBSCRIPTION",
    subscription: active,
  });
  expect(onActivated).not.toHaveBeenCalled();
  expect(mocked.startFlowCheckout).toHaveBeenCalledTimes(1);
});

it("PAYMENT_IN_PROGRESS con /me null queda en ERROR y retry solo verifica", async () => {
  mocked.startFlowCheckout.mockRejectedValue(error("PAYMENT_IN_PROGRESS", 409));
  mocked.fetchMySubscription.mockResolvedValue(null);
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  expect(result.current.state).toMatchObject({
    step: "ERROR",
    subscription: null,
    isLoading: false,
  });
  expect(onActivated).not.toHaveBeenCalled();
  act(() => result.current.retry());
  expect(result.current.state.step).toBe("PAYMENT_PENDING");
  mocked.fetchMySubscription.mockResolvedValue(active);
  await act(() => result.current.checkPaymentAgain());
  expect(mocked.startFlowCheckout).toHaveBeenCalledTimes(1);
  expect(mocked.confirmFlowCheckout).not.toHaveBeenCalled();
  expect(result.current.state.step).toBe("EXISTING_SUBSCRIPTION");
});

it("restore de URL espera la primera sesión, rechaza otro usuario y confirma una sola vez", async () => {
  const { result, rerender } = renderHook(
    ({ userId }) =>
      useOnboardingFlow({ planId: "", planName: "", price: 0, initialUserId: userId }, jest.fn()),
    { initialProps: { userId: null as string | null } },
  );
  act(() => result.current.restoreFromStorage(stored));
  expect(result.current.state).toMatchObject({
    step: "REGISTRATION",
    userId: null,
    cardToken: null,
  });
  rerender({ userId: "u1" });
  act(() => result.current.restoreFromStorage({ ...stored, userId: "other-user" }));
  expect(result.current.state.cardToken).toBeNull();
  act(() => result.current.restoreFromStorage(stored));
  expect(result.current.state).toMatchObject({
    step: "CARD_WIDGET",
    userId: "u1",
    cardToken: stored.cardToken,
  });
  mocked.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription: active });
  await act(() => result.current.confirmPayment());
  expect(result.current.state.step).toBe("DONE");
  expect(mocked.confirmFlowCheckout).toHaveBeenCalledTimes(1);
  expect(mocked.registerAccount).not.toHaveBeenCalled();
});

it("mantiene callbacks del widget estables al cambiar onActivated", async () => {
  const first = jest.fn();
  const latest = jest.fn();
  const { result, rerender } = renderHook(
    ({ activated }) =>
      useOnboardingFlow(
        { planId: "p1", planName: "Basic", price: 99, initialUserId: "u1" },
        jest.fn(),
        activated,
      ),
    { initialProps: { activated: first } },
  );
  await act(() => result.current.initiateCardRegistration());
  const confirm = result.current.confirmPayment;
  rerender({ activated: latest });
  expect(result.current.confirmPayment).toBe(confirm);
  mocked.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription: active });
  await act(() => result.current.confirmPayment());
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledTimes(1);
});

it("una respuesta de checkout de otra sesión no reemplaza al nuevo usuario", async () => {
  const request = deferred<FlowCheckoutResponse>();
  mocked.startFlowCheckout.mockReturnValueOnce(request.promise);
  const { result, rerender } = renderHook(
    ({ userId }) =>
      useOnboardingFlow(
        { planId: "p1", planName: "Basic", price: 99, initialUserId: userId },
        jest.fn(),
      ),
    { initialProps: { userId: "u1" as string | null } },
  );
  let task!: Promise<void>;
  act(() => {
    task = result.current.initiateCardRegistration();
  });
  rerender({ userId: "u2" });
  await act(async () => {
    request.resolve(checkout);
    await task;
  });
  expect(result.current.state).toMatchObject({ userId: "u2", step: "ADDONS", cardToken: null });
  expect(getStoredOnboardingState("u2")).toBeNull();
  rerender({ userId: null });
  expect(result.current.state).toMatchObject({
    userId: null,
    step: "REGISTRATION",
    cardToken: null,
  });
});

it("registro resuelto tras desmontar no intenta login ni cambia la sesión", async () => {
  const request = deferred<{ userId: string }>();
  mocked.registerAccount.mockReturnValueOnce(request.promise);
  const login = jest.fn();
  const { result, unmount } = renderHook(() =>
    useOnboardingFlow({ planId: "", planName: "", price: 0 }, login),
  );
  let task!: Promise<void>;
  act(() => {
    task = result.current.register({
      name: "Prueba",
      surname: "Prueba",
      email: "fixture@invalid.test",
      password: "fixture123",
      phone: "999111222",
      identityDocument: "00000000",
      address: "Fixture 123",
      district: "Fixture",
    });
  });
  unmount();
  await act(async () => {
    request.resolve({ userId: "new-user" });
    await task;
  });
  expect(mocked.loginAccount).not.toHaveBeenCalled();
  expect(login).not.toHaveBeenCalled();
});

it("un error de refresh de sesión no repite una confirmación ya activada", async () => {
  const onActivated = jest.fn().mockRejectedValue(new Error("fixture refresh failed"));
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  mocked.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription: active });
  await act(() => result.current.confirmPayment());
  expect(mocked.confirmFlowCheckout).toHaveBeenCalledTimes(1);
  expect(onActivated).toHaveBeenCalledTimes(1);
  expect(result.current.state.step).toBe("ERROR");
  expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/actualizar tu sesión/));
  onActivated.mockResolvedValueOnce(true);
  mocked.fetchMySubscription.mockResolvedValue(active);
  act(() => result.current.retry());
  expect(result.current.state.step).toBe("PAYMENT_PENDING");
  await act(() => result.current.checkPaymentAgain());
  expect(result.current.state.step).toBe("DONE");
  expect(mocked.confirmFlowCheckout).toHaveBeenCalledTimes(1);
});

it("refreshSession false conserva recuperación de sesión sin marcar DONE ni volver a confirmar", async () => {
  const onActivated = jest.fn().mockResolvedValue(false);
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  mocked.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription: active });
  await act(() => result.current.confirmPayment());
  expect(result.current.state).toMatchObject({
    step: "ERROR",
    isLoading: false,
    subscription: active,
  });
  expect(getStoredOnboardingState("u1")).not.toBeNull();
  expect(mocked.confirmFlowCheckout).toHaveBeenCalledTimes(1);
});

it("dos verificaciones simultáneas consultan /me una sola vez", async () => {
  const request = deferred<SubscriptionMe | null>();
  mocked.fetchMySubscription.mockReturnValueOnce(request.promise);
  const { result } = setup();
  await act(() => result.current.initiateCardRegistration());
  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = result.current.checkPaymentAgain();
    second = result.current.checkPaymentAgain();
  });
  expect(mocked.fetchMySubscription).toHaveBeenCalledTimes(1);
  await act(async () => {
    request.resolve(active);
    await Promise.all([first, second]);
  });
  expect(result.current.state.step).toBe("DONE");
});

it.each([
  ["ALREADY_SUBSCRIBED", { gateway: "MANUAL" as const }],
  ["ALREADY_SUBSCRIBED", { plan: { ...active.plan, id: "old-plan", name: "Anterior" } }],
  ["PAYMENT_IN_PROGRESS", { status: "PENDING_RENEWAL" as const }],
  ["PAYMENT_IN_PROGRESS", { startDate: "2025-01-01", endDate: "2027-01-01" }],
])("%s distingue una suscripción vigente de un cobro nuevo (%j)", async (code, changes) => {
  const existing = { ...active, ...changes };
  mocked.startFlowCheckout.mockRejectedValue(error(code, 409));
  mocked.fetchMySubscription.mockResolvedValue(existing);
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  expect(result.current.state).toMatchObject({
    step: "EXISTING_SUBSCRIPTION",
    subscription: existing,
    checkoutSubscriptionId: null,
  });
  act(() => result.current.retry());
  await act(() => result.current.initiateCardRegistration());
  expect(result.current.state.step).toBe("EXISTING_SUBSCRIPTION");
  expect(mocked.startFlowCheckout).toHaveBeenCalledTimes(1);
  expect(mocked.confirmFlowCheckout).not.toHaveBeenCalled();
  expect(onActivated).not.toHaveBeenCalled();
});

it("guarda y recupera el ID de la suscripción del checkout", async () => {
  const { result, unmount } = setup();
  await act(() => result.current.initiateCardRegistration());
  expect(getStoredOnboardingState("u1")?.subscriptionId).toBe("s1");
  unmount();
  const recovered = setup();
  expect(recovered.result.current.state.checkoutSubscriptionId).toBe("s1");
  recovered.unmount();
});

it.each([
  { id: "another-subscription" },
  { gateway: "MANUAL" as const },
  { plan: { ...active.plan, id: "another-plan" } },
])("confirmación de una suscripción diferente no completa el pago (%j)", async (changes) => {
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  mocked.confirmFlowCheckout.mockResolvedValue({
    pending: false,
    subscription: { ...active, ...changes },
  });
  await act(() => result.current.confirmPayment());
  expect(result.current.state.step).toBe("ERROR");
  expect(result.current.state.error).toMatch(/vincular/);
  expect(result.current.state.checkoutSubscriptionId).toBe("s1");
  expect(onActivated).not.toHaveBeenCalled();
});

it("polling no completa S1 con una suscripción S2 activa aunque tenga el mismo plan", async () => {
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  mocked.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription: pending });
  mocked.fetchMySubscription.mockResolvedValue({ ...active, id: "s2" });
  await act(async () => {
    const task = result.current.confirmPayment();
    await jest.advanceTimersByTimeAsync(POLL_DELAY_MS * PAYMENT_MAX_ATTEMPTS);
    await task;
  });
  expect(result.current.state.step).toBe("PAYMENT_PENDING");
  expect(result.current.state.subscription?.id).not.toBe("s2");
  expect(onActivated).not.toHaveBeenCalled();
});

it("un confirm 404 sin ID legacy no convierte cualquier plan activo en pago confirmado", async () => {
  saveOnboardingState(stored);
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  mocked.confirmFlowCheckout.mockRejectedValue(error("SUBSCRIPTION_NOT_FOUND"));
  mocked.fetchMySubscription.mockResolvedValue(active);
  await act(() => result.current.confirmPayment());
  expect(result.current.state.step).toBe("ERROR");
  expect(result.current.state.checkoutSubscriptionId).toBeNull();
  expect(onActivated).not.toHaveBeenCalled();
});

it("un confirm 404 con ID conocido rechaza otra suscripción activa", async () => {
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  mocked.confirmFlowCheckout.mockRejectedValue(error("SUBSCRIPTION_NOT_FOUND"));
  mocked.fetchMySubscription.mockResolvedValue({ ...active, id: "s2" });
  await act(() => result.current.confirmPayment());
  expect(result.current.state.step).toBe("ERROR");
  expect(onActivated).not.toHaveBeenCalled();
});

it("confirm 200 enlaza el ID faltante de metadata legacy antes de verificar el cobro", async () => {
  saveOnboardingState(stored);
  const { result } = setup();
  mocked.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription: pending });
  await act(async () => {
    const task = result.current.confirmPayment();
    await jest.advanceTimersByTimeAsync(POLL_DELAY_MS * PAYMENT_MAX_ATTEMPTS);
    await task;
  });
  expect(result.current.state.checkoutSubscriptionId).toBe("s1");
  expect(getStoredOnboardingState("u1")?.subscriptionId).toBe("s1");
  mocked.fetchMySubscription.mockResolvedValue(active);
  await act(() => result.current.checkPaymentAgain());
  expect(result.current.state.step).toBe("DONE");
});

it("renovación pendiente no se anuncia como primer cobro confirmado", async () => {
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  mocked.confirmFlowCheckout.mockResolvedValue({
    pending: false,
    subscription: { ...active, status: "PENDING_RENEWAL" },
  });
  await act(() => result.current.confirmPayment());
  expect(result.current.state.step).toBe("EXISTING_SUBSCRIPTION");
  expect(onActivated).not.toHaveBeenCalled();
});

it("recuperación pendiente sólo sigue la suscripción observada originalmente", async () => {
  mocked.startFlowCheckout.mockRejectedValue(error("PAYMENT_IN_PROGRESS", 409));
  mocked.fetchMySubscription.mockResolvedValue(pending);
  const onActivated = jest.fn();
  const { result } = setup(onActivated);
  await act(() => result.current.initiateCardRegistration());
  mocked.fetchMySubscription.mockResolvedValue({ ...active, id: "s2" });
  await act(async () => {
    const task = result.current.checkPaymentAgain();
    await jest.advanceTimersByTimeAsync(POLL_DELAY_MS * PAYMENT_MAX_ATTEMPTS);
    await task;
  });
  expect(result.current.state.step).toBe("PAYMENT_PENDING");
  expect(result.current.state.subscription?.id).toBe("s1");
  expect(onActivated).not.toHaveBeenCalled();
  expect(mocked.startFlowCheckout).toHaveBeenCalledTimes(1);
});
