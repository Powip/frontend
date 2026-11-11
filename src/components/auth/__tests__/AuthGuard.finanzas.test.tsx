/**
 * B1 · entrar a /finanzas por URL directa sin VIEW_FINANCES muestra "Acceso Denegado".
 * Los gates de plan y de preguntas de negocio se aíslan (devuelven null): aquí solo se
 * prueba el permiso de ruta que aplica AuthGuard con la configuración real.
 */
import { render, screen } from "@testing-library/react";
import AuthGuard from "../AuthGuard";
import { useAuth } from "@/contexts/AuthContext";

let mockPathname = "/finanzas";
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSession: Pick<ReturnType<typeof useAuth>, "auth" | "loading">;

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockSession }));
jest.mock("@/components/shared/PowipPulseLoader", () => ({
  PowipPulseLoader: () => <p>Cargando sesión</p>,
}));
jest.mock("@/lib/subscriptionGate", () => ({ resolveSubscriptionRedirect: () => null }));
jest.mock("@/lib/businessQuestionsGate", () => ({ resolveBusinessQuestionsRedirect: () => null }));

function sessionFor(role: string, permissions: string[], email = "fixture@negocio.invalid") {
  mockSession = {
    loading: false,
    auth: {
      accessToken: "synthetic-ui-fixture",
      exp: 0,
      user: { id: "fixture-user", email, role, permissions, companyId: "fixture-company" },
      company: null,
      subscription: null,
    },
  } as unknown as typeof mockSession;
}

function renderGuard(pathname: string) {
  mockPathname = pathname;
  return render(<AuthGuard><p>Contenido protegido</p></AuthGuard>);
}

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
});

describe.each(["/finanzas", "/finanzas/liquidaciones"])("AuthGuard · %s", (pathname) => {
  it.each([
    ["Ventas", "VENTAS", ["VIEW_SALES", "CREATE_SALE", "MANAGE_CLIENTS"]],
    ["Operaciones", "OPERACIONES", ["VIEW_SALES", "MANAGE_OPERATIONS", "MANAGE_PRODUCTS", "MANAGE_ALMACEN"]],
    ["CALLER (sin VIEW_FINANCES, como quedó en prod)", "CALLER", ["VIEW_SALES", "MANAGE_OPERATIONS", "MANAGE_INVENTORY"]],
  ])("%s ve Acceso Denegado y no el contenido", (_nombre, role, permissions) => {
    sessionFor(role, permissions);
    renderGuard(pathname);
    expect(screen.getByText("Acceso Denegado")).toBeInTheDocument();
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("el Administrador entra", () => {
    sessionFor("ADMINISTRADOR", ["VIEW_SALES", "VIEW_FINANCES", "APPROVE_PAYMENTS"]);
    renderGuard(pathname);
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(screen.queryByText("Acceso Denegado")).not.toBeInTheDocument();
  });

  it.each([
    ["un caller", "CALLER", ["VIEW_SALES", "MANAGE_OPERATIONS"]],
    ["Ventas", "VENTAS", ["VIEW_SALES", "CREATE_SALE"]],
    ["un rol personalizado", "CUSTOM_ventas-operaciones", ["MANAGE_PRODUCTS", "MANAGE_OPERATIONS"]],
  ])("DELEGACIÓN: %s al que se le da VIEW_FINANCES entra", (_n, role, permissions) => {
    sessionFor(role, [...permissions, "VIEW_FINANCES"]);
    renderGuard(pathname);
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });

  it("el superadmin entra", () => {
    sessionFor("USUARIO", [], "octatoledo7@gmail.com");
    renderGuard(pathname);
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });
});

it("Ventas sigue entrando a /ventas", () => {
  sessionFor("VENTAS", ["VIEW_SALES", "CREATE_SALE"]);
  renderGuard("/ventas");
  expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
});
