import { act, renderHook } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { toast } from "sonner";
import { getStoredOnboardingState } from "@/lib/onboardingStorage";
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

function apiPayloadError(status: number, data: unknown) {
  const response = {
    status,
    data,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return new AxiosError("error", String(status), undefined, undefined, response);
}

function apiError(status: number, code: string) {
  return apiPayloadError(status, { code });
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
      useOnboardingFlow(
        { planId: "p1", planName: "Basic", price: 99, initialUserId },
        login,
        onActivated,
      ),
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
    mocked.registerAccount.mockRejectedValue(apiError(409, "EMAIL_ALREADY_EXISTS"));
    const { result } = setup(null);

    await act(() => result.current.register(registerData));

    expect(result.current.state.step).toBe("REGISTRATION");
    expect(result.current.state.error).toMatch(/ya está registrado/);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      "No pudimos completar el registro",
      expect.objectContaining({
        id: "auth-feedback",
        description: result.current.state.error,
        duration: 6000,
        closeButton: true,
      }),
    );
  });

  it.each([null, undefined])("no avanza si AuthContext.login devuelve %s", async (session) => {
    mocked.registerAccount.mockResolvedValue({ userId: "u9" });
    mocked.loginAccount.mockResolvedValue({ accessToken: "jwt" });
    const { result, login } = setup(null);
    login.mockResolvedValueOnce(session);

    await act(() => result.current.register(registerData));

    expect(result.current.state).toMatchObject({
      step: "REGISTRATION",
      userId: null,
      isLoading: false,
    });
    expect(result.current.state.error).toMatch(/cuenta fue creada.*iniciar la sesión/i);
    expect(getStoredOnboardingState()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("no avanza si AuthContext.login falla después de crear la cuenta", async () => {
    mocked.registerAccount.mockResolvedValue({ userId: "u9" });
    mocked.loginAccount.mockResolvedValue({ accessToken: "jwt" });
    const { result, login } = setup(null);
    login.mockRejectedValueOnce(new Error("La sesión no pudo cargarse"));

    await act(() => result.current.register(registerData));

    expect(result.current.state.step).toBe("REGISTRATION");
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toMatch(/cuenta fue creada/);
  });

  it("tras registro exitoso y login401, reintenta solo login con la contraseña actual", async () => {
    mocked.registerAccount.mockResolvedValue({ userId: "u9" });
    mocked.loginAccount
      .mockRejectedValueOnce(apiError(401, "UNAUTHORIZED"))
      .mockResolvedValueOnce({ accessToken: "retry-jwt" });
    const { result, login } = setup(null);

    await act(() => result.current.register(registerData));
    expect(result.current.state.step).toBe("REGISTRATION");
    expect(result.current.state.error).toMatch(/cuenta fue creada/);
    expect(login).not.toHaveBeenCalled();

    await act(() =>
      result.current.register({ ...registerData, email: " ANA@TEST.PE ", password: "clave456" }),
    );

    expect(mocked.registerAccount).toHaveBeenCalledTimes(1);
    expect(mocked.loginAccount).toHaveBeenCalledTimes(2);
    expect(mocked.loginAccount).toHaveBeenLastCalledWith("ana@test.pe", "clave456");
    expect(login).toHaveBeenCalledWith({ accessToken: "retry-jwt" });
    expect(result.current.state).toMatchObject({ step: "ADDONS", userId: "u9", error: null });
    expect(localStorage.length).toBe(0);
  });

  it("un segundo intento simultáneo no duplica registro ni login", async () => {
    mocked.registerAccount.mockResolvedValue({ userId: "u9" });
    mocked.loginAccount.mockResolvedValue({ accessToken: "jwt" });
    const { result } = setup(null);

    await act(async () => {
      await Promise.all([
        result.current.register(registerData),
        result.current.register(registerData),
      ]);
    });

    expect(mocked.registerAccount).toHaveBeenCalledTimes(1);
    expect(mocked.loginAccount).toHaveBeenCalledTimes(1);
  });

  it.each([
    { message: 'User with email "ana@test.pe" already exists' },
    { error: "El correo electrónico ya existe." },
    { errorCode: "EMAIL_ALREADY_EXISTS" },
  ])(
    "interpreta el email duplicado legacy400 sin intentar iniciar una sesión desconocida (%j)",
    async (payload) => {
      mocked.registerAccount.mockRejectedValue(apiPayloadError(400, payload));
      const { result } = setup(null);

      await act(() => result.current.register(registerData));

      expect(result.current.state.step).toBe("REGISTRATION");
      expect(result.current.state.error).toMatch(/email ya está registrado/);
      expect(mocked.loginAccount).not.toHaveBeenCalled();
    },
  );

  it.each([
    { message: ["El teléfono debe tener 9 dígitos", "La dirección es obligatoria"] },
    {
      errors: [
        { defaultMessage: "El teléfono debe tener 9 dígitos" },
        { message: "La dirección es obligatoria" },
      ],
      error: "Bad Request",
    },
  ])(
    "convierte validaciones400 en texto y las distingue del email duplicado (%j)",
    async (payload) => {
      mocked.registerAccount.mockRejectedValue(apiPayloadError(400, payload));
      const { result } = setup(null);

      await act(() => result.current.register(registerData));

      expect(result.current.state.error).toBe(
        "El teléfono debe tener 9 dígitos. La dirección es obligatoria",
      );
      expect(result.current.state.step).toBe("REGISTRATION");
      expect(mocked.loginAccount).not.toHaveBeenCalled();
    },
  );

  it("no presenta un documento duplicado como email duplicado", async () => {
    mocked.registerAccount.mockRejectedValue(
      apiPayloadError(409, { code: "IDENTITY_DOCUMENT_ALREADY_EXISTS" }),
    );
    const { result } = setup(null);

    await act(() => result.current.register(registerData));

    expect(result.current.state.error).toMatch(/documento de identidad ya está registrado/);
    expect(result.current.state.error).not.toMatch(/email|correo/);
  });

  it("resumeSession usa una sesión llegada después del montaje sin crear otra cuenta", () => {
    const { result } = setup(null);
    act(() => result.current.resumeSession("existing-user"));

    expect(result.current.state).toMatchObject({
      step: "ADDONS",
      userId: "existing-user",
      error: null,
    });
    expect(mocked.registerAccount).not.toHaveBeenCalled();
    expect(mocked.loginAccount).not.toHaveBeenCalled();
    act(() => result.current.resumeSession("different-user"));
    expect(result.current.state.userId).toBe("existing-user");
  });

  it("resumeSession no interrumpe CARD_WIDGET ni reemplaza el usuario o el checkout", async () => {
    mocked.startFlowCheckout.mockResolvedValue({
      subscriptionId: "s1",
      status: "PENDING_PAYMENT",
      redirectUrl: "https://flow/x?token=tk",
      cardToken: "tk",
    });
    const { result } = setup();
    act(() => result.current.selectAddOns(["a1"]));
    await act(() => result.current.initiateCardRegistration());
    const before = result.current.state;

    act(() => result.current.resumeSession("another-user"));

    expect(result.current.state).toEqual(before);
  });

  it("resumeSession no salta un registro en curso", async () => {
    let finishRegistration!: (value: { userId: string }) => void;
    mocked.registerAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRegistration = resolve;
        }),
    );
    mocked.loginAccount.mockResolvedValue({ accessToken: "jwt" });
    const { result } = setup(null);
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.register(registerData);
    });

    act(() => result.current.resumeSession("another-user"));

    expect(result.current.state).toMatchObject({
      step: "REGISTRATION",
      userId: null,
      isLoading: true,
    });
    await act(async () => {
      finishRegistration({ userId: "u9" });
      await pending;
    });
    expect(result.current.state.userId).toBe("u9");
  });

  it("resumeSession no cambia un flujo terminado", async () => {
    mocked.fetchMySubscription.mockResolvedValue(active);
    const { result } = setup();
    await act(() => result.current.checkPaymentAgain());
    const before = result.current.state;

    act(() => result.current.resumeSession("another-user"));

    expect(result.current.state.step).toBe("DONE");
    expect(result.current.state).toEqual(before);
  });

  it("checkout guarda el token para sobrevivir a la redirección y abre el widget", async () => {
    mocked.startFlowCheckout.mockResolvedValue({
      subscriptionId: "s1",
      status: "PENDING_PAYMENT",
      redirectUrl: "https://flow/x?token=tk",
      cardToken: "tk",
    });
    const { result } = setup();
    act(() => result.current.selectAddOns(["a1"]));

    await act(() => result.current.initiateCardRegistration());

    expect(mocked.startFlowCheckout).toHaveBeenCalledWith("p1", ["a1"]);
    expect(result.current.state.step).toBe("CARD_WIDGET");
    expect(getStoredOnboardingState()).toMatchObject({ cardToken: "tk", addOnIds: ["a1"] });
  });

  it("setPlan cambia el plan elegido y el checkout cobra ese plan", async () => {
    mocked.startFlowCheckout.mockResolvedValue({
      subscriptionId: "s1",
      status: "PENDING_PAYMENT",
      redirectUrl: "u",
      cardToken: "tk",
    });
    const { result } = setup();

    act(() => result.current.setPlan({ id: "p2", name: "Medium Anual", price: 1399 }));
    expect(result.current.state).toMatchObject({
      planId: "p2",
      planName: "Medium Anual",
      price: 1399,
    });

    act(() => result.current.selectAddOns([]));
    await act(() => result.current.initiateCardRegistration());

    expect(mocked.startFlowCheckout).toHaveBeenCalledWith("p2", []);
    expect(getStoredOnboardingState()).toMatchObject({
      planId: "p2",
      planName: "Medium Anual",
      price: 1399,
    });
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
    mocked.startFlowCheckout.mockResolvedValue({
      subscriptionId: "s1",
      status: "PENDING_PAYMENT",
      redirectUrl: "u",
      cardToken: "tk",
    });
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
