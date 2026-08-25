"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/soporte.
   Ver docs/superadmin/soporte-endpoints.md — no hay ninguna entidad
   `ticket` real en ningún backend todavía (ni tabla, ni integración con
   un helpdesk externo), así que TODO acá es simulado. Se deja igual el
   mismo patrón real-primero-simulado-después que el resto de /superadmin
   para que empiece a andar solo en cuanto el backend exista — no hay que
   tocar este archivo cuando eso pase.
----------------------------------------------------------------------- */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { ticketsMock } from "@/mocks/superadmin";
import type { ITicket, PrioridadTicket, EstadoTicket } from "@/interfaces/superadmin";

export interface IKpisSoporte {
  abiertos: number;
  criticos: number;
  tiempoRespuestaPromedioMin: number;
  csat: number;
}

const kpisSoporteMock: IKpisSoporte = {
  abiertos: ticketsMock.filter((t) => t.estado === "Abierto").length,
  criticos: ticketsMock.filter((t) => t.prioridad === "Alta").length,
  tiempoRespuestaPromedioMin: 38,
  csat: 4.6,
};

/* -----------------------------------------------------------------------
   Cola de tickets — hoy simulada, ver doc. `prioridad` se filtra acá
   mismo (mock chico, 14 tickets); el endpoint propuesto ya nace con
   filtros server-side para no repetir el anti-patrón ya marcado en
   operacion-endpoints.md/oportunidades-endpoints.md el día que exista.
------------------------------------------------------------------------ */
export function useTicketsSoporte(prioridad: PrioridadTicket | "todas" = "todas") {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<{ data: ITicket[] }>({
    queryKey: ["superadmin", "soporte", "tickets", { prioridad }],
    queryFn: async () => {
      const res = await axios.get<{ data: ITicket[] }>(`${SUPERADMIN_API_BASE}/soporte/tickets`, {
        ...authHeaders(token),
        params: prioridad === "todas" ? undefined : { prioridad },
      });
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const mock = prioridad === "todas" ? ticketsMock : ticketsMock.filter((t) => t.prioridad === prioridad);
  const sortBy = (items: ITicket[]) => [...items].sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());

  return {
    data: query.isError ? sortBy(mock) : sortBy(query.data?.data ?? mock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/* -----------------------------------------------------------------------
   KPIs de la cola — simulados, ver doc (csat y tiempo de respuesta
   necesitan features de backend que todavía no existen).
------------------------------------------------------------------------ */
export function useKpisSoporte() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<IKpisSoporte>({
    queryKey: ["superadmin", "soporte", "kpis"],
    queryFn: async () => {
      const res = await axios.get<IKpisSoporte>(`${SUPERADMIN_API_BASE}/soporte/kpis`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  return {
    data: query.isError ? kpisSoporteMock : (query.data ?? kpisSoporteMock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/* -----------------------------------------------------------------------
   Detalle de ticket — simulado, ver doc.
------------------------------------------------------------------------ */
export function useTicketDetalle(ticketId: string | null) {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<ITicket>({
    queryKey: ["superadmin", "soporte", "ticket", ticketId],
    queryFn: async () => {
      const res = await axios.get<ITicket>(`${SUPERADMIN_API_BASE}/soporte/tickets/${ticketId}`, authHeaders(token));
      return res.data;
    },
    enabled: !!token && !!ticketId,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const mock = ticketId ? (ticketsMock.find((t) => t.id === ticketId) ?? null) : null;

  return {
    data: query.isError ? mock : (query.data ?? mock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/* -----------------------------------------------------------------------
   Mutaciones — apuntan al endpoint propuesto; mientras no exista, fallan
   silenciosamente contra un 404/network error real (no hay fallback
   "simulado" para escrituras, a diferencia de las queries de lectura).
------------------------------------------------------------------------ */
function invalidateSoporte(queryClient: ReturnType<typeof useQueryClient>, ticketId?: string) {
  queryClient.invalidateQueries({ queryKey: ["superadmin", "soporte"] });
  if (ticketId) queryClient.invalidateQueries({ queryKey: ["superadmin", "soporte", "ticket", ticketId] });
}

export function useResponderTicket(ticketId: string | null) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (texto: string) => {
      const res = await axios.post<ITicket>(
        `${SUPERADMIN_API_BASE}/soporte/tickets/${ticketId}/mensajes`,
        { texto },
        authHeaders(auth?.accessToken)
      );
      return res.data;
    },
    onSuccess: () => invalidateSoporte(queryClient, ticketId ?? undefined),
  });
}

export function useCambiarEstadoTicket(ticketId: string | null) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { estado?: EstadoTicket; asignadoId?: string }) => {
      const res = await axios.patch<ITicket>(`${SUPERADMIN_API_BASE}/soporte/tickets/${ticketId}`, input, authHeaders(auth?.accessToken));
      return res.data;
    },
    onSuccess: () => invalidateSoporte(queryClient, ticketId ?? undefined),
  });
}
