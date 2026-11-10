/**
 * C1 · entrar por URL a /compras (solo roles de inventario) o /administracion (solo Administrador).
 * Los gates de plan y de preguntas de negocio se aíslan: aquí solo se prueba el permiso de ruta real.
 */
import { render, screen } from "@testing-library/react";
import AuthGuard from "../AuthGuard";
import { useAuth } from "@/contexts/AuthContext";

let mockPathname = "/compras";
let mockSession: Pick<ReturnType<typeof useAuth>, "auth" | "loading">;

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockSession }));
jest.mock("@/components/shared/PowipPulseLoader", () => ({ PowipPulseLoader: () => <p>Cargando sesión</p> }));
jest.mock("@/lib/subscriptionGate", () => ({ resolveSubscriptionRedirect: () => null }));
jest.mock("@/lib/businessQuestionsGate", () => ({ resolveBusinessQuestionsRedirect: () => null }));

function sessionFor(role: string, permissions: string[] = [], email = "fixture@negocio.invalid") {
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

describe.each(["/compras", "/registrar-compra"])("AuthGuard · %s", (pathname) => {
  it.each([["ADMINISTRADOR"], ["OPERACIONES"]])("%s entra", (role) => {
    sessionFor(role);
    renderGuard(pathname);
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });

  it.each([
    ["VENTAS", []],
    ["CALLER", ["MANAGE_INVENTORY", "VIEW_FINANCES", "MANAGE_PRODUCTS"]],
    ["CUSTOM_ventas-operaciones", ["MANAGE_PRODUCTS", "MANAGE_OPERATIONS"]],
  ])("%s ve Acceso Denegado", (role, permissions) => {
    sessionFor(role, permissions);
    renderGuard(pathname);
    expect(screen.getByText("Acceso Denegado")).toBeInTheDocument();
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("el superadmin entra", () => {
    sessionFor("USUARIO", [], "octatoledo7@gmail.com");
    renderGuard(pathname);
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });
});

describe.each(["/administracion/resumen", "/administracion/capital"])("AuthGuard · %s", (pathname) => {
  it("el Administrador entra", () => {
    sessionFor("ADMINISTRADOR", ["VIEW_FINANCES"]);
    renderGuard(pathname);
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });

  it.each([
    ["CALLER (tiene VIEW_FINANCES)", "CALLER", ["VIEW_FINANCES", "MANAGE_OPERATIONS"]],
    ["OPERACIONES", "OPERACIONES", ["MANAGE_OPERATIONS"]],
    ["VENTAS", "VENTAS", []],
  ])("%s ve Acceso Denegado", (_n, role, permissions) => {
    sessionFor(role, permissions);
    renderGuard(pathname);
    expect(screen.getByText("Acceso Denegado")).toBeInTheDocument();
  });
});
