"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { type PanelContractState, usePanelContract } from "../hooks/use-panel-contract";
import type { PanelCatalogo } from "../models/panel-catalog.model";
import { PanelCatalogContext } from "./panel-catalog.context";
import { usePanel } from "./panel-context";

interface PanelCatalogState {
  canales: PanelContractState<"canales-fichas">;
  asesores: PanelContractState<"opciones-asesores">;
  catalogo: PanelCatalogo;
}

const PanelCatalogStateContext = createContext<PanelCatalogState | null>(null);

export function PanelCatalogProvider({ children }: { children: ReactNode }) {
  const { session } = usePanel();
  const empresaQuery = useMemo(
    () => (session.empresaId ? { empresaId: session.empresaId } : null),
    [session.empresaId],
  );
  const canales = usePanelContract("canales-fichas", empresaQuery);
  const asesores = usePanelContract("opciones-asesores", empresaQuery, { permisosDe: "usuario" });

  const catalogo = useMemo<PanelCatalogo>(() => {
    const listaAsesores = (asesores.data ?? []).map((asesor) => ({
      id: asesor.id,
      nombre: asesor.nombre,
      rol: asesor.rol ?? null,
    }));
    if (!listaAsesores.some((asesor) => asesor.id === session.userId)) {
      const rolSesion = session.rol.status === "resuelto" ? session.rol.role : null;
      listaAsesores.push({
        id: session.userId,
        nombre: session.userName,
        rol: rolSesion === "confirmadora" || rolSesion === "vendedora" ? rolSesion : null,
      });
    }
    return {
      listo: canales.status !== "cargando" && asesores.status !== "cargando",
      tiendas: session.tiendas,
      canales: (canales.data ?? [])
        .filter((canal) => canal.activo)
        .map((canal) => ({
          id: canal.id,
          nombre: canal.nombre,
          entrada: canal.entrada,
          color: canal.color,
        })),
      asesores: listaAsesores,
    };
  }, [canales.status, canales.data, asesores.status, asesores.data, session]);

  const value = useMemo(() => ({ canales, asesores, catalogo }), [canales, asesores, catalogo]);

  return (
    <PanelCatalogStateContext.Provider value={value}>
      <PanelCatalogContext.Provider value={catalogo}>{children}</PanelCatalogContext.Provider>
    </PanelCatalogStateContext.Provider>
  );
}

export function usePanelCatalogState(): PanelCatalogState {
  const context = useContext(PanelCatalogStateContext);
  if (!context) {
    throw new Error("usePanelCatalogState debe usarse dentro de <PanelProvider>");
  }
  return context;
}
