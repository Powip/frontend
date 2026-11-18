/**
 * FEAT-24 H8-D5 · al rol COURIER el menú se le cierra: solo le queda «Modo almacén» (su portal), aunque
 * su rol traiga permisos. Los demás roles no cambian. Auth y navegación son dobles de prueba; el
 * componente y el mapeo de rutas son reales.
 */
import type { ComponentProps } from "react";
import { render } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { capabilities: { view: true } }, isError: false }),
}));

let mockUser = {
  id: "sidebar-courier-user",
  email: "sidebar-courier@negocio.invalid",
  name: "Fixture",
  surname: "User",
  role: "COURIER",
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
  usePathname: () => "/inventario",
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: jest.fn() }) }));
jest.mock("next/link", () => ({ __esModule: true, default: (props: ComponentProps<"a">) => <a {...props} /> }));

function renderAs(role: string, permissions: string[] = []) {
  mockUser = { ...mockUser, role, permissions };
  return render(<Sidebar />);
}
const hrefs = (c: HTMLElement) => Array.from(c.querySelectorAll("a[href]"), (a) => a.getAttribute("href"));

describe("Sidebar · rol COURIER (FEAT-24 H8)", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  });

  it("solo ve el Modo almacén, aunque su rol traiga permisos de inventario y operaciones", () => {
    const { container } = renderAs("COURIER", ["MANAGE_INVENTORY", "MANAGE_OPERATIONS", "VIEW_SALES", "UPDATE_DELIVERY_STATUS"]);
    const links = hrefs(container);
    expect(links).toContain("/almacen");
    for (const href of ["/dashboard", "/inventario", "/ventas", "/compras", "/productos", "/configuracion", "/operaciones/pedidos"]) expect(links).not.toContain(href);
  });

  it("los demás roles siguen viendo el inventario además del modo almacén", () => {
    const { container } = renderAs("ALMACEN", ["UPDATE_DELIVERY_STATUS"]);
    const links = hrefs(container);
    expect(links).toEqual(expect.arrayContaining(["/inventario", "/almacen"]));
  });
});
