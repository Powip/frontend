"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/oportunidades.
   Ver docs/superadmin/oportunidades-endpoints.md — casi todo acá depende
   de agregaciones a nivel de red que hoy no existen (mismo patrón
   real-primero-simulado-después que el resto de /superadmin).
   "Canales de venta de la red" y "GMV" se reusan de useDashboard.ts
   (misma fuente real, no tiene sentido duplicarla).
----------------------------------------------------------------------- */

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useSaasMetrics } from "@/hooks/useSaasMetrics";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { useAlertasImportantes } from "./useDashboard";
import { radarUpsellMock, couriersRedMock, segmentacionRedMock, cajaCodMock, empresasMock } from "@/mocks/superadmin";
import type { IRadarUpsell, ICourierRed, ISegmentoRed } from "@/interfaces/superadmin";

function useBackedList<T>(path: string, mock: T[]) {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const query = useQuery<{ data: T[] }>({
    queryKey: ["superadmin", "oportunidades", path],
    queryFn: async () => {
      const res = await axios.get<{ data: T[] }>(`${SUPERADMIN_API_BASE}${path}`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });
  return { data: query.isError ? mock : (query.data?.data ?? mock), isLoading: query.isLoading, isSimulado: query.isError };
}

/* KPIs — GMV real (saas-metrics), el resto simulado (ver doc). */
export function useKpisOportunidades() {
  const { auth } = useAuth();
  const { data: saas, isLoading } = useSaasMetrics(auth?.accessToken);
  const mrrOportunidades = radarUpsellMock.reduce((acc, r) => acc + r.mrrPotencial, 0);
  const codTransito = cajaCodMock.reduce((acc, c) => acc + c.codEnTransito, 0);
  const empresasRiesgo = empresasMock.filter((e) => e.estado === "riesgo").length;

  return {
    data: { mrrOportunidades, gmvRed: saas?.gmvTotal ?? 0, codTransito, empresasRiesgo },
    isLoading,
    simuladoFields: ["mrrOportunidades", "codTransito", "empresasRiesgo"] as const,
  };
}

/** Reusa el hook de alertas del Dashboard — misma fuente, mismo estado (simulado). */
export function useAlertasOportunidad() {
  const { data, isSimulado } = useAlertasImportantes();
  return { data: data.data, isSimulado };
}

export function useRadarUpsell() {
  return useBackedList<IRadarUpsell>("/oportunidades/radar-upsell", radarUpsellMock);
}

export function useCouriersRed() {
  return useBackedList<ICourierRed>("/oportunidades/couriers-red", couriersRedMock);
}

export function useSegmentacionRed() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const query = useQuery<ISegmentoRed[]>({
    queryKey: ["superadmin", "oportunidades", "segmentacion"],
    queryFn: async () => {
      const res = await axios.get<ISegmentoRed[]>(`${SUPERADMIN_API_BASE}/oportunidades/segmentacion`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });
  return { data: query.isError ? segmentacionRedMock : (query.data ?? segmentacionRedMock), isSimulado: query.isError };
}
