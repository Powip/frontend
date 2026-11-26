/** Retorno tras iniciar sesión: solo rutas internas y nunca tras «Cerrar sesión». */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import AuthGuard from "../AuthGuard";
import LoginForm from "@/components/forms/LoginForm";
import { useAuth } from "@/contexts/AuthContext";
import { markManualLogout, markSessionStarted, safeReturnPath } from "@/lib/sessionExpiry";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push, replace: jest.fn() }),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/modals/forgotPasswortModal", () => ({ __esModule: true, default: () => null }));

const login = jest.fn();

beforeEach(() => {
  push.mockReset();
  markSessionStarted();
  jest.spyOn(axios, "post").mockResolvedValue({ data: { accessToken: "new-token" } });
  login.mockResolvedValue({ accessToken: "new-token", user: {}, company: { id: "c" }, subscription: null });
  jest.mocked(useAuth).mockReturnValue({ auth: null, loading: false, login } as never);
});
afterEach(() => jest.restoreAllMocks());

describe("safeReturnPath", () => {
  it.each([
    "/ventas",
    "/registrar-venta?orderId=7&x=a%20b",
    "/inventario/almacenes#lista",
    "/partners",
  ])("acepta la ruta interna %s", (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example/ventas",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/..//evil.example",
    "/%2e%2e//evil.example",
    "javascript:alert(1)",
    "evil.example",
    " /ventas",
    "/",
    "/login",
    "/login?volver=/ventas",
    "/api/auth/logout",
    "",
    null,
  ])("rechaza %j", (path) => {
    expect(safeReturnPath(path)).toBeNull();
  });
});

async function signIn(search: string) {
  window.history.replaceState(null, "", `/login${search}`);
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText(/correo electrónico/i), "fixture@negocio.invalid");
  await user.type(screen.getByLabelText(/^contraseña$/i), "secret");
  await user.click(screen.getByRole("button", { name: /ingresar/i }));
}

describe("LoginForm · retorno", () => {
  it("vuelve a la ruta y query previas", async () => {
    await signIn(`?volver=${encodeURIComponent("/registrar-venta?orderId=7")}`);
    expect(push).toHaveBeenCalledWith("/registrar-venta?orderId=7");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example"])(
    "ignora el destino externo %s",
    async (target) => {
      await signIn(`?volver=${encodeURIComponent(target)}`);
      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/");
    },
  );

  it("sin empresa manda el flujo de plan, no el retorno", async () => {
    login.mockResolvedValue({ accessToken: "new-token", user: {}, company: null, subscription: { status: "ACTIVE" } });
    await signIn("?volver=%2Fventas");
    expect(push).not.toHaveBeenCalledWith("/ventas");
  });
});

describe("AuthGuard · destino al quedarse sin sesión", () => {
  const renderAt = (url: string) => {
    window.history.replaceState(null, "", url);
    render(<AuthGuard><p>privado</p></AuthGuard>);
  };

  it("guarda ruta y query", () => {
    renderAt("/ventas?estado=pendiente");
    expect(push).toHaveBeenCalledWith("/login?volver=%2Fventas%3Festado%3Dpendiente");
  });

  it("tras cerrar sesión a mano no guarda destino", () => {
    markManualLogout();
    renderAt("/ventas?estado=pendiente");
    expect(push).toHaveBeenCalledWith("/login");
  });
});
