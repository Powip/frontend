"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Rutas diseñadas solo en modo claro. Se fuerza "light" sin pisar la
 * preferencia guardada, que vuelve a aplicarse al salir de ellas.
 */
const LIGHT_ONLY_ROUTES = ["/onboarding"];

export function ThemeProvider({ children }: ThemeProviderProps) {
  const pathname = usePathname();
  const forceLight = LIGHT_ONLY_ROUTES.some((r) => pathname?.startsWith(r));

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      forcedTheme={forceLight ? "light" : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
