"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/adquisicion.

   A diferencia de useDashboard.ts, ACÁ SÍ hay backend real (el CRM viejo
   sobre Supabase: leads, landing_leads, lead_activities). Este archivo
   mapea entre el modelo real (inglés, pipeline_stage con 12 valores,
   lead_activities plano) y el modelo del front (ILead/IGestion, español)
   — ver docs/superadmin/adquisicion-endpoints.md para el detalle completo
   de qué es real, qué le falta al backend, y el problema de paginación
   pendiente en GET /leads (trae la tabla completa a memoria — ver doc,
   es la razón por la que acá pedimos page_size chico y no confiamos en
   que el backend ya sea eficiente con volumen alto).

   Solo "Origen & CAC" (inversión por canal) sigue el patrón de
   useDashboard.ts (real-primero, cae a simulado) porque ese dato no
   existe en ningún lado todavía.
----------------------------------------------------------------------- */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { origenCacMock } from "@/mocks/superadmin";
import type { EstadoLead, CanalAdquisicion, ILead, IGestion, IDemo, IOrigenCac, ViaGestion, ResultadoGestion } from "@/interfaces/superadmin";

export const LEADS_API = "/api/superadmin/leads";

/* -----------------------------------------------------------------------
   Mapeo real <-> vista del front — exportado porque useSeguimiento.ts
   también lo necesita (deriva su bandeja de leads.next_action).
------------------------------------------------------------------------ */
export interface RealLead {
  id: string;
  contact_name: string;
  business_name?: string;
  phone_whatsapp: string;
  email?: string;
  source: string;
  pipeline_stage: string;
  plan_interest?: string;
  orders_per_day?: number;
  courier?: string;
  interested_in?: string;
  assigned_to?: string;
  observations?: string;
  city?: string;
  next_action?: string;
  next_action_date?: string;
  created_at: string;
  updated_at?: string;
  is_landing?: boolean;
}

interface RealActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string;
  performed_by?: string | null;
  created_at: string;
}

export function mapLead(r: RealLead): ILead {
  return {
    id: r.id,
    nombre: r.contact_name,
    negocio: r.business_name,
    whatsapp: r.phone_whatsapp,
    email: r.email,
    canalAdquisicion: (r.source as CanalAdquisicion) ?? "otro",
    estado: (r.pipeline_stage as EstadoLead) ?? "nuevo",
    planInteres: r.plan_interest,
    pedidosDia: r.orders_per_day,
    courier: r.courier,
    interesadoEn: r.interested_in,
    observaciones: r.observations,
    ciudad: r.city,
    sdrNombre: r.assigned_to,
    proximaAccion: r.next_action,
    proximaFechaAccion: r.next_action_date,
    fechaLead: r.created_at,
    creadoEn: r.created_at,
    actualizadoEn: r.updated_at,
    esLandingSinMigrar: r.is_landing,
  };
}

/** Reconstruye via/resultado solo si la descripción sigue el formato "[Via] Resultado — texto" que arma useRegistrarGestion. */
function mapActivity(a: RealActivity): IGestion {
  const match = /^\[(.+?)\]\s*(?:([^—]+?)\s*—\s*)?([\s\S]*)$/.exec(a.description ?? "");
  return {
    id: a.id,
    leadId: a.lead_id,
    tipo: a.activity_type === "status_change" ? "estado" : a.activity_type === "other" ? "sistema" : "gestion",
    via: match?.[1] as ViaGestion | undefined,
    resultado: match?.[2]?.trim() as ResultadoGestion | undefined,
    texto: match?.[3]?.trim() || a.description,
    autorNombre: a.performed_by || "Sistema",
    creadoEn: a.created_at,
  };
}

/* -----------------------------------------------------------------------
   1. Listado de leads (bandeja, kanban, lista) — real.
------------------------------------------------------------------------ */
export interface LeadsFilters {
  q?: string;
  estado?: EstadoLead | "todos";
  canal?: string;
  sdrNombre?: string;
  page?: number;
  pageSize?: number;
}

export function useLeadsList(filters: LeadsFilters = {}) {
  const { auth } = useAuth();
  const { page = 1, pageSize = 20 } = filters;

  const query = useQuery({
    queryKey: ["superadmin", "adquisicion", "leads", filters],
    queryFn: async () => {
      const res = await axios.get(LEADS_API, {
        ...authHeaders(auth?.accessToken),
        params: {
          page,
          limit: pageSize,
          stage: filters.estado && filters.estado !== "todos" ? filters.estado : undefined,
          source: filters.canal && filters.canal !== "todos" ? filters.canal : undefined,
          assigned_to: filters.sdrNombre && filters.sdrNombre !== "todos" ? filters.sdrNombre : undefined,
          search: filters.q || undefined,
        },
      });
      return res.data as { data: RealLead[]; pagination: { page: number; limit: number; total: number; total_pages: number } };
    },
    enabled: !!auth?.accessToken,
  });

  return {
    data: (query.data?.data ?? []).map(mapLead),
    meta: query.data?.pagination
      ? { page: query.data.pagination.page, pageSize: query.data.pagination.limit, total: query.data.pagination.total, totalPages: query.data.pagination.total_pages }
      : { page: 1, pageSize, total: 0, totalPages: 1 },
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Trae varias etapas server-side filtradas (el backend solo acepta un `stage` por vez) y las mergea acotado — mejor para volumen que traer todo sin filtro. */
export function useLeadsPorEtapas(etapas: EstadoLead[], pageSize = 50, extra?: { q?: string; canal?: string; sdrNombre?: string }) {
  const { auth } = useAuth();
  const query = useQuery({
    queryKey: ["superadmin", "adquisicion", "leads-por-etapas", etapas, pageSize, extra],
    queryFn: async () => {
      const results = await Promise.all(
        etapas.map((stage) =>
          axios
            .get(LEADS_API, {
              ...authHeaders(auth?.accessToken),
              params: {
                stage,
                limit: pageSize,
                search: extra?.q || undefined,
                source: extra?.canal && extra.canal !== "todos" ? extra.canal : undefined,
                assigned_to: extra?.sdrNombre && extra.sdrNombre !== "todos" ? extra.sdrNombre : undefined,
              },
            })
            .then((r) => (r.data.data as RealLead[]) ?? [])
        )
      );
      return results.flat().map(mapLead);
    },
    enabled: !!auth?.accessToken && etapas.length > 0,
  });
  return { data: query.data ?? [], isLoading: query.isLoading };
}

/* -----------------------------------------------------------------------
   2. Detalle + timeline de un lead — real.
------------------------------------------------------------------------ */
export function useLeadDetail(id: string | null) {
  const { auth } = useAuth();
  const query = useQuery({
    queryKey: ["superadmin", "adquisicion", "lead", id],
    queryFn: async () => {
      const res = await axios.get(`${LEADS_API}/${id}`, authHeaders(auth?.accessToken));
      const raw = res.data as RealLead & { activities?: RealActivity[] };
      return { lead: mapLead(raw), gestiones: (raw.activities ?? []).map(mapActivity) };
    },
    enabled: !!id && !!auth?.accessToken,
  });
  return { lead: query.data?.lead ?? null, gestiones: query.data?.gestiones ?? [], isLoading: query.isLoading };
}

function invalidateLeads(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: ["superadmin", "adquisicion", "leads"] });
  queryClient.invalidateQueries({ queryKey: ["superadmin", "adquisicion", "leads-por-etapas"] });
  queryClient.invalidateQueries({ queryKey: ["superadmin", "adquisicion", "kpis"] });
  if (id) queryClient.invalidateQueries({ queryKey: ["superadmin", "adquisicion", "lead", id] });
}

/* -----------------------------------------------------------------------
   3. Crear lead ("Nuevo Prospecto") — real, en 2-3 llamadas porque
   POST /leads solo persiste 5 campos (ver doc). rubro/canalesVenta/
   tipoProductos no tienen columna — quedan como nota en la actividad
   inicial para no perder el dato que cargó el usuario.
------------------------------------------------------------------------ */
export interface NuevoProspectoInput {
  nombre: string;
  negocio?: string;
  whatsapp: string;
  email?: string;
  canalAdquisicion: CanalAdquisicion;
  sdrNombre?: string;
  planInteres?: string;
  pedidosDia?: number;
  courier?: string;
  interesadoEn?: string;
  observaciones?: string;
  // sin columna real — se guardan como nota, ver arriba
  rubro?: string;
  tipoProductos?: string;
  canalesVenta?: string[];
}

export function useCreateLead() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (input: NuevoProspectoInput) => {
      const { data: created } = await axios.post(
        LEADS_API,
        { contact_name: input.nombre, business_name: input.negocio, phone_whatsapp: input.whatsapp, email: input.email, source: input.canalAdquisicion },
        authHeaders(token)
      );
      const lead: RealLead = created.data;

      const patchBody: Record<string, unknown> = {};
      if (input.sdrNombre) patchBody.assigned_to = input.sdrNombre;
      if (input.planInteres) patchBody.plan_interest = input.planInteres;
      if (input.pedidosDia !== undefined) patchBody.orders_per_day = input.pedidosDia;
      if (input.courier) patchBody.courier = input.courier;
      if (input.interesadoEn) patchBody.interested_in = input.interesadoEn;
      if (input.observaciones) patchBody.observations = input.observaciones;
      if (Object.keys(patchBody).length) {
        await axios.patch(`${LEADS_API}/${lead.id}`, patchBody, authHeaders(token));
      }

      const notaSinColumna = [
        input.rubro && `Rubro: ${input.rubro}`,
        input.tipoProductos && `Productos: ${input.tipoProductos}`,
        input.canalesVenta?.length && `Vende por: ${input.canalesVenta.join(", ")}`,
      ]
        .filter(Boolean)
        .join(" · ");
      if (notaSinColumna) {
        await axios.post(`${LEADS_API}/${lead.id}/activity`, { activity_type: "other", description: notaSinColumna }, authHeaders(token));
      }

      return mapLead(lead);
    },
    onSuccess: () => invalidateLeads(queryClient),
  });
}

/* -----------------------------------------------------------------------
   4. Mover etapa / marcar perdido — real.
------------------------------------------------------------------------ */
export function useMoverEtapa() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nuevoEstado, estadoActual, motivo }: { id: string; nuevoEstado: EstadoLead; estadoActual?: EstadoLead; motivo?: string }) => {
      await axios.patch(
        `${LEADS_API}/${id}/stage`,
        { new_stage: nuevoEstado, old_stage: estadoActual, performed_by: auth?.user?.name },
        authHeaders(auth?.accessToken)
      );
      if (motivo) {
        await axios.post(`${LEADS_API}/${id}/activity`, { activity_type: "other", description: `Motivo: ${motivo}` }, authHeaders(auth?.accessToken));
      }
    },
    onSuccess: (_d, vars) => invalidateLeads(queryClient, vars.id),
  });
}

/* -----------------------------------------------------------------------
   5. Registrar gestión — real (lead_activities + next_action si aplica).
------------------------------------------------------------------------ */
export function useRegistrarGestion() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (input: { leadId: string; via: ViaGestion; resultado?: ResultadoGestion; texto: string; proximaAccion?: string; proximaFecha?: string }) => {
      const description = `[${input.via}]${input.resultado ? ` ${input.resultado} —` : ""} ${input.texto}`;
      await axios.post(
        `${LEADS_API}/${input.leadId}/activity`,
        { activity_type: "other", description, performed_by: auth?.user?.name },
        authHeaders(token)
      );
      if (input.proximaAccion) {
        await axios.patch(
          `${LEADS_API}/${input.leadId}`,
          { next_action: input.proximaAccion, next_action_date: input.proximaFecha },
          authHeaders(token)
        );
      }
    },
    onSuccess: (_d, vars) => invalidateLeads(queryClient, vars.leadId),
  });
}

/* -----------------------------------------------------------------------
   6. Convertir lead en empresa — real (RPC activate_lead_v3).
------------------------------------------------------------------------ */
export function useConvertirLead() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data } = await axios.post(`${LEADS_API}/${leadId}/activate`, {}, authHeaders(auth?.accessToken));
      return data;
    },
    onSuccess: (_d, leadId) => {
      invalidateLeads(queryClient, leadId);
      queryClient.invalidateQueries({ queryKey: ["superadmin", "empresas"] });
    },
  });
}

/* -----------------------------------------------------------------------
   7. Demos — sin tabla propia. "Agendar" = mover a demo_agendada +
   guardar next_action/next_action_date reales. "Ver demos" = leer los
   leads que están en las 3 etapas de demo (ver useLeadsPorEtapas).
------------------------------------------------------------------------ */
const ETAPAS_DEMO: EstadoLead[] = ["demo_pendiente", "demo_agendada", "demo_realizada"];

export function useDemos() {
  const { data, isLoading } = useLeadsPorEtapas(ETAPAS_DEMO, 100);
  const demos: IDemo[] = useMemo(
    () =>
      data.map((lead) => ({
        id: lead.id,
        leadId: lead.id,
        negocio: lead.negocio || lead.nombre,
        fecha: lead.proximaFechaAccion,
        sdrNombre: lead.sdrNombre,
        estado: lead.estado === "demo_realizada" ? "realizada" : "agendada",
        notas: lead.proximaAccion,
        creadoEn: lead.creadoEn,
      })),
    [data]
  );
  return { data: demos, isLoading };
}

export function useAgendarDemo() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (input: { leadId: string; fecha: string; hora: string; sdrNombre: string; tipo: "venta" | "onboarding" }) => {
      await axios.patch(`${LEADS_API}/${input.leadId}/stage`, { new_stage: "demo_agendada" }, authHeaders(token));
      await axios.patch(
        `${LEADS_API}/${input.leadId}`,
        { next_action: "Realizar demo", next_action_date: input.fecha, assigned_to: input.sdrNombre },
        authHeaders(token)
      );
      await axios.post(
        `${LEADS_API}/${input.leadId}/activity`,
        { activity_type: "other", description: `Demo agendada — ${input.hora} — SDR: ${input.sdrNombre} — Tipo: ${input.tipo}` },
        authHeaders(token)
      );
    },
    onSuccess: (_d, vars) => invalidateLeads(queryClient, vars.leadId),
  });
}

/* -----------------------------------------------------------------------
   8. KPIs de Adquisición — "Sin abordar" y "Leads web total" son reales
   (cuentan sobre `pagination.total`, no traen filas de más). "Demos hoy",
   "Pagos web hoy" y "Conversión web" no tienen fuente real (ver doc).
------------------------------------------------------------------------ */
async function countLeads(params: Record<string, unknown>, token?: string) {
  const res = await axios.get(LEADS_API, { ...authHeaders(token), params: { ...params, limit: 1 } });
  return (res.data.pagination?.total as number) ?? 0;
}

export function useKpisAdquisicion() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const sinAbordar = useQuery({
    queryKey: ["superadmin", "adquisicion", "kpis", "sin-abordar"],
    queryFn: () => countLeads({ stage: "nuevo" }, token),
    enabled: !!token,
  });
  const totalLeads = useQuery({
    queryKey: ["superadmin", "adquisicion", "kpis", "total"],
    queryFn: () => countLeads({}, token),
    enabled: !!token,
  });

  return {
    data: {
      sinAbordar: sinAbordar.data ?? 0,
      leadsWebTotal: totalLeads.data ?? 0, // aproximado: total de leads, no solo canales web (ver doc — falta source_breakdown)
      demosHoy: 0,
      pagosWebHoy: 0,
      conversionWebPct: 0,
    },
    isLoading: sinAbordar.isLoading || totalLeads.isLoading,
    simuladoFields: ["demosHoy", "pagosWebHoy", "conversionWebPct"] as const,
  };
}

/* -----------------------------------------------------------------------
   9. Rendimiento por SDR — real vía pipeline/summary.
------------------------------------------------------------------------ */
export interface RendimientoSdr {
  sdrNombre: string;
  leads: number;
  cierres: number;
  efectividadPct: number;
}

interface PipelineSummaryResponse {
  salesperson_breakdown: { salesperson: string; managed_leads: number; closed_leads: number }[];
  states_count: Record<string, number>;
}

/** Base compartida — React Query dedupea por queryKey, así que useRendimientoSdr y useEstadosPipeline no duplican el fetch. */
function usePipelineSummaryRaw() {
  const { auth } = useAuth();
  return useQuery({
    queryKey: ["superadmin", "adquisicion", "pipeline-summary"],
    queryFn: async () => {
      const res = await axios.get<PipelineSummaryResponse>("/api/superadmin/pipeline/summary", authHeaders(auth?.accessToken));
      return res.data;
    },
    enabled: !!auth?.accessToken,
  });
}

export function useRendimientoSdr() {
  const query = usePipelineSummaryRaw();
  const data: RendimientoSdr[] = (query.data?.salesperson_breakdown ?? []).map((s) => ({
    sdrNombre: s.salesperson,
    leads: s.managed_leads,
    cierres: s.closed_leads,
    efectividadPct: s.managed_leads > 0 ? Math.round((s.closed_leads / s.managed_leads) * 1000) / 10 : 0,
  }));
  return { data, isLoading: query.isLoading };
}

/** Leads por etapa — real, ya agregado por pipeline/summary (states_count). */
export function useEstadosPipeline() {
  const query = usePipelineSummaryRaw();
  return { data: query.data?.states_count ?? {}, isLoading: query.isLoading };
}

/* -----------------------------------------------------------------------
   10. Origen & CAC — sin fuente real (falta source_breakdown + tabla de
   inversión, ver doc). Apunta ya al endpoint propuesto para cuando exista.
------------------------------------------------------------------------ */
export function useOrigenCac() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const query = useQuery<IOrigenCac[]>({
    queryKey: ["superadmin", "adquisicion", "origen-cac"],
    queryFn: async () => {
      const res = await axios.get<IOrigenCac[]>(`${SUPERADMIN_API_BASE}/adquisicion/origen-cac`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  return { data: query.isError ? origenCacMock : (query.data ?? origenCacMock), isLoading: query.isLoading, isSimulado: query.isError };
}
