import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingFlow } from "@/hooks/useOnboardingFlow";
import { getStoredOnboardingState } from "@/lib/onboardingStorage";
import type { OnboardingState, StoredOnboardingState, SubscriptionMe } from "@/types/onboarding";
import CallbackClient from "../CallbackClient";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/useOnboardingFlow", () => ({ useOnboardingFlow: jest.fn() }));
jest.mock("@/lib/onboardingStorage", () => ({ getStoredOnboardingState: jest.fn() }));
jest.mock("@/components/auth/AuthLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock("@/components/auth/AuthPanel", () => ({
  __esModule: true,
  default: ({ notice, onAuthenticated }: { notice?: ReactNode; onAuthenticated?: () => void }) => (
    <section aria-label="Retomar sesión">
      {notice}
      <button type="button" onClick={onAuthenticated}>
        Iniciar sesión aquí
      </button>
    </section>
  ),
}));
jest.mock("@/components/onboarding/SubscriptionSuccess", () => ({
  __esModule: true,
  default: () => <p>Suscripción activada</p>,
}));

const USER = "callback-user";
const TOKEN = "fixture-card-token";
const login = jest.fn();
const refreshSession = jest.fn<Promise<boolean>, []>();
const confirmPayment = jest.fn<Promise<void>, []>();
const checkPaymentAgain = jest.fn<Promise<void>, []>();
const initiateCardRegistration = jest.fn<Promise<void>, []>();
const restoreFromStorage = jest.fn<void, [StoredOnboardingState]>();

let flowState: OnboardingState;

function activeSubscription(status: "ACTIVE" | "PENDING_RENEWAL" = "ACTIVE"): SubscriptionMe {
  return {
    id: "fixture-subscription",
    status,
    gateway: "FLOW",
    autoRenewal: true,
    startDate: "2026-10-13",
    endDate: "2026-11-13",
    plan: { id: "medium", name: "Medium", price: 189, durationInDays: 30 },
    addOns: [],
  };
}

function storedCheckout(overrides: Partial<StoredOnboardingState> = {}): StoredOnboardingState {
  return {
    userId: USER,
    cardToken: TOKEN,
    planId: "medium",
    planName: "Medium",
    price: 189,
    addOnIds: ["courier"],
    ...overrides,
  };
}

function setSession({
  userId = USER,
  loading = false,
  subscription = null,
}: {
  userId?: string | null;
  loading?: boolean;
  subscription?: SubscriptionMe | null;
} = {}) {
  const value: ReturnType<typeof useAuth> = {
    auth: userId
      ? {
          accessToken: "fixture-access-token",
          user: { id: userId, email: "callback@fixture.invalid", role: "USUARIO", permissions: [] },
          company: null,
          subscription,
          exp: 9999999999,
        }
      : null,
    loading,
    login,
    refreshSession,
    logout: jest.fn(),
    updateCompany: jest.fn(),
    selectedStoreId: null,
    setSelectedStore: jest.fn(),
    inventories: [],
    refreshInventories: jest.fn(async () => undefined),
    hasPermission: jest.fn(() => false),
    refreshSubscription: jest.fn(async () => undefined),
  };
  jest.mocked(useAuth).mockReturnValue(value);
}

function setToken(token: string | null = TOKEN) {
  const search = new URLSearchParams();
  if (token !== null) search.set("token", token);
  jest.mocked(useSearchParams).mockReturnValue(search as ReturnType<typeof useSearchParams>);
}

beforeEach(() => {
  jest.clearAllMocks();
  flowState = {
    step: "REGISTRATION",
    planId: "",
    planName: "",
    price: 0,
    addOnIds: [],
    userId: null,
    cardToken: null,
    redirectUrl: null,
    subscription: null,
    error: null,
    isLoading: false,
  };
  refreshSession.mockResolvedValue(true);
  confirmPayment.mockResolvedValue(undefined);
  checkPaymentAgain.mockResolvedValue(undefined);
  initiateCardRegistration.mockResolvedValue(undefined);
  restoreFromStorage.mockImplementation((stored) => {
    flowState = { ...flowState, ...stored };
  });
  jest.mocked(getStoredOnboardingState).mockReturnValue(null);
  jest.mocked(useOnboardingFlow).mockImplementation(() => ({
    state: flowState,
    setPlan: jest.fn(),
    selectAddOns: jest.fn(),
    register: jest.fn(),
    resumeSession: jest.fn(),
    initiateCardRegistration,
    confirmPayment,
    checkPaymentAgain,
    restoreFromStorage,
    retry: jest.fn(),
    goBack: jest.fn(),
    setError: jest.fn(),
  }));
  setSession();
  setToken();
});

it("espera la recuperación de sesión antes de leer el checkout o confirmar la tarjeta", async () => {
  setSession({ loading: true });
  const page = render(<CallbackClient />);
  expect(getStoredOnboardingState).not.toHaveBeenCalled();
  expect(restoreFromStorage).not.toHaveBeenCalled();
  expect(confirmPayment).not.toHaveBeenCalled();

  setSession();
  page.rerender(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  expect(getStoredOnboardingState).toHaveBeenCalledWith(USER);
});

it("permite iniciar sesión dentro del callback y retoma el token recibido sin abandonarlo", async () => {
  setSession({ userId: null });
  const page = render(<CallbackClient />);
  expect(screen.getByRole("button", { name: "Iniciar sesión aquí" })).toBeInTheDocument();
  expect(confirmPayment).not.toHaveBeenCalled();
  expect(restoreFromStorage).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión aquí" }));
  setSession();
  page.rerender(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  expect(restoreFromStorage).toHaveBeenCalledWith(
    expect.objectContaining({ userId: USER, cardToken: TOKEN }),
  );
});

it("restaura el checkout de la cuenta autenticada y confirma una sola vez entre rerenders", async () => {
  const stored = storedCheckout({ subscriptionId: "matching-checkout" });
  jest.mocked(getStoredOnboardingState).mockReturnValue(stored);
  const page = render(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  expect(restoreFromStorage).toHaveBeenCalledWith(stored);
  expect(getStoredOnboardingState).toHaveBeenCalledWith(USER);

  setSession();
  page.rerender(<CallbackClient />);
  page.rerender(<CallbackClient />);
  expect(confirmPayment).toHaveBeenCalledTimes(1);
  expect(restoreFromStorage).toHaveBeenCalledTimes(1);
});

it("el token de la URL prevalece y no reutiliza el plan de otro checkout", async () => {
  jest.mocked(getStoredOnboardingState).mockReturnValue(
    storedCheckout({
      cardToken: "old-card-token",
      subscriptionId: "different-checkout",
      planId: "large",
      planName: "Large",
      price: 269,
    }),
  );
  render(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  expect(restoreFromStorage).toHaveBeenCalledWith({
    userId: USER,
    cardToken: TOKEN,
    planId: "",
    planName: "",
    price: 0,
    addOnIds: [],
  });
});

it("fija el propietario desde la sesión aunque el almacenamiento recibido contenga otro usuario", async () => {
  jest.mocked(getStoredOnboardingState).mockReturnValue(storedCheckout({ userId: "other-user" }));
  render(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  expect(getStoredOnboardingState).toHaveBeenCalledWith(USER);
  expect(restoreFromStorage).toHaveBeenCalledWith(
    expect.objectContaining({ userId: USER, cardToken: TOKEN }),
  );
});

it("usa el token guardado de la cuenta si Flow vuelve sin token en la URL", async () => {
  setToken(null);
  jest.mocked(getStoredOnboardingState).mockReturnValue(storedCheckout());
  render(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  expect(restoreFromStorage).toHaveBeenCalledWith(storedCheckout());
  expect(checkPaymentAgain).not.toHaveBeenCalled();
});

it("no confirma un token antiguo hasta que el hook refleje el token y usuario actuales", async () => {
  flowState = { ...flowState, userId: "other-user", cardToken: "old-card-token" };
  restoreFromStorage.mockImplementation(() => undefined);
  const page = render(<CallbackClient />);
  expect(restoreFromStorage).toHaveBeenCalledWith(
    expect.objectContaining({ userId: USER, cardToken: TOKEN }),
  );
  expect(confirmPayment).not.toHaveBeenCalled();

  flowState = { ...flowState, userId: USER, cardToken: "old-card-token" };
  page.rerender(<CallbackClient />);
  expect(confirmPayment).not.toHaveBeenCalled();

  flowState = { ...flowState, cardToken: TOKEN };
  page.rerender(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
});

it("descarta el intento de otra cuenta cuando cambia la sesión durante la recuperación", async () => {
  restoreFromStorage.mockImplementation(() => undefined);
  const page = render(<CallbackClient />);
  expect(confirmPayment).not.toHaveBeenCalled();

  setSession({ userId: "new-user" });
  page.rerender(<CallbackClient />);
  expect(getStoredOnboardingState).toHaveBeenLastCalledWith("new-user");
  expect(restoreFromStorage).toHaveBeenLastCalledWith(
    expect.objectContaining({ userId: "new-user", cardToken: TOKEN }),
  );

  flowState = { ...flowState, userId: USER, cardToken: TOKEN };
  page.rerender(<CallbackClient />);
  expect(confirmPayment).not.toHaveBeenCalled();

  flowState = { ...flowState, userId: "new-user" };
  page.rerender(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
});

it("un nuevo token del callback inicia su propia confirmación y no repite la anterior", async () => {
  const page = render(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  setToken("new-card-token");
  page.rerender(<CallbackClient />);
  expect(restoreFromStorage).toHaveBeenLastCalledWith(
    expect.objectContaining({ userId: USER, cardToken: "new-card-token" }),
  );
  page.rerender(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(2));
  page.rerender(<CallbackClient />);
  expect(confirmPayment).toHaveBeenCalledTimes(2);
});

it.each(["ACTIVE", "PENDING_RENEWAL"] as const)(
  "recupera una suscripción %s sin token mediante /me sin crear otro checkout",
  async (status) => {
    setToken(null);
    setSession({ subscription: activeSubscription(status) });
    const page = render(<CallbackClient />);
    await waitFor(() => expect(checkPaymentAgain).toHaveBeenCalledTimes(1));
    page.rerender(<CallbackClient />);
    expect(checkPaymentAgain).toHaveBeenCalledTimes(1);
    expect(confirmPayment).not.toHaveBeenCalled();
    expect(restoreFromStorage).not.toHaveBeenCalled();
    expect(initiateCardRegistration).not.toHaveBeenCalled();
  },
);

it("muestra un plan existente recuperado sin token sin anunciar un pago nuevo", async () => {
  setToken(null);
  setSession({ subscription: activeSubscription() });
  flowState = {
    ...flowState,
    step: "EXISTING_SUBSCRIPTION",
    subscription: activeSubscription(),
  };
  render(<CallbackClient />);
  await screen.findByRole("heading", { name: "Ya tienes una suscripción vigente" });
  expect(screen.queryByText("Suscripción activada")).not.toBeInTheDocument();
  expect(screen.queryByText("Pagado")).not.toBeInTheDocument();
  expect(refreshSession).not.toHaveBeenCalled();
  expect(confirmPayment).not.toHaveBeenCalled();
});

it("distingue un checkout ausente de una sesión expirada y ofrece elegir el plan", () => {
  setToken(null);
  render(<CallbackClient />);
  expect(
    screen.getByRole("heading", { name: "No encontramos un pago para continuar" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Elegir mi plan" })).toHaveAttribute(
    "href",
    "/onboarding",
  );
  expect(screen.queryByRole("button", { name: "Iniciar sesión aquí" })).not.toBeInTheDocument();
  expect(confirmPayment).not.toHaveBeenCalled();
  expect(checkPaymentAgain).not.toHaveBeenCalled();
  expect(initiateCardRegistration).not.toHaveBeenCalled();
});

it("retoma la verificación cuando el plan de la misma cuenta se activa después de mostrar checkout ausente", async () => {
  setToken(null);
  const page = render(<CallbackClient />);
  expect(
    screen.getByRole("heading", { name: "No encontramos un pago para continuar" }),
  ).toBeInTheDocument();
  expect(checkPaymentAgain).not.toHaveBeenCalled();

  setSession({ subscription: activeSubscription() });
  page.rerender(<CallbackClient />);
  await waitFor(() => expect(checkPaymentAgain).toHaveBeenCalledTimes(1));
  expect(
    screen.queryByRole("heading", { name: "No encontramos un pago para continuar" }),
  ).not.toBeInTheDocument();

  setSession({ subscription: activeSubscription() });
  page.rerender(<CallbackClient />);
  page.rerender(<CallbackClient />);
  expect(checkPaymentAgain).toHaveBeenCalledTimes(1);
  expect(confirmPayment).not.toHaveBeenCalled();
  expect(initiateCardRegistration).not.toHaveBeenCalled();
  expect(restoreFromStorage).not.toHaveBeenCalled();
});

it("reintenta la confirmación fallida con el mismo token sin recrear el checkout", async () => {
  const page = render(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  flowState = { ...flowState, step: "ERROR", error: "No pudimos confirmar la tarjeta." };
  page.rerender(<CallbackClient />);
  confirmPayment.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar confirmación" }));
  expect(confirmPayment).toHaveBeenCalledTimes(1);
  expect(checkPaymentAgain).not.toHaveBeenCalled();
  expect(restoreFromStorage).toHaveBeenCalledTimes(1);
  expect(initiateCardRegistration).not.toHaveBeenCalled();
});

it("si el plan ya está activo reintenta la sesión verificando /me en lugar de volver a confirmar", async () => {
  const page = render(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  flowState = {
    ...flowState,
    step: "ERROR",
    subscription: activeSubscription(),
    error: "Tu plan está activo, pero no pudimos actualizar tu sesión.",
  };
  page.rerender(<CallbackClient />);
  confirmPayment.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Volver a verificar" }));
  expect(checkPaymentAgain).toHaveBeenCalledTimes(1);
  expect(confirmPayment).not.toHaveBeenCalled();
  expect(initiateCardRegistration).not.toHaveBeenCalled();
});

it("un token descartado ofrece elegir el plan y no intenta confirmar ni crear otro pago", async () => {
  const page = render(<CallbackClient />);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  flowState = {
    ...flowState,
    step: "ERROR",
    cardToken: null,
    error: "Este registro de tarjeta ya no es válido.",
  };
  page.rerender(<CallbackClient />);
  confirmPayment.mockClear();
  expect(screen.getByRole("link", { name: "Elegir mi plan" })).toHaveAttribute(
    "href",
    "/onboarding",
  );
  expect(screen.queryByRole("button", { name: "Reintentar confirmación" })).not.toBeInTheDocument();
  expect(confirmPayment).not.toHaveBeenCalled();
  expect(checkPaymentAgain).not.toHaveBeenCalled();
  expect(initiateCardRegistration).not.toHaveBeenCalled();
});

it.each([true, false])(
  "propaga refreshSession=%s al hook antes de mostrar la activación",
  async (refreshed) => {
    refreshSession.mockResolvedValue(refreshed);
    render(<CallbackClient />);
    const calls = jest.mocked(useOnboardingFlow).mock.calls;
    const onActivated = calls[calls.length - 1]?.[2];
    if (!onActivated) throw new Error("Callback de activación ausente");
    await expect(onActivated()).resolves.toBe(refreshed);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  },
);
