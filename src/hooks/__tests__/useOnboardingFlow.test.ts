import { act, renderHook } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { useOnboardingFlow } from "../useOnboardingFlow";
import * as api from "@/services/onboardingService";
import { getStoredOnboardingState } from "@/lib/onboardingStorage";
import type { SubscriptionMe } from "@/types/onboarding";

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

const active: SubscriptionMe = {
  id: "s1",
  status: "ACTIVE",
  gateway: "FLOW",
  autoRenewal: true,
  startDate: "2026-09-27",
  endDate: "2026-10-27",
  plan: { id: "p1", name: "Basic", price: 99, durationInDays: 30 },
  addOns: [],
};

function apiError(status: number, code: string) {
  const response = { status, data: { code }, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } };
  return new AxiosError("error", String(status), undefined, undefined, response);
}

const registerData = {
  name: "Ana",
  surname: "Pérez",
  email: "Ana@Test.pe",
  password: "clave123",
  phone: "987654321",
  identityDocument: "12345678",
  address: "Av. Larco 123",
  district: "Miraflores",
};

describe("useOnboardingFlow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => jest.useRealTimers());

  const setup = (initialUserId: string | null = "u1", onActivated = jest.fn()) => {
    const login = jest.fn().mockResolvedValue({});
    const hook = renderHook(() =>
      useOnboardingFlow({ planId: "p1", planName: "Basic", price: 99, initialUserId }, login, onActivated),
    );
    return { ...hook, login, onActivated };
  };

  it("registro: crea la cuenta en ms-auth con los campos obligatorios y loguea (cookie de refresh)", async () => {
    mocked.registerAccount.mockResolvedValue({ userId: "u9" });
    mocked.loginAccount.mockResolvedValue({ accessToken: "jwt" });
    const { result, login } = setup(null);

    await act(() => result.current.register(registerData));

    expect(mocked.registerAccount).toHaveBeenCalledWith({
      name: "Ana",
      surname: "Pérez",
      email: "ana@test.pe",
      password: "clave123",
      phoneNumber: "+51987654321",
      identityDocument: "12345678",
      address: "Av. Larco 123",
      district: "Miraflores",
    });
    expect(mocked.loginAccount).toHaveBeenCalledWith("ana@test.pe", "clave123");
    expect(login).toHaveBeenCalledWith({ accessToken: "jwt" });
    expect(result.current.state.step).toBe("ADDONS");
  });

  it("registro con email existente muestra el error y no avanza", async () => {
    mocked.registerAccount.mockRejectedValue(apiError(409, "X"));
    const { result } = setup(null);

    await act(() => result.current.register(registerData));

    expect(result.current.state.step).toBe("REGISTRATION");
    expect(result.current.state.error).toMatch(/ya está registrado/);
  });

  it("checkout guarda el token para sobrevivir a la redirección y abre el widget", async () => {
    mocked.startFlowCheckout.mockResolvedValue({ subscriptionId: "s1", status: "PENDING_PAYMENT", redirectUrl: "https://flow/x?token=tk", cardToken: "tk" });
    const { result } = setup();
    act(() => result.current.selectAddOns(["a1"]));

    await act(() => result.current.initiateCardRegistration());

    expect(mocked.startFlowCheckout).toHaveBeenCalledWith("p1", ["a1"]);
    expect(result.current.state.step).toBe("CARD_WIDGET");
    expect(getStoredOnboardingState()).toMatchObject({ cardToken: "tk", addOnIds: ["a1"] });
  });

  it("checkout de alguien que ya pagó lo lleva directo al final", async () => {
    mocked.startFlowCheckout.mockRejectedValue(apiError(409, "ALREADY_SUBSCRIBED"));
    mocked.fetchMySubscription.mockResolvedValue(active);
    const { result, onActivated } = setup();

    await act(() => result.current.initiateCardRegistration());

    expect(result.current.state.step).toBe("DONE");
    expect(onActivated).toHaveBeenCalled();
  });

  it("checkout con email rechazado por Flow explica que el email tiene que ser real", async () => {
    mocked.startFlowCheckout.mockRejectedValue(apiError(422, "INVALID_EMAIL"));
    const { result } = setup();

    await act(() => result.current.initiateCardRegistration());

    expect(result.current.state.error).toMatch(/email/i);
    expect(result.current.state.step).not.toBe("CARD_WIDGET");
  });

  async function reachWidget(result: ReturnType<typeof setup>["result"]) {
    mocked.startFlowCheckout.mockResolvedValue({ subscriptionId: "s1", status: "PENDING_PAYMENT", redirectUrl: "u", cardToken: "tk" });
    await act(() => result.current.initiateCardRegistration());
  }

  it("confirm: reintenta mientras la tarjeta está pendiente (202) y activa al quedar ACTIVE", async () => {
    const { result, onActivated } = setup();
    await reachWidget(result);
    mocked.confirmFlowCheckout
      .mockResolvedValueOnce({ pending: true })
      .mockResolvedValueOnce({ pending: false, subscription: active });

    await act(async () => {
      const p = result.current.confirmPayment();
      await jest.advanceTimersByTimeAsync(3000);
      await p;
    });

    expect(mocked.confirmFlowCheckout).toHaveBeenCalledTimes(2);
    expect(result.current.state.step).toBe("DONE");
    expect(result.current.state.subscription?.status).toBe("ACTIVE");
    expect(onActivated).toHaveBeenCalled();
    expect(getStoredOnboardingState()).toBeNull();
  });

  it("confirm: si el primer cobro sigue pendiente, NO deja entrar (PAYMENT_PENDING)", async () => {
    const { result, onActivated } = setup();
    await reachWidget(result);
    const pending = { ...active, status: "PENDING_PAYMENT" as const };
    mocked.confirmFlowCheckout.mockResolvedValue({ pending: false, subscription: pending });
    mocked.fetchMySubscription.mockResolvedValue(pending);

    await act(async () => {
      const p = result.current.confirmPayment();
      await jest.advanceTimersByTimeAsync(3000 * 12);
      await p;
    });

    expect(result.current.state.step).toBe("PAYMENT_PENDING");
    expect(onActivated).not.toHaveBeenCalled();
  });

  it("confirm: tarjeta rechazada corta el flujo con error", async () => {
    const { result } = setup();
    await reachWidget(result);
    mocked.confirmFlowCheckout.mockRejectedValue(apiError(422, "CARD_REJECTED"));

    await act(() => result.current.confirmPayment());

    expect(result.current.state.step).toBe("ERROR");
    expect(result.current.state.error).toMatch(/otra tarjeta/);
  });

  it("volver a verificar desde PAYMENT_PENDING activa cuando el cobro ya se aplicó", async () => {
    const { result } = setup();
    mocked.fetchMySubscription.mockResolvedValue(active);

    await act(() => result.current.checkPaymentAgain());

    expect(result.current.state.step).toBe("DONE");
  });
});
