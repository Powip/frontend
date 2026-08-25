"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/logs.

   Logs TÉCNICOS/de infraestructura (por microservicio, con nivel
   info/warn/error) — no confundir con Auditoría (bitácora de negocio,
   docs/superadmin/auditoria-endpoints.md), que documenta otra página.

   100% simulado a propósito: no existe hoy ninguna fuente real (ni una
   plataforma de observabilidad conectada, ni un endpoint propio) — ver
   docs/superadmin/logs-endpoints.md para las dos rutas posibles (adoptar
   una herramienta de logs ya armada vs. construir un endpoint propio como
   stopgap). Mientras se decide, el frontend ya apunta al shape de la
   Opción B (endpoint propio) para no tener que tocar nada acá el día que
   exista.
----------------------------------------------------------------------- */

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { logsSistemaMock } from "@/mocks/superadmin";
import type { ILogSistema, NivelLog } from "@/interfaces/superadmin";

export interface KpisLogs {
  total: number;
  info: number;
  warn: number;
  error: number;
}

function kpisFromLogs(logs: ILogSistema[]): KpisLogs {
  return {
    total: logs.length,
    info: logs.filter((l) => l.nivel === "info").length,
    warn: logs.filter((l) => l.nivel === "warn").length,
    error: logs.filter((l) => l.nivel === "error").length,
  };
}

/* -----------------------------------------------------------------------
   Listado — filtrable por nivel. Simulado hasta que exista la fuente
   real (ver doc: Opción A recomendada, Opción B stopgap).
------------------------------------------------------------------------ */
export function useLogs(nivel: NivelLog | "todos" = "todos") {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<{ data: ILogSistema[] }>({
    queryKey: ["superadmin", "logs", "list", { nivel }],
    queryFn: async () => {
      const res = await axios.get<{ data: ILogSistema[] }>(`${SUPERADMIN_API_BASE}/logs`, {
        ...authHeaders(token),
        params: { nivel: nivel === "todos" ? undefined : nivel, page_size: 25 },
      });
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const mockData = nivel === "todos" ? logsSistemaMock : logsSistemaMock.filter((l) => l.nivel === nivel);
  const sorted = [...(query.isError ? mockData : query.data?.data ?? mockData)].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );

  return { data: sorted, isLoading: query.isLoading, isSimulado: query.isError };
}

/* -----------------------------------------------------------------------
   KPIs — total / info / warn / error. Simulado, misma razón que arriba.
------------------------------------------------------------------------ */
export function useKpisLogs() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<KpisLogs>({
    queryKey: ["superadmin", "logs", "kpis"],
    queryFn: async () => {
      const res = await axios.get<KpisLogs>(`${SUPERADMIN_API_BASE}/logs/kpis`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const mock = kpisFromLogs(logsSistemaMock);
  return { data: query.isError ? mock : query.data ?? mock, isLoading: query.isLoading, isSimulado: query.isError };
}
