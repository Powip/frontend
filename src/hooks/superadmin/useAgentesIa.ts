"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/agentes.

   Página 100% simulada hoy — no confundir con src/services/agentesService.ts
   (agentes HUMANOS de Centro de Contacto, ms-ventas, dominio totalmente
   distinto). Esto es sobre features de IA propias de la plataforma
   ("Chat IA WhatsApp", "Asistente de Ventas", etc.), on/off a nivel
   plataforma. No existe ningún backend que loguee uso/costo de LLM ni un
   config store de flags — ver docs/superadmin/agentes-endpoints.md para el
   detalle completo. Mismo patrón real-primero-simulado-después que el
   resto de los hooks de /superadmin.
----------------------------------------------------------------------- */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { agentesIaMock } from "@/mocks/superadmin";
import type { IAgenteIA } from "@/interfaces/superadmin";

const AGENTES_IA_QUERY_KEY = ["superadmin", "agentes-ia"] as const;

/* -----------------------------------------------------------------------
   Listado — GET /agentes-ia (propuesto, ver doc). Hoy no existe, cae
   siempre al mock y queda marcado isSimulado.
------------------------------------------------------------------------ */
export function useAgentesIa() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<{ data: IAgenteIA[] }>({
    queryKey: [...AGENTES_IA_QUERY_KEY, "list"],
    queryFn: async () => {
      const res = await axios.get<{ data: IAgenteIA[] }>(`${SUPERADMIN_API_BASE}/agentes-ia`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  return {
    data: query.isError ? agentesIaMock : (query.data?.data ?? agentesIaMock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/* -----------------------------------------------------------------------
   KPIs agregados — GET /agentes-ia/kpis (propuesto). Mock recalcula sobre
   el array mock completo mientras el endpoint no exista.
------------------------------------------------------------------------ */
export interface IKpisAgentesIa {
  total: number;
  activos: number;
  interaccionesTotales: number;
  cierresAsistidos: number;
}

function calcularKpisMock(): IKpisAgentesIa {
  return {
    total: agentesIaMock.length,
    activos: agentesIaMock.filter((a) => a.activo).length,
    interaccionesTotales: agentesIaMock.reduce((sum, a) => sum + a.usoMes, 0),
    cierresAsistidos: agentesIaMock.reduce((sum, a) => sum + (a.cierresAsistidos ?? 0), 0),
  };
}

export function useKpisAgentesIa() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<{ data: IKpisAgentesIa }>({
    queryKey: [...AGENTES_IA_QUERY_KEY, "kpis"],
    queryFn: async () => {
      const res = await axios.get<{ data: IKpisAgentesIa }>(`${SUPERADMIN_API_BASE}/agentes-ia/kpis`, authHeaders(token));
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
   Activar / desactivar — PATCH /agentes-ia/{id} (propuesto). Intenta el
   real primero; si todavía no existe (caso de hoy), aplica el cambio
   localmente sobre el mismo array mock para no romper la demo — mismo
   comportamiento que useCambiarEstadoApp en useMarketplace.ts. El día que
   el endpoint exista, la rama real toma precedencia sola.
------------------------------------------------------------------------ */
export function useToggleAgenteIa() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<IAgenteIA | null> => {
      const actual = agentesIaMock.find((a) => a.id === id);
      const activoDestino = actual ? !actual.activo : true;
      try {
        const res = await axios.patch<{ data: IAgenteIA }>(
          `${SUPERADMIN_API_BASE}/agentes-ia/${id}`,
          { activo: activoDestino },
          authHeaders(auth?.accessToken)
        );
        return res.data.data;
      } catch {
        if (actual) actual.activo = activoDestino;
        return actual ?? null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTES_IA_QUERY_KEY });
    },
  });
}
