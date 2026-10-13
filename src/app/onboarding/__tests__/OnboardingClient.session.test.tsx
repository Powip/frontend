import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAddOns, fetchPlans, registerAccount } from "@/services/onboardingService";
import OnboardingClient from "../OnboardingClient";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/onboardingService", () => ({
  fetchAddOns: jest.fn(),
  fetchPlans: jest.fn(),
  registerAccount: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const session = {
  auth: { accessToken: "fixture-token", user: { id: "fixture-user" } },
  login: jest.fn(),
  refreshSession: jest.fn(),
};

function setSession(value: { auth: unknown; login?: unknown; refreshSession?: unknown }) {
  jest.mocked(useAuth).mockReturnValue(value as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchPlans).mockResolvedValue([
    { id: "basic", name: "Basic", price: 99, durationInDays: 30 },
    { id: "annual", name: "Basic Anual", price: 999, durationInDays: 365 },
  ]);
  jest.mocked(fetchAddOns).mockResolvedValue([]);
});

it("retoma el plan preseleccionado cuando la sesión se recupera después de montar la página", async () => {
  setSession({ ...session, auth: null });
  const page = render(<OnboardingClient planName="Basic Anual" />);
  expect(screen.getByRole("heading", { name: "Crea tu cuenta" })).toBeInTheDocument();

  setSession(session);
  page.rerender(<OnboardingClient planName="Basic Anual" />);

  await screen.findByRole("heading", { name: "Elige tu plan", level: 3 });
  await waitFor(() => expect(screen.getByText("S/ 999/año")).toBeInTheDocument());
  expect(registerAccount).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /^Continuar/ }));
  expect(screen.getByRole("heading", { name: "Resumen de tu suscripción" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Registrar tarjeta/ })).toBeInTheDocument();
  expect(registerAccount).not.toHaveBeenCalled();
});

it("una cuenta con sesión activa entra al plan sin mostrar otro formulario de registro", async () => {
  setSession(session);
  render(<OnboardingClient planName="Basic" />);

  await screen.findByRole("heading", { name: "Elige tu plan", level: 3 });
  expect(screen.queryByRole("heading", { name: "Crea tu cuenta" })).not.toBeInTheDocument();
  expect(registerAccount).not.toHaveBeenCalled();
});
