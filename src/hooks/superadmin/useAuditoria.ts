"use client";

/* -----------------------------------------------------------------------
   Hook de datos para /superadmin/auditoria.

   100% simulado hoy — no existe ningún audit_log persistido en ningún
   backend (confirmado: ver docs/superadmin/auditoria-endpoints.md). Ese
   doc también aclara que esta NO es una tabla nueva: es el mismo
   audit_log que docs/superadmin/dashboard-endpoints.md §7 ya pide para
   el feed de actividad del dashboard — acá se propone el contrato
   completo de listado filtrado + paginado (cursor) sobre esa misma
   tabla, en vez de "las últimas 10 filas".
----------------------------------------------------------------------- */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { auditLogMock } from "@/mocks/superadmin";
import { matchesQuery } from "@/services/superadmin/shared";
import type { IAuditLog } from "@/interfaces/superadmin";

export interface AuditoriaFiltros {
  q?: string;
  actorId?: string;
  entidad?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  cursor?: string;
}

interface AuditoriaResponse {
  data: IAuditLog[];
  nextCursor: string | null;
}

function filtrarMock(filtros: AuditoriaFiltros): IAuditLog[] {
  const { q, actorId, entidad, accion, desde, hasta, limit = 50 } = filtros;
  let items = [...auditLogMock];

  if (q) items = items.filter((a) => matchesQuery([a.actorNombre, a.accion, a.entidad], q));
  if (actorId) items = items.filter((a) => a.actorId === actorId);
  if (entidad) items = items.filter((a) => a.entidad === entidad);
  if (accion) items = items.filter((a) => a.accion === accion);
  if (desde) items = items.filter((a) => new Date(a.ts).getTime() >= new Date(desde).getTime());
  if (hasta) items = items.filter((a) => new Date(a.ts).getTime() <= new Date(hasta).getTime());

  return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, limit);
}

/**
 * Listado filtrado/paginado de auditoría — ver docs/superadmin/auditoria-endpoints.md.
 * Cae a `auditLogMock` filtrado client-side (stand-in) mientras el endpoint no exista.
 */
export function useAuditoria(filtros: AuditoriaFiltros = {}) {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const { q, actorId, entidad, accion, desde, hasta, limit = 50, cursor } = filtros;

  const query = useQuery<AuditoriaResponse>({
    queryKey: ["superadmin", "auditoria", "list", { q, actorId, entidad, accion, desde, hasta, limit, cursor }],
    queryFn: async () => {
      const res = await axios.get<AuditoriaResponse>(`${SUPERADMIN_API_BASE}/auditoria`, {
        ...authHeaders(token),
        params: { q, actor_id: actorId, entidad, accion, desde, hasta, limit, cursor },
      });
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const mock = useMemo(() => filtrarMock(filtros), [q, actorId, entidad, accion, desde, hasta, limit]);

  return {
    data: query.isError ? mock : (query.data?.data ?? mock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}
