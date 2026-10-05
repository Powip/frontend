/**
 * Tests: ThemeProvider (components/providers/ThemeProvider.tsx)
 *
 * Comportamiento verificado:
 * 1. En el onboarding (/onboarding y /onboarding/callback) fuerza el tema claro.
 * 2. En el resto de rutas no fuerza tema: respeta la preferencia del usuario.
 */
import { render } from "@testing-library/react";
import { ThemeProvider } from "../ThemeProvider";

let mockPathname = "/";
const mockNextThemesProvider = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("next-themes", () => ({
  ThemeProvider: (props: { forcedTheme?: string; children: React.ReactNode }) => {
    mockNextThemesProvider(props);
    return <>{props.children}</>;
  },
}));

const lastForcedTheme = () => mockNextThemesProvider.mock.lastCall?.[0].forcedTheme;

describe("ThemeProvider", () => {
  beforeEach(() => mockNextThemesProvider.mockClear());

  it.each(["/onboarding", "/onboarding/callback"])("fuerza el tema claro en %s", (pathname) => {
    mockPathname = pathname;
    render(<ThemeProvider>contenido</ThemeProvider>);

    expect(lastForcedTheme()).toBe("light");
  });

  it.each(["/configuracion", "/login"])("no fuerza tema en %s", (pathname) => {
    mockPathname = pathname;
    render(<ThemeProvider>contenido</ThemeProvider>);

    expect(lastForcedTheme()).toBeUndefined();
  });
});
