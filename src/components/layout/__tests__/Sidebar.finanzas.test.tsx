/**
 * B1 · el sidebar no ofrece /finanzas a quien no tiene VIEW_FINANCES.
 * Auth y navegación son dobles de prueba; el componente y el mapeo de rutas son reales.
 * "Facturación" vive en el mismo grupo y NO debe desaparecer: es otra ruta, con su propia regla.
 */
import type { ComponentProps } from "react";
import { render } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { capabilities: { view: false } }, isError: false }),
}));

let mockPathname = "/facturacion";
let mockUser = {
  id: "sidebar-finanzas-user",
  email: "sidebar-finanzas@negocio.invalid",
  name: "Fixture",
  surname: "User",
  role: "VENTAS",
  permissions: [] as string[],
};

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: mockUser },
    logout: jest.fn(),
    hasPermission: (permission: string) => mockUser.permissions.includes(permission),
  }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: jest.fn() }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));

const VENTAS = ["VIEW_DASHBOARD", "VIEW_SALES", "CREATE_SALE", "VIEW_TRACKING", "MANAGE_CLIENTS", "VIEW_CUSTOMER_SERVICE"];
const OPERACIONES = [
  "VIEW_DASHBOARD", "MANAGE_PRODUCTS", "MANAGE_ALMACEN", "VIEW_SALES", "MANAGE_OPERATIONS", "VIEW_TRACKING",
  "MANAGE_CLIENTS", "MANAGE_PROVIDERS", "VIEW_CUSTOMER_SERVICE", "VIEW_ABANDONED_CHECKOUTS",
];

function renderAs(role: string, permissions: string[], email = "sidebar-finanzas@negocio.invalid") {
  mockUser = { ...mockUser, role, permissions, email };
  return render(<Sidebar />);
}

describe("Sidebar · acceso a Finanzas", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    mockPathname = "/facturacion"; // abre el grupo Finanzas para poder inspeccionar sus hijos
  });

  it.each([
    ["Ventas", "VENTAS", VENTAS],
    ["Operaciones", "OPERACIONES", OPERACIONES],
    ["un rol personalizado Ventas + Operaciones", "CUSTOM_ventas-operaciones", [...new Set([...VENTAS, ...OPERACIONES])]],
    ["CALLER (sin VIEW_FINANCES, como quedó en prod)", "CALLER", [...OPERACIONES, "MANAGE_INVENTORY"]],
  ])("%s no ve el enlace a /finanzas", (_nombre, role, permissions) => {
    const { container } = renderAs(role, permissions);
    expect(container.querySelector('a[href="/finanzas"]')).toBeNull();
  });

  it.each([
    ["Ventas", "VENTAS", VENTAS],
    ["Operaciones", "OPERACIONES", OPERACIONES],
  ])("%s sigue viendo Facturación, que no es de Finanzas", (_nombre, role, permissions) => {
    const { container } = renderAs(role, permissions);
    expect(container.querySelector('a[href="/facturacion"]')).not.toBeNull();
  });

  it("el Administrador ve el enlace a /finanzas y a Facturación", () => {
    const { container } = renderAs("ADMINISTRADOR", [...VENTAS, ...OPERACIONES, "VIEW_FINANCES"]);
    expect(container.querySelector('a[href="/finanzas"]')).not.toBeNull();
    expect(container.querySelector('a[href="/facturacion"]')).not.toBeNull();
  });

  it("el superadmin conserva el enlace aunque su sesión no traiga permisos", () => {
    const { container } = renderAs("USUARIO", [], "octatoledo7@gmail.com");
    expect(container.querySelector('a[href="/finanzas"]')).not.toBeNull();
  });

  it.each([
    ["un caller", "CALLER", [...OPERACIONES, "MANAGE_INVENTORY"]],
    ["Ventas", "VENTAS", VENTAS],
    ["un rol personalizado", "CUSTOM_ventas-operaciones", [...VENTAS, ...OPERACIONES]],
  ])("DELEGACIÓN: a %s con VIEW_FINANCES se le muestra Finanzas", (_n, role, permissions) => {
    const { container } = renderAs(role, [...permissions, "VIEW_FINANCES"]);
    expect(container.querySelector('a[href="/finanzas"]')).not.toBeNull();
  });
});

describe("Sidebar · grupo Administración por permiso", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    mockPathname = "/administracion/resumen"; // abre el grupo para poder inspeccionar sus hijos
  });

  it("se muestra a quien tiene VIEW_FINANCES, sea cual sea su rol", () => {
    for (const role of ["ADMINISTRADOR", "CALLER", "VENTAS"]) {
      const { container, unmount } = renderAs(role, ["VIEW_FINANCES"]);
      expect(container.querySelector('a[href="/administracion/resumen"]')).not.toBeNull();
      unmount();
    }
  });

  it("no se muestra sin VIEW_FINANCES, ni siquiera al rol Administrador", () => {
    for (const [role, permissions] of [["ADMINISTRADOR", VENTAS], ["CALLER", OPERACIONES], ["OPERACIONES", OPERACIONES]] as const) {
      const { container, unmount } = renderAs(role, [...permissions]);
      expect(container.querySelector('a[href="/administracion/resumen"]')).toBeNull();
      unmount();
    }
  });

  it("el superadmin lo conserva", () => {
    const { container } = renderAs("USUARIO", [], "octatoledo7@gmail.com");
    expect(container.querySelector('a[href="/administracion/resumen"]')).not.toBeNull();
  });
});
