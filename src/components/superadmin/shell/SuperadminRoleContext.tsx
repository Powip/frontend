"use client";

/* -----------------------------------------------------------------------
   3.2 — Feature "Ver como rol" (solo Super Admin).

   Es una simulación de vista, no cambia permisos reales: el usuario real
   siempre es "super" (pasó el guard de isSuperadmin en AuthGuard), pero
   puede previsualizar cómo se ve el sidebar/las vistas para otro rol
   interno. Estado solo en cliente, no persiste ni afecta autorización.
------------------------------------------------------------------------ */

import { createContext, useContext, useMemo, useState } from "react";
import { RolInterno } from "@/interfaces/superadmin";

interface SuperadminRoleContextValue {
  viewingAs: RolInterno;
  setViewingAs: (rol: RolInterno) => void;
  isPreview: boolean;
}

const SuperadminRoleContext = createContext<SuperadminRoleContextValue | null>(null);

export function SuperadminRoleProvider({ children }: { children: React.ReactNode }) {
  const [viewingAs, setViewingAs] = useState<RolInterno>("super");

  const value = useMemo(
    () => ({ viewingAs, setViewingAs, isPreview: viewingAs !== "super" }),
    [viewingAs]
  );

  return <SuperadminRoleContext.Provider value={value}>{children}</SuperadminRoleContext.Provider>;
}

export function useSuperadminRole() {
  const ctx = useContext(SuperadminRoleContext);
  if (!ctx) throw new Error("useSuperadminRole debe usarse dentro de SuperadminRoleProvider");
  return ctx;
}
