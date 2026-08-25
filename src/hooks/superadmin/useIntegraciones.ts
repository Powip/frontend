"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/integraciones — vista de RED (salud de
   cada vendor across todas las empresas), no la config de integraciones
   de una empresa puntual (eso vive en YavendioConfig/ShalomConfig/etc.,
   por companyId, y no se toca acá).

   Hoy no existe ningún agregado real de esto: los connection-test de
   Yavendio/Aliclik/EVA/Shalom son reales pero siempre por-empresa (ver
   docs/superadmin/integraciones-endpoints.md). Mismo patrón que el resto
   de /superadmin: intenta el endpoint propuesto, si no existe (404/network
   error) cae al mock y expone `isSimulado`.
------------------------------------------------------------------------ */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { integracionesMock } from "@/mocks/superadmin";
import { toggleIntegracion as toggleIntegracionMock, reconectarIntegracion as reconectarIntegracionMock } from "@/services/superadmin/integracionesService";
import type { IIntegracion } from "@/interfaces/superadmin";

/* -----------------------------------------------------------------------
   1. Grid de integraciones — 🟡 agregado nuevo, extiende
   dashboard-endpoints.md #6 (salud-integraciones) con detalle por vendor
   que esa card resumen no necesita.
------------------------------------------------------------------------ */
export interface SaludIntegracionesData {
  integraciones: IIntegracion[];
  uptimePromedio: number;
}

export function useSaludIntegraciones() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<SaludIntegracionesData>({
    queryKey: ["superadmin", "integraciones", "salud"],
    queryFn: async () => {
      const res = await axios.get<SaludIntegracionesData>(`${SUPERADMIN_API_BASE}/integraciones/salud`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const mock: SaludIntegracionesData = { integraciones: integracionesMock, uptimePromedio: 98.6 };

  return {
    data: query.isError ? mock : (query.data ?? mock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/* -----------------------------------------------------------------------
   2. KPIs — derivados de la misma lista de arriba (total de vendors es
   chico, agregarlo client-side no es el anti-patrón de escala que sí
   sería recorrer empresas una por una).
------------------------------------------------------------------------ */
export interface IntegracionesKpisData {
  total: number;
  activas: number;
  conError: number;
  uptimePromedio: number;
}

export function useKpisIntegraciones() {
  const { data, isLoading, isSimulado } = useSaludIntegraciones();

  const kpis = useMemo<IntegracionesKpisData>(() => {
    const total = data.integraciones.length;
    const activas = data.integraciones.filter((i) => i.activa).length;
    const conError = data.integraciones.filter((i) => i.estado === "error").length;
    return { total, activas, conError, uptimePromedio: data.uptimePromedio };
  }, [data]);

  return { data: kpis, isLoading, isSimulado };
}

/* -----------------------------------------------------------------------
   3. Acciones por integración — 🔴 subsistema nuevo (no hay tabla de
   config a nivel plataforma ni job de reconexión masiva). Best-effort:
   intenta el endpoint real primero; si no existe, resuelve contra el
   mock en memoria para no romper la demo (mismo patrón que
   useMarcarTareaHecha en useDashboard.ts).
------------------------------------------------------------------------ */
export function useToggleIntegracion() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (id: string): Promise<IIntegracion | null> => {
      try {
        const res = await axios.patch<IIntegracion>(`${SUPERADMIN_API_BASE}/integraciones/${id}/activa`, {}, authHeaders(token));
        return res.data;
      } catch {
        return toggleIntegracionMock(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "integraciones"] });
    },
  });
}

export function useReconectarIntegracion() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (id: string): Promise<IIntegracion | null> => {
      try {
        const res = await axios.post<IIntegracion>(`${SUPERADMIN_API_BASE}/integraciones/${id}/reconectar`, {}, authHeaders(token));
        return res.data;
      } catch {
        return reconectarIntegracionMock(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "integraciones"] });
    },
  });
}
