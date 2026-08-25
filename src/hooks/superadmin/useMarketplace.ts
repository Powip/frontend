"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/marketplace.
   Ver docs/superadmin/marketplace-endpoints.md — a diferencia de los demás
   módulos, esta página hoy no tiene NADA real que conectar: no existe
   ningún ms-* que sepa qué es una "app" del marketplace ni quién la tiene
   instalada. Se deja igual con el mismo patrón real-primero-simulado-después
   para que funcione sola en cuanto exista el endpoint — no hay que tocar
   este archivo cuando eso pase.
----------------------------------------------------------------------- */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { appsMarketplaceMock } from "@/mocks/superadmin";
import type { IAppMarketplace, EstadoApp } from "@/interfaces/superadmin";

/* -----------------------------------------------------------------------
   Catálogo completo — real-primero-simulado-después, mismo helper que
   useOperacion.ts. Acepta un filtro de estado opcional para reusar el
   mismo endpoint agregado tanto en el catálogo como en la cola de
   pendientes (ver doc: evita mantener dos fuentes de verdad).
------------------------------------------------------------------------ */
export function useAppsMarketplace(estado?: EstadoApp) {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<{ data: IAppMarketplace[] }>({
    queryKey: ["superadmin", "marketplace", "apps", estado ?? "todas"],
    queryFn: async () => {
      const res = await axios.get<{ data: IAppMarketplace[] }>(`${SUPERADMIN_API_BASE}/marketplace/apps`, {
        ...authHeaders(token),
        params: estado ? { estado } : undefined,
      });
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const mock = useMemo(
    () => (estado ? appsMarketplaceMock.filter((a) => a.estado === estado) : appsMarketplaceMock),
    [estado]
  );

  return {
    data: query.isError ? mock : (query.data?.data ?? mock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

export function useAppsPendientes() {
  return useAppsMarketplace("pendiente");
}

/* -----------------------------------------------------------------------
   KPIs — endpoint agregado propuesto; mock recalcula sobre el array mock
   completo mientras el endpoint no exista (ver doc).
------------------------------------------------------------------------ */
export interface IKpisMarketplace {
  total: number;
  publicadas: number;
  pendientes: number;
  instalacionesTotales: number;
}

function calcularKpisMock(): IKpisMarketplace {
  return {
    total: appsMarketplaceMock.length,
    publicadas: appsMarketplaceMock.filter((a) => a.estado === "publicada").length,
    pendientes: appsMarketplaceMock.filter((a) => a.estado === "pendiente").length,
    instalacionesTotales: appsMarketplaceMock.reduce((sum, a) => sum + a.instalacionesCount, 0),
  };
}

export function useKpisMarketplace() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<{ data: IKpisMarketplace }>({
    queryKey: ["superadmin", "marketplace", "kpis"],
    queryFn: async () => {
      const res = await axios.get<{ data: IKpisMarketplace }>(`${SUPERADMIN_API_BASE}/marketplace/kpis`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  return {
    data: query.isError ? calcularKpisMock() : (query.data?.data ?? calcularKpisMock()),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/* -----------------------------------------------------------------------
   Aprobar / Rechazar — intenta el PATCH real propuesto en el doc; si el
   endpoint todavía no existe (caso de hoy), el cambio se aplica localmente
   sobre el mismo array mock para no romper la demo — es el mismo
   comportamiento que ya tenía marketplaceService.ts (mutaba el mock
   in-place). El día que el endpoint exista, la rama de éxito real toma
   precedencia sola.
------------------------------------------------------------------------ */
function useCambiarEstadoApp(estadoDestino: Extract<EstadoApp, "publicada" | "rechazada">, accion: "approve" | "reject") {
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<IAppMarketplace | null> => {
      try {
        const res = await axios.patch<{ data: IAppMarketplace }>(
          `${SUPERADMIN_API_BASE}/marketplace/apps/${id}/${accion}`,
          {},
          authHeaders(auth?.accessToken)
        );
        return res.data.data;
      } catch {
        const app = appsMarketplaceMock.find((a) => a.id === id);
        if (app) app.estado = estadoDestino;
        return app ?? null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "marketplace"] });
    },
  });
}

export function useAprobarApp() {
  return useCambiarEstadoApp("publicada", "approve");
}

export function useRechazarApp() {
  return useCambiarEstadoApp("rechazada", "reject");
}
