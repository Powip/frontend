import { render, screen, within } from "@testing-library/react";

/**
 * Sidebar — el enlace a /usuarios sigue la misma regla que AuthGuard.
 *
 * 1. Sin rol de admin, el enlace "Usuarios" no se renderiza (antes se veía y
 *    la página ofrecía crear usuarios a cualquiera).
 * 2. Un admin de empresa lo ve.
 * 3. El resto de "Configuración" no cambia para el colaborador.
 */

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/configuracion",
}));
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: jest.fn() }) }));
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));

import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "../Sidebar";

const mockUseAuth = jest.mocked(useAuth);

function renderAs(role: string) {
  mockUseAuth.mockReturnValue({
    auth: {
      user: { id: "u-1", email: "colaborador@empresa.com", role, permissions: [], name: "Ana" },
      company: { id: "company-1", name: "Empresa" },
      subscription: null,
    },
    logout: jest.fn(),
    hasPermission: () => false,
  } as unknown as ReturnType<typeof useAuth>);

  render(<Sidebar />);
  // Con pathname /configuracion, el submenú "Configuración" se abre solo.
  return screen.getByRole("navigation");
}

const linkTo = (nav: HTMLElement, href: string) =>
  within(nav)
    .queryAllByRole("link")
    .find((a) => a.getAttribute("href") === href);

describe("Sidebar — enlace Usuarios", () => {
  it.each(["VENTAS", "AGENTES", "OPERACIONES"])("%s no ve el enlace", (role) => {
    const nav = renderAs(role);

    expect(linkTo(nav, "/usuarios")).toBeUndefined();
    expect(linkTo(nav, "/configuracion")).toBeDefined();
  });

  it("un admin de empresa ve el enlace", () => {
    const nav = renderAs("ADMINISTRADOR");

    expect(linkTo(nav, "/usuarios")).toBeDefined();
  });
});
