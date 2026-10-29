import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import OnboardingClient from "@/app/onboarding/OnboardingClient";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import * as onboardingService from "@/services/onboardingService";
import AppContainer from "../AppContainer";

let mockPathname = "/onboarding";
const mockUseAuth = jest.fn();
const mockPageMount = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/components/layout/Sidebar", () => ({ Sidebar: () => <nav /> }));
jest.mock("@/components/auth/AuthGuard", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/header/BusinessScopeBar", () => ({
  BusinessScopeBar: () => {
    const { useBusinessScope: useScope } = jest.requireActual("@/contexts/BusinessScopeContext");
    const { scope, setScope } = useScope();
    return (
      <button type="button" onClick={() => setScope(scope === "business" ? "store" : "business")}>
        Cambiar alcance
      </button>
    );
  },
}));
jest.mock("@/services/onboardingService", () => ({
  registerAccount: jest.fn(),
  loginAccount: jest.fn(),
  fetchPlans: jest.fn(),
  fetchAddOns: jest.fn(),
  startFlowCheckout: jest.fn(),
  confirmFlowCheckout: jest.fn(),
  fetchMySubscription: jest.fn(),
  apiErrorCode: jest.fn(),
}));
jest.mock("@/components/onboarding/FlowWidgetStep", () => ({
  __esModule: true,
  default: ({ token }: { token: string }) => <p>Tarjeta de prueba: {token}</p>,
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

function field(id: string) {
  const input = document.getElementById(id);
  if (!input) throw new Error(`Falta el campo de prueba: ${id}`);
  return input;
}

async function findPlanHeading() {
  const title = await screen.findByRole("heading", { name: "Configura tu cuenta", level: 1 });
  const content = title.closest("header")?.parentElement;
  if (!content) throw new Error("Falta el contenido de la suscripción");
  return within(content).findByRole("heading", { name: "Elige tu plan y empieza hoy", level: 2 });
}

function authFor(userId: string, companyId?: string) {
  return {
    accessToken: "synthetic-session",
    user: { id: userId, email: "session@fixture.invalid", role: "ADMINISTRADOR" },
    company: companyId
      ? { id: companyId, stores: [{ id: "store-a", name: "Tienda A" }] }
      : undefined,
  };
}

type TestAuth = ReturnType<typeof authFor>;
const TestSessionContext = createContext<{
  auth: TestAuth | null;
  login: (tokens: { accessToken: string }) => Promise<TestAuth>;
  refreshSession: () => Promise<void>;
  selectedStoreId: string;
} | null>(null);

function SessionHarness({
  children,
  initialAuth = null,
}: {
  children: ReactNode;
  initialAuth?: TestAuth | null;
}) {
  const [auth, setAuth] = useState(initialAuth);
  const login = useCallback(async () => {
    const nextAuth = authFor("registered-user");
    setAuth(nextAuth);
    return nextAuth;
  }, []);
  const value = useMemo(
    () => ({ auth, login, refreshSession: async () => {}, selectedStoreId: "store-a" }),
    [auth, login],
  );
  return (
    <TestSessionContext.Provider value={value}>
      <output data-testid="session-user">{auth?.user.id ?? "anonymous"}</output>
      <button type="button" onClick={() => void login()}>
        Autenticar sesión de prueba
      </button>
      <button
        type="button"
        onClick={() => setAuth(authFor(auth?.user.id ?? "registered-user", "other-company"))}
      >
        Cambiar empresa
      </button>
      <button type="button" onClick={() => setAuth(authFor("other-user", auth?.company?.id))}>
        Cambiar usuario
      </button>
      <button
        type="button"
        onClick={() =>
          setAuth((current) => (current ? { ...current, accessToken: "refreshed-session" } : null))
        }
      >
        Renovar sesión
      </button>
      <button type="button" onClick={() => setAuth(null)}>
        Cerrar sesión de prueba
      </button>
      <AppContainer>{children}</AppContainer>
    </TestSessionContext.Provider>
  );
}

function OnboardingPage() {
  useEffect(() => {
    mockPageMount();
  }, []);
  return <OnboardingClient />;
}

function StatefulView() {
  const [selected, setSelected] = useState(false);
  const { scope } = useBusinessScope();
  useEffect(() => {
    mockPageMount();
  }, []);
  return (
    <>
      <p>Alcance {scope}</p>
      <button type="button" onClick={() => setSelected(true)}>
        Seleccionar registro
      </button>
      {selected && <p>Registro seleccionado</p>}
    </>
  );
}

const service = onboardingService as jest.Mocked<typeof onboardingService>;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockPathname = "/onboarding";
  mockUseAuth.mockImplementation(() => useContext(TestSessionContext));
  service.registerAccount.mockResolvedValue({ userId: "registered-user" });
  service.loginAccount.mockResolvedValue({ accessToken: "synthetic-session" });
  service.fetchPlans.mockResolvedValue([
    { id: "basic", name: "Basic", price: 99, durationInDays: 30 },
    { id: "medium", name: "Medium", price: 189, durationInDays: 30 },
  ]);
  service.fetchAddOns.mockResolvedValue([]);
  service.fetchMySubscription.mockResolvedValue(null);
  service.startFlowCheckout.mockResolvedValue({
    subscriptionId: "synthetic-subscription",
    status: "PENDING_PAYMENT",
    redirectUrl: "https://flow.fixture.invalid/card",
    cardToken: "synthetic-card-token",
  });
});

it("conserva la página al crear la sesión y continúa registro → planes → tarjeta sin repetir la cuenta", async () => {
  const user = userEvent.setup();
  render(
    <SessionHarness>
      <OnboardingPage />
    </SessionHarness>,
  );
  for (const [id, value] of [
    ["register-name", "Prueba"],
    ["register-surname", "Integración"],
    ["register-document", "00000000"],
    ["register-phone", "999000001"],
  ]) {
    fireEvent.change(field(id), { target: { value } });
  }
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(field("register-district"), {
    target: { value: "Miraflores" },
  });
  fireEvent.change(field("register-address"), {
    target: { value: "Dirección de prueba 123" },
  });
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  for (const [id, value] of [
    ["register-email", "registration@fixture.invalid"],
    ["register-password", "synthetic123"],
    ["register-confirm", "synthetic123"],
  ]) {
    fireEvent.change(field(id), { target: { value } });
  }
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

  await waitFor(() =>
    expect(screen.getByTestId("session-user")).toHaveTextContent("registered-user"),
  );
  expect(mockPageMount).toHaveBeenCalledTimes(1);
  expect(service.registerAccount).toHaveBeenCalledTimes(1);
  expect(service.loginAccount).toHaveBeenCalledWith("registration@fixture.invalid", "synthetic123");
  await findPlanHeading();
  expect(screen.queryByLabelText("Nombre", { exact: true })).not.toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: /Standard/ }));
  await user.click(screen.getByRole("button", { name: "Continuar al pago" }));
  await user.click(screen.getByRole("button", { name: /Registrar.*tarjeta/i }));
  await screen.findByText("Tarjeta de prueba: synthetic-card-token");
  expect(service.startFlowCheckout).toHaveBeenCalledWith("medium", []);
  expect(service.registerAccount).toHaveBeenCalledTimes(1);
  expect(mockPageMount).toHaveBeenCalledTimes(1);
  expect(service.confirmFlowCheckout).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Renovar sesión" }));
  fireEvent.click(screen.getByRole("button", { name: "Cambiar empresa" }));
  expect(screen.getByText("Tarjeta de prueba: synthetic-card-token")).toBeInTheDocument();
  expect(service.startFlowCheckout).toHaveBeenCalledTimes(1);
  expect(mockPageMount).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Cambiar usuario" }));
  expect(screen.queryByText("Tarjeta de prueba: synthetic-card-token")).not.toBeInTheDocument();
  expect(mockPageMount).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión de prueba" }));
  expect(screen.queryByText("Tarjeta de prueba: synthetic-card-token")).not.toBeInTheDocument();
  expect(mockPageMount).toHaveBeenCalledTimes(3);
});

it.each(["/onboarding", "/onboarding/callback", "/login", "/restablecer-contrasena", "/configuracion/integraciones/publicidad/callback"])(
  "%s conserva el estado local durante autenticación y cambio de empresa",
  async (pathname) => {
    mockPathname = pathname;
    render(
      <SessionHarness>
        <StatefulView />
      </SessionHarness>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar registro" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Autenticar sesión de prueba" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar empresa" }));
    expect(screen.getByText("Registro seleccionado")).toBeInTheDocument();
    expect(mockPageMount).toHaveBeenCalledTimes(1);
  },
);

it.each(["/configuracion", "/onboarding-extra", "/configuracion/integraciones/publicidad/callback-extra", "/configuracion/integraciones/publicidad/callback/other"])(
  "%s sigue reiniciando la página al cambiar empresa, usuario y cerrar sesión",
  (pathname) => {
    mockPathname = pathname;
    render(
      <SessionHarness initialAuth={authFor("first-user", "first-company")}>
        <StatefulView />
      </SessionHarness>,
    );
    for (const transition of ["Cambiar empresa", "Cambiar usuario", "Cerrar sesión de prueba"]) {
      fireEvent.click(screen.getByRole("button", { name: "Seleccionar registro" }));
      fireEvent.click(screen.getByRole("button", { name: transition }));
      expect(screen.queryByText("Registro seleccionado")).not.toBeInTheDocument();
    }
    expect(mockPageMount).toHaveBeenCalledTimes(4);
  },
);

it.each(["/onboarding", "/onboarding/callback", "/login", "/restablecer-contrasena", "/configuracion/integraciones/publicidad/callback"])(
  "%s conserva refresh/empresa del mismo usuario y descarta datos al cambiar usuario o cerrar sesión",
  async (pathname) => {
    mockPathname = pathname;
    render(
      <SessionHarness initialAuth={authFor("first-user", "first-company")}>
        <StatefulView />
      </SessionHarness>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar registro" }));
    fireEvent.click(screen.getByRole("button", { name: "Renovar sesión" }));
    fireEvent.click(screen.getByRole("button", { name: "Cambiar empresa" }));
    expect(screen.getByText("Registro seleccionado")).toBeInTheDocument();
    expect(mockPageMount).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cambiar usuario" }));
    expect(screen.queryByText("Registro seleccionado")).not.toBeInTheDocument();
    expect(mockPageMount).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar registro" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión de prueba" }));
    expect(screen.queryByText("Registro seleccionado")).not.toBeInTheDocument();
    expect(mockPageMount).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole("button", { name: "Seleccionar registro" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Autenticar sesión de prueba" }));
    });
    expect(screen.getByText("Registro seleccionado")).toBeInTheDocument();
    expect(mockPageMount).toHaveBeenCalledTimes(3);
  },
);

it("las páginas de negocio mantienen el reinicio al cambiar su alcance", () => {
  mockPathname = "/operaciones";
  render(
    <SessionHarness initialAuth={authFor("first-user", "first-company")}>
      <StatefulView />
    </SessionHarness>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Seleccionar registro" }));
  fireEvent.click(screen.getByRole("button", { name: "Cambiar alcance" }));
  expect(screen.getByText("Alcance store")).toBeInTheDocument();
  expect(screen.queryByText("Registro seleccionado")).not.toBeInTheDocument();
  expect(mockPageMount).toHaveBeenCalledTimes(2);
});
