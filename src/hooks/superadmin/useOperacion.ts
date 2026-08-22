"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/operacion.
   Ver docs/superadmin/operacion-endpoints.md — a diferencia de los demás
   módulos, esta página hoy no tiene NADA real que conectar (las 3
   secciones dependen de trabajo de backend que todavía no arrancó). Se
   deja igual con el mismo patrón real-primero-simulado-después para que
   funcione sola en cuanto exista el endpoint — no hay que tocar este
   archivo cuando eso pase.
----------------------------------------------------------------------- */

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { cajaCodMock, sunatGlobalMock, alertasFraudeMock } from "@/mocks/superadmin";
import type { ICajaCodEmpresa, ISunatEmpresa, IAlertaFraude } from "@/interfaces/superadmin";

function useBackedList<T>(path: string, mock: T[]) {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const query = useQuery<{ data: T[] }>({
    queryKey: ["superadmin", "operacion", path],
    queryFn: async () => {
      const res = await axios.get<{ data: T[] }>(`${SUPERADMIN_API_BASE}${path}`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });
  return { data: query.isError ? mock : (query.data?.data ?? mock), isLoading: query.isLoading, isSimulado: query.isError };
}

export function useCajaCod() {
  return useBackedList<ICajaCodEmpresa>("/operacion/caja-cod", cajaCodMock);
}

export function useSunatGlobal() {
  return useBackedList<ISunatEmpresa>("/operacion/sunat-global", sunatGlobalMock);
}

export function useAlertasFraude() {
  return useBackedList<IAlertaFraude>("/operacion/fraude", alertasFraudeMock);
}

export function useKpisOperacion() {
  const caja = useCajaCod();
  const sunat = useSunatGlobal();
  const fraude = useAlertasFraude();

  const codTransito = caja.data.reduce((acc, c) => acc + c.codEnTransito, 0);
  const liquidacionPendiente = caja.data.reduce((acc, c) => acc + c.liquidacionPendiente, 0);
  const emiten = sunat.data.filter((s) => s.emite).length;

  return {
    data: { codTransito, liquidacionPendiente, emiten, totalSunat: sunat.data.length, alertasFraude: fraude.data.length },
    isLoading: caja.isLoading || sunat.isLoading || fraude.isLoading,
    isSimulado: caja.isSimulado || sunat.isSimulado || fraude.isSimulado,
  };
}
