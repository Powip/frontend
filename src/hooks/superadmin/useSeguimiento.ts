"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/seguimiento.

   Lado leads (pre-venta): real, deriva de leads.next_action/next_action_date
   (columnas reales, ver docs/superadmin/seguimiento-endpoints.md). Lado
   empresas (postventa): simulado a propósito — existe una tabla real
   (lead_postventa) pero su semántica no está confirmada y no está
   vinculada al id real de la empresa en ms-company, así que preferimos
   no adivinar. Ver el doc para el detalle completo.
----------------------------------------------------------------------- */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { LEADS_API, RealLead, mapLead } from "./useAdquisicion";
import { seguimientosMock } from "@/mocks/superadmin";
import type { ISeguimiento } from "@/interfaces/superadmin";

export type FiltroVencimiento = "todos" | "vencidos" | "hoy" | "proximos";

function estadoVencimiento(vence: string): "vencido" | "hoy" | "proximo" {
  const dias = Math.floor((new Date(vence).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  return "proximo";
}

/* -----------------------------------------------------------------------
   Lado leads — real, acotado (ver doc: GET /leads no filtra por
   "tiene next_action" todavía, así que pedimos una página reciente y
   filtramos acá — un lead viejo con acción pendiente puede no aparecer).
------------------------------------------------------------------------ */
export function useSeguimientoLeads(filtro: FiltroVencimiento = "todos") {
  const { auth } = useAuth();

  const query = useQuery({
    queryKey: ["superadmin", "seguimiento", "leads-raw"],
    queryFn: async () => {
      const res = await axios.get(LEADS_API, { ...authHeaders(auth?.accessToken), params: { limit: 200 } });
      return (res.data.data as RealLead[]) ?? [];
    },
    enabled: !!auth?.accessToken,
  });

  const data: ISeguimiento[] = useMemo(() => {
    const leads = (query.data ?? []).map(mapLead).filter((l) => l.proximaFechaAccion);
    const items = leads.map((l) => ({
      id: l.id,
      entidadTipo: "lead" as const,
      entidadId: l.id,
      nombre: l.negocio || l.nombre,
      accion: l.proximaAccion || "Seguimiento",
      via: "WhatsApp" as const,
      responsableId: l.sdrNombre ?? "",
      responsableNombre: l.sdrNombre ?? "Sin asignar",
      vence: l.proximaFechaAccion!,
      estado: "pendiente" as const,
    }));
    if (filtro === "todos") return items;
    return items.filter((s) => estadoVencimiento(s.vence) === (filtro === "vencidos" ? "vencido" : filtro === "hoy" ? "hoy" : "proximo"));
  }, [query.data, filtro]);

  return { data, isLoading: query.isLoading };
}

export function useMarcarLeadSeguimientoHecho() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      await axios.patch(`${LEADS_API}/${leadId}`, { next_action: null, next_action_date: null }, authHeaders(auth?.accessToken));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "seguimiento"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin", "adquisicion"] });
    },
  });
}

/* -----------------------------------------------------------------------
   Lado empresas — simulado a propósito, ver cabecera del archivo.
------------------------------------------------------------------------ */
export function useSeguimientoEmpresas() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const query = useQuery<{ data: ISeguimiento[] }>({
    queryKey: ["superadmin", "seguimiento", "empresas"],
    queryFn: async () => {
      const res = await axios.get<{ data: ISeguimiento[] }>(`${SUPERADMIN_API_BASE}/seguimiento/postventa`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const mock = { data: seguimientosMock.filter((s) => s.entidadTipo === "empresa") };
  return { data: query.isError ? mock.data : (query.data?.data ?? mock.data), isLoading: query.isLoading, isSimulado: query.isError };
}

/* -----------------------------------------------------------------------
   KPIs — combinan ambos lados. "Completados hoy" no tiene fuente (ni
   leads ni empresas registran cuándo se marcó hecho, solo que ya no
   está pendiente) — queda en 0 hasta que el backend lo trackee.
------------------------------------------------------------------------ */
export function useKpisSeguimiento() {
  const { data: leads, isLoading: loadingLeads } = useSeguimientoLeads("todos");
  const { data: empresas, isLoading: loadingEmpresas, isSimulado } = useSeguimientoEmpresas();
  const todos = [...leads, ...empresas];

  return {
    data: {
      vencidos: todos.filter((s) => estadoVencimiento(s.vence) === "vencido").length,
      hoy: todos.filter((s) => estadoVencimiento(s.vence) === "hoy").length,
      proximos: todos.filter((s) => estadoVencimiento(s.vence) === "proximo").length,
      completadosHoy: 0,
    },
    isLoading: loadingLeads || loadingEmpresas,
    completadosHoySimulado: true,
    empresasSimulado: isSimulado,
  };
}
