import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingFlow } from "@/hooks/useOnboardingFlow";
import { getStoredOnboardingState } from "@/lib/onboardingStorage";
import type { OnboardingState, StoredOnboardingState } from "@/types/onboarding";
import CallbackClient from "../CallbackClient";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useSearchParams: jest.fn(), useRouter: () => ({ push }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/useOnboardingFlow", () => ({ useOnboardingFlow: jest.fn() }));
jest.mock("@/lib/onboardingStorage", () => ({ getStoredOnboardingState: jest.fn() }));

const USER = "owner";
const TOKEN = "fixture-card-token";
const refreshSession = jest.fn().mockResolvedValue(true);
const confirmPayment = jest.fn().mockResolvedValue(undefined);
const checkPaymentAgain = jest.fn().mockResolvedValue(undefined);
const restoreFromStorage = jest.fn<void, [StoredOnboardingState]>();
let flowState: OnboardingState;

const stored: StoredOnboardingState = {
  userId: USER,
  cardToken: TOKEN,
  subscriptionId: "s1",
  planId: "basic",
  planName: "Basic",
  price: 99,
  addOnIds: [],
  migrate: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  flowState = {
    step: "CONFIRMING",
    planId: "basic",
    planName: "Basic",
    price: 99,
    addOnIds: [],
    userId: USER,
    cardToken: TOKEN,
    redirectUrl: null,
    subscription: null,
    error: null,
    isLoading: false,
  };
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: USER }, company: { id: "c1" }, subscription: null },
    loading: false,
    login: jest.fn(),
    refreshSession,
  } as unknown as ReturnType<typeof useAuth>);
  const search = new URLSearchParams();
  search.set("token", TOKEN);
  jest.mocked(useSearchParams).mockReturnValue(search as unknown as ReturnType<typeof useSearchParams>);
  jest.mocked(getStoredOnboardingState).mockReturnValue(stored);
  jest.mocked(useOnboardingFlow).mockImplementation(() => ({
    state: flowState,
    setPlan: jest.fn(),
    selectAddOns: jest.fn(),
    register: jest.fn(),
    resumeSession: jest.fn(),
    initiateCardRegistration: jest.fn(),
    confirmPayment,
    checkPaymentAgain,
    restoreFromStorage,
    retry: jest.fn(),
    goBack: jest.fn(),
    setError: jest.fn(),
  }));
});

it("al volver de Flow restaura el checkout con la marca de migración", async () => {
  render(<CallbackClient />);

  await waitFor(() => expect(restoreFromStorage).toHaveBeenCalledWith(expect.objectContaining({ migrate: true, cardToken: TOKEN })));
});

it("muestra el éxito de la migración programada y vuelve a Powip", async () => {
  flowState = { ...flowState, step: "MIGRATION_SCHEDULED", migrate: true, firstChargeDate: "2026-10-29" };
  render(<CallbackClient />);

  expect(await screen.findByRole("heading", { name: "¡Listo, ya estás en Flow!" })).toBeInTheDocument();
  expect(screen.getByText("Tu primer cobro es el jueves 29/10. Hasta entonces sigues con tu plan actual.")).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ir a Powip" })); });
  expect(refreshSession).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith("/");
});

it("si la migración no se pudo completar, el link vuelve a la pantalla de migración", async () => {
  flowState = { ...flowState, step: "ERROR", error: "Este registro de tarjeta ya no es válido.", cardToken: null, migrate: true };
  render(<CallbackClient />);

  expect(await screen.findByRole("link", { name: "Elegir mi plan" })).toHaveAttribute("href", "/pasate-a-flow");
});

it("en el onboarding normal el link sigue yendo a /onboarding", async () => {
  flowState = { ...flowState, step: "ERROR", error: "Este registro de tarjeta ya no es válido.", cardToken: null };
  render(<CallbackClient />);

  expect(await screen.findByRole("link", { name: "Elegir mi plan" })).toHaveAttribute("href", "/onboarding");
});
