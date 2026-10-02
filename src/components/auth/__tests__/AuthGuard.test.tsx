import { render, screen } from "@testing-library/react";

/**
 * AuthGuard — acceso por URL a /usuarios.
 *
 * 1. Un colaborador sin rol de admin que entra por URL ve "Acceso Denegado"
 *    y la página no se monta.
 * 2. Un admin de empresa sí la ve.
 * 3. El mismo colaborador sigue entrando a otras rutas (sin cambios).
 */

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: jest.fn(),
}));

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AuthGuard from "../AuthGuard";

const mockUseAuth = jest.mocked(useAuth);
const mockUsePathname = jest.mocked(usePathname);

function renderAs(role: string, pathname: string) {
  mockUsePathname.mockReturnValue(pathname);
  mockUseAuth.mockReturnValue({
    auth: {
      user: { id: "u-1", email: "colaborador@empresa.com", role, permissions: [] },
      company: { id: "company-1", name: "Empresa" },
      subscription: null,
    },
    loading: false,
  } as unknown as ReturnType<typeof useAuth>);

  render(
    <AuthGuard>
      <div>Contenido protegido</div>
    </AuthGuard>,
  );
}

describe("AuthGuard — /usuarios", () => {
  it.each(["VENTAS", "AGENTES", "OPERACIONES"])("%s no entra por URL", (role) => {
    renderAs(role, "/usuarios");

    expect(screen.getByText("Acceso Denegado")).toBeInTheDocument();
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("un admin de empresa (ADMINISTRADOR) entra", () => {
    renderAs("ADMINISTRADOR", "/usuarios");

    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(screen.queryByText("Acceso Denegado")).not.toBeInTheDocument();
  });

  it("el colaborador sigue entrando a Ventas", () => {
    renderAs("VENTAS", "/ventas");

    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });
});
