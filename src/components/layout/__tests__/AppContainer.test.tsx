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
});
