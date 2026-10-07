/**
 * Tests: LoginForm · ingreso de partners sin Company
 *
 * Comportamiento verificado:
 * 1. Con Company el flujo no cambia y no se consulta Partners.
 * 2. Sin Company y con suscripción activa se sigue creando la empresa.
 * 3. Sin Company ni suscripción activa:
 *    - un partner (activo, inactivo o suspendido) entra al portal, que muestra su estado;
 *    - un usuario sin perfil de partner conserva el flujo anterior (/subscriptions);
 *    - si /me no se pudo verificar (401, 429, 5xx), no se lo trata como "no es partner".
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPartnerLoginStatus,
  type PartnerLoginStatus,
} from "@/features/partners/services/get-partner-login-status";
import LoginForm from "../LoginForm";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { ...actual, __esModule: true, default: { ...actual.default, post: jest.fn() } };
});

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));

jest.mock("@/features/partners/services/get-partner-login-status", () => ({
  getPartnerLoginStatus: jest.fn(),
}));

jest.mock("../../modals/forgotPasswortModal", () => ({
  __esModule: true,
  default: () => null,
}));

const mockPost = jest.mocked(axios.post);
const mockUseAuth = jest.mocked(useAuth);
const mockGetPartnerLoginStatus = jest.mocked(getPartnerLoginStatus);
const mockLogin = jest.fn();

interface LoginResult {
  company: unknown;
  subscription: { status: string } | null;
}

function setupLogin(result: LoginResult) {
  mockPost.mockResolvedValue({ data: { accessToken: "new-token" } });
  mockLogin.mockResolvedValue({ accessToken: "new-token", user: {}, exp: 0, ...result });
}

async function submitLogin() {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText(/correo electrónico/i), "partner@example.com");
  await user.type(screen.getByLabelText(/^contraseña$/i), "secret");
  await user.click(screen.getByRole("button", { name: /ingresar/i }));
}

beforeEach(() => {
  mockPush.mockReset();
  mockPost.mockReset();
  mockLogin.mockReset();
  mockGetPartnerLoginStatus.mockReset();
  mockUseAuth.mockReturnValue({
    auth: null,
    login: mockLogin,
    inventories: [],
  } as unknown as ReturnType<typeof useAuth>);
});

describe("LoginForm · partners sin Company", () => {
  it("con Company va al inicio y no consulta Partners", async () => {
    setupLogin({ company: { id: "c1" }, subscription: null });

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    expect(mockGetPartnerLoginStatus).not.toHaveBeenCalled();
  });

  it("sin Company y con suscripción activa sigue a crear la empresa", async () => {
    setupLogin({ company: null, subscription: { status: "ACTIVE" } });

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/new-company"));
    expect(mockGetPartnerLoginStatus).not.toHaveBeenCalled();
  });

  it("un partner sin Company entra al portal usando el token recién emitido", async () => {
    setupLogin({ company: null, subscription: null });
    mockGetPartnerLoginStatus.mockResolvedValue("partner");

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/partners"));
    expect(mockGetPartnerLoginStatus).toHaveBeenCalledWith("new-token");
    expect(mockPush).not.toHaveBeenCalledWith("/subscriptions");
  });

  it("un usuario sin perfil de partner conserva el flujo anterior", async () => {
    setupLogin({ company: null, subscription: null });
    mockGetPartnerLoginStatus.mockResolvedValue("not_partner");

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/subscriptions"));
    expect(mockPush).not.toHaveBeenCalledWith("/partners");
  });

  it("si /me no se pudo verificar no lo trata como no-partner: el portal resuelve el estado", async () => {
    setupLogin({ company: null, subscription: { status: "CANCELLED" } });
    mockGetPartnerLoginStatus.mockResolvedValue("unknown" satisfies PartnerLoginStatus);

    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/partners"));
    expect(mockPush).not.toHaveBeenCalledWith("/subscriptions");
  });
});
