/**
 * C1 · el sidebar no ofrece Compras a quien no edita inventario, ni Administración a quien no es
 * Administrador. Auth y navegación son dobles de prueba; el componente y el mapeo de rutas son reales.
 */
import type { ComponentProps } from "react";
import { render } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { capabilities: { view: false } }, isError: false }),
}));

let mockPathname = "/compras";
let mockUser = {
  id: "sidebar-roles-user",
  email: "sidebar-roles@negocio.invalid",
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
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: jest.fn() }) }));
jest.mock("next/link", () => ({ __esModule: true, default: (props: ComponentProps<"a">) => <a {...props} /> }));

function renderAs(role: string, permissions: string[] = [], email = "sidebar-roles@negocio.invalid") {
  mockUser = { ...mockUser, role, permissions, email };
  return render(<Sidebar />);
}
const link = (c: HTMLElement, href: string) => c.querySelector(`a[href="${href}"]`);

describe("Sidebar · Compras (alta de stock con costo)", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    mockPathname = "/inventario"; // abre el grupo que contiene Compras
  });

  it.each([
    ["Administrador", "ADMINISTRADOR"],
    ["Operaciones", "OPERACIONES"],
  ])("%s ve Compras", (_n, role) => {
    const { container } = renderAs(role);
    expect(link(container, "/compras")).not.toBeNull();
  });

  it.each([
    ["Ventas", "VENTAS", []],
    ["CALLER (tiene MANAGE_INVENTORY)", "CALLER", ["MANAGE_INVENTORY", "VIEW_FINANCES"]],
    ["rol personalizado", "CUSTOM_ventas-operaciones", ["MANAGE_PRODUCTS", "MANAGE_OPERATIONS"]],
  ])("%s no ve Compras", (_n, role, permissions) => {
    const { container } = renderAs(role, permissions);
    expect(link(container, "/compras")).toBeNull();
  });

  it("el inventario sigue visible para quien no edita (solo lectura)", () => {
    const { container } = renderAs("VENTAS");
    expect(link(container, "/inventario")).not.toBeNull();
  });

  it("el superadmin conserva Compras", () => {
    const { container } = renderAs("USUARIO", [], "octatoledo7@gmail.com");
    expect(link(container, "/compras")).not.toBeNull();
  });
});
