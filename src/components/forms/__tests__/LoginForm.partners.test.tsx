/**
 * Tests: LoginForm · ingreso de partners sin Company
 *
 * Comportamiento verificado:
 * 1. Con Company el flujo no cambia y no se consulta Partners.
 * 2. Sin Company y con suscripción activa se sigue creando la empresa.
 * 3. Sin Company ni suscripción activa:
 *    - un partner (activo, inactivo o suspendido) entra al portal, que muestra su estado;
 *    - un usuario sin perfil de partner conserva el flujo anterior (/sin-plan);
 *    - un estado desconocido (401, 429, 5xx, red o configuración) no confirma
 *      un partner: conserva /sin-plan sin cambiar la clasificación del servicio.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { API } from "@/lib/api";
import { toast } from "sonner";
import {
  getPartnerLoginStatus,
  type PartnerLoginStatus,
} from "@/features/partners/services/get-partner-login-status";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import LoginForm from "../LoginForm";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { ...actual, __esModule: true, default: { ...actual.default, post: jest.fn(), get: jest.fn() } };
});

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.test/v1/partners" },
}));

jest.mock("@/features/partners/services/get-partner-login-status", () => ({
  getPartnerLoginStatus: jest.fn(),
}));

jest.mock("../../modals/forgotPasswortModal", () => ({
  __esModule: true,
  default: () => null,
}));

const mockPost = jest.mocked(axios.post);
const mockGet = jest.mocked(axios.get);
const mockUseAuth = jest.mocked(useAuth);
const mockGetPartnerLoginStatus = jest.mocked(getPartnerLoginStatus);
const mockLogin = jest.fn();

interface LoginResult {
  company: unknown;
  subscription: { status: string } | null;
  user?: { companyId?: string };
}

function setupLogin(result: LoginResult) {
  mockPost.mockResolvedValue({ data: { accessToken: "new-token" } });
  mockLogin.mockResolvedValue({ accessToken: "new-token", user: {}, exp: 0, ...result });
}

async function submitLogin(fakeTimers = false) {
  const user = userEvent.setup(fakeTimers ? { advanceTimers: jest.advanceTimersByTime } : {});
  render(<LoginForm />);
  await user.type(screen.getByLabelText(/correo electrónico/i), "partner@example.com");
  await user.type(screen.getByLabelText(/^contraseña$/i), "secret");
  await user.click(screen.getByRole("button", { name: /ingresar/i }));
}

beforeEach(() => {
  mockPush.mockReset();
  mockPost.mockReset();
  mockGet.mockReset();
  mockLogin.mockReset();
  mockGetPartnerLoginStatus.mockReset();
  jest.mocked(toast.error).mockClear();
  API.partners = "https://partners.test/v1/partners";
  mockUseAuth.mockReturnValue({
    auth: null,
    login: mockLogin,
    inventories: [],
  } as unknown as ReturnType<typeof useAuth>);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function useRealPartnerLookup() {
  const service = jest.requireActual<
    typeof import("@/features/partners/services/get-partner-login-status")
  >("@/features/partners/services/get-partner-login-status");
  mockGetPartnerLoginStatus.mockImplementation(service.getPartnerLoginStatus);
}

describe("LoginForm · partners sin Company", () => {
  it("la recuperación inline conserva el callback de main sin consultar Partners ni navegar", async () => {
    setupLogin({ company: null, subscription: null });
    mockGetPartnerLoginStatus.mockResolvedValue("partner");
    const onAuthenticated = jest.fn();
    const user = userEvent.setup();
    render(<LoginForm onAuthenticated={onAuthenticated} />);
    await user.type(screen.getByLabelText(/correo electrónico/i), "partner@fixture.invalid");
    await user.type(screen.getByLabelText(/^contraseña$/i), "synthetic-only");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockGetPartnerLoginStatus).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("con Company va al inicio y no consulta Partners", async () => {
    setupLogin({ company: { id: "c1" }, subscription: null });
    mockGetPartnerLoginStatus.mockResolvedValue("unknown");

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    expect(mockGetPartnerLoginStatus).not.toHaveBeenCalled();
  });

  it.each(["ACTIVE", "PENDING_RENEWAL"])("sin Company y con plan %s sigue a crear la empresa", async (status) => {
    setupLogin({ company: null, subscription: { status } });
    mockGetPartnerLoginStatus.mockResolvedValue("partner");

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/new-company"));
    expect(mockGetPartnerLoginStatus).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith("/partners");
  });

  it("Company mantiene prioridad incluso con suscripción activa y perfil partner", async () => {
    setupLogin({ company: { id: "c1" }, subscription: { status: "ACTIVE" } });
    mockGetPartnerLoginStatus.mockResolvedValue("partner");

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockGetPartnerLoginStatus).not.toHaveBeenCalled();
  });

  it("companyId del usuario mantiene el dashboard aunque Company no esté cargada", async () => {
    setupLogin({ company: null, user: { companyId: "staff-company" }, subscription: null });
    mockGetPartnerLoginStatus.mockResolvedValue("partner");

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockGetPartnerLoginStatus).not.toHaveBeenCalled();
  });

  it("un partner sin Company entra al portal usando el token recién emitido", async () => {
    setupLogin({ company: null, subscription: null });
    mockGetPartnerLoginStatus.mockResolvedValue("partner");

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/partners"));
    expect(mockGetPartnerLoginStatus).toHaveBeenCalledWith("new-token");
    expect(mockPush).not.toHaveBeenCalledWith("/sin-plan");
  });

  it("un usuario sin perfil de partner conserva el flujo anterior", async () => {
    setupLogin({ company: null, subscription: null });
    mockGetPartnerLoginStatus.mockResolvedValue("not_partner");

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/sin-plan"));
    expect(mockPush).not.toHaveBeenCalledWith("/partners");
  });

  it.each([
    ["caída 503", buildAxiosError(503)],
    ["error de red", buildAxiosError()],
    ["sesión no verificable", buildAxiosError(401)],
  ])(
    "%s: unknown conserva sin-plan y nunca confirma acceso al portal",
    async (_label, error) => {
      setupLogin({ company: null, subscription: { status: "CANCELLED" } });
      useRealPartnerLookup();
      mockGet.mockRejectedValue(error);

      await submitLogin();

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/sin-plan"));
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalledWith("/partners");
      expect(toast.error).not.toHaveBeenCalled();
    },
  );

  it("estado unknown explícito no confirma acceso a Partners", async () => {
    setupLogin({ company: null, subscription: null });
    mockGetPartnerLoginStatus.mockResolvedValue("unknown" satisfies PartnerLoginStatus);

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/sin-plan"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalledWith("/partners");
  });

  it("configuración Partners no definida conserva sin-plan sin consultar una URL relativa", async () => {
    setupLogin({ company: null, subscription: null });
    API.partners = ""; // El source API convierte NEXT_PUBLIC_API_PARTNERS undefined en "".
    mockGetPartnerLoginStatus.mockResolvedValue("partner");

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/sin-plan"));
    expect(mockGetPartnerLoginStatus).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith("/partners");
  });

  it("un rechazo inesperado de Partners no convierte un login válido en error de credenciales", async () => {
    setupLogin({ company: null, subscription: null });
    mockGetPartnerLoginStatus.mockRejectedValue(new Error("Synthetic optional lookup failure"));

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/sin-plan"));
    expect(toast.error).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith("/partners");
  });

  it.each(["PENDING_PAYMENT", "CANCELLED", "EXPIRED"])(
    "partner confirmado con suscripción %s puede consultar su portal",
    async (status) => {
      setupLogin({ company: null, subscription: { status } });
      mockGetPartnerLoginStatus.mockResolvedValue("partner");

      await submitLogin();

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/partners"));
      expect(mockGetPartnerLoginStatus).toHaveBeenCalledWith("new-token");
      expect(mockPush).not.toHaveBeenCalledWith("/sin-plan");
    },
  );

  it.each(["APPLIED", "SUSPENDED", "REJECTED"])(
    "403 PARTNER_NOT_ACTIVE confirmado (%s) sigue entrando al portal para consultar su estado",
    async (status) => {
      setupLogin({ company: null, subscription: null });
      useRealPartnerLookup();
      mockGet.mockRejectedValue(buildAxiosError(403, {
        code: "PARTNER_NOT_ACTIVE", details: { status },
      }));

      await submitLogin();

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/partners"));
      expect(mockPush).not.toHaveBeenCalledWith("/sin-plan");
    },
  );

  it("limita la consulta a cinco segundos y una respuesta partner tardía no vuelve a navegar", async () => {
    jest.useFakeTimers();
    const setTimer = jest.spyOn(globalThis, "setTimeout");
    const clearTimer = jest.spyOn(globalThis, "clearTimeout");
    setupLogin({ company: null, subscription: null });
    let completeLookup!: (status: PartnerLoginStatus) => void;
    mockGetPartnerLoginStatus.mockImplementation(() => new Promise<PartnerLoginStatus>((resolve) => { completeLookup = resolve; }));

    await submitLogin(true);

    expect(mockGetPartnerLoginStatus).toHaveBeenCalledWith("new-token");
    const deadlineCall = setTimer.mock.calls.findIndex((call) => call[1] === 5_000);
    expect(deadlineCall).toBeGreaterThanOrEqual(0);
    const deadline = setTimer.mock.results[deadlineCall].value;
    await act(async () => { jest.advanceTimersByTime(4_999); });
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(mockPush).toHaveBeenCalledWith("/sin-plan");
    expect(screen.getByRole("button", { name: /ingresar/i })).toBeEnabled();

    await act(async () => { completeLookup("partner"); });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalledWith("/partners");
    expect(clearTimer).toHaveBeenCalledWith(deadline);
  });

  it.each(["resolved", "rejected"])("limpia el deadline cuando la consulta %s antes de cinco segundos", async (outcome) => {
    jest.useFakeTimers();
    setupLogin({ company: null, subscription: null });
    if (outcome === "resolved") mockGetPartnerLoginStatus.mockResolvedValue("partner");
    else mockGetPartnerLoginStatus.mockRejectedValue(new Error("Synthetic lookup rejection"));

    await submitLogin(true);

    expect(mockPush).toHaveBeenCalledWith(outcome === "resolved" ? "/partners" : "/sin-plan");
    expect(jest.getTimerCount()).toBe(0);
    await act(async () => { jest.advanceTimersByTime(5_000); });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
