/**
 * Tests: AppContainer (components/layout/AppContainer.tsx)
 *
 * Comportamiento verificado:
 * 1. Oculta el Sidebar en el onboarding (/onboarding y /onboarding/callback).
 * 2. Muestra el Sidebar en las rutas del panel (p. ej. /configuracion).
 */
import { render, screen } from "@testing-library/react";
import AppContainer from "../AppContainer";

let mockPathname = "/";
let mockAuth: { user: { id: string } } | null = null;

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: mockAuth }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("@/components/layout/Sidebar", () => ({
  Sidebar: () => <nav data-testid="sidebar" />,
}));

jest.mock("@/components/auth/AuthGuard", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("AppContainer", () => {
  beforeEach(() => { mockAuth = null; });
  it.each(["/onboarding", "/onboarding/callback"])(
    "no muestra el sidebar en %s",
    (pathname) => {
      mockPathname = pathname;
      render(<AppContainer>contenido</AppContainer>);

      expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
      expect(screen.getByText("contenido")).toBeInTheDocument();
    }
  );

  it("muestra el sidebar en las rutas del panel", () => {
    mockPathname = "/configuracion";
    render(<AppContainer>contenido</AppContainer>);

    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("la solicitud pública anónima no muestra el sidebar", () => {
    mockPathname = "/partners/solicitud";
    render(<AppContainer>solicitud</AppContainer>);
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.getByText("solicitud")).toBeInTheDocument();
  });

  it.each(["/partners/referidos", "/partners/solicitud"])(
    "con sesión conserva el sidebar en %s", (pathname) => {
      mockPathname = pathname;
      mockAuth = { user: { id: "fixture-user" } };
      render(<AppContainer>partners</AppContainer>);
      expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    },
  );

  it("un prefijo parecido no recibe la excepción de solicitud", () => {
    mockPathname = "/partners/solicitud-extra";
    render(<AppContainer>otra ruta</AppContainer>);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });
});
