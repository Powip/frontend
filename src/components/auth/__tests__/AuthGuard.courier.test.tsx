/**
 * FEAT-24 H8-D5 · el rol COURIER solo usa su portal en /almacen: cualquier otra ruta (el dashboard después
 * del login, una URL vieja, las pantallas del almacén que no son suyas) lo lleva a /almacen en lugar de
 * mostrarle «Acceso denegado». Los gates de plan y de preguntas de negocio se aíslan.
 */
import { render, screen } from "@testing-library/react";
import AuthGuard from "../AuthGuard";
import { useAuth } from "@/contexts/AuthContext";

let mockPathname = "/dashboard";
let mockSession: Pick<ReturnType<typeof useAuth>, "auth" | "loading">;
const replace = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), replace }),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockSession }));
jest.mock("@/components/shared/PowipPulseLoader", () => ({ PowipPulseLoader: () => <p>Cargando sesión</p> }));
jest.mock("@/lib/subscriptionGate", () => ({ resolveSubscriptionRedirect: () => null }));
jest.mock("@/lib/businessQuestionsGate", () => ({ resolveBusinessQuestionsRedirect: () => null }));

function sessionFor(role: string, permissions: string[] = []) {
  mockSession = {
    loading: false,
    auth: {
      accessToken: "synthetic-ui-fixture",
      exp: 0,
      user: { id: "fixture-user", email: "fixture@negocio.invalid", role, permissions, companyId: "fixture-company" },
      company: null,
      subscription: null,
    },
  } as unknown as typeof mockSession;
}
function renderGuard(pathname: string) {
  mockPathname = pathname;
  return render(
    <AuthGuard>
      <p>Contenido protegido</p>
    </AuthGuard>,
  );
}

beforeEach(() => replace.mockClear());

describe("AuthGuard · rol COURIER (FEAT-24 H8)", () => {
  it.each(["/almacen", "/almacen/stock", "/almacen/contar", "/almacen/recibir/traslados", "/almacen/conciliacion"])("entra a su portal: %s", (pathname) => {
    sessionFor("COURIER", ["MANAGE_INVENTORY"]);
    renderGuard(pathname);
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(["/dashboard", "/inventario/couriers", "/ventas", "/almacen/picking", "/almacen/recibir/compras"])("%s lo lleva a /almacen sin mostrar la pantalla", (pathname) => {
    sessionFor("COURIER", ["MANAGE_INVENTORY", "VIEW_SALES"]);
    renderGuard(pathname);
    expect(replace).toHaveBeenCalledWith("/almacen");
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
    expect(screen.queryByText("Acceso Denegado")).not.toBeInTheDocument();
  });

  it("otro rol sin permiso sigue viendo «Acceso Denegado» (sin redirigir)", () => {
    sessionFor("VENTAS");
    renderGuard("/compras");
    expect(screen.getByText("Acceso Denegado")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
