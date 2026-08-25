"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/suscripciones — ver
   docs/superadmin/suscripciones-endpoints.md para el contrato completo.

   Resumen del estado real (detalle en el doc):
   - KPIs "MRR total"/"Tasa de churn"/"ARR": reusan useSaasMetrics, ya real
     (compartido con el Dashboard, docs/superadmin/dashboard-endpoints.md).
   - Catálogo de planes: subscriptionService.getAllPlans, ya real.
   - MRR histórico: reusa useGrowthSeries del Dashboard (mismo endpoint,
     no se duplica).
   - Tabla por empresa, estado agregado, MRR por plan: apuntan a endpoints
     propuestos bajo SUPERADMIN_API_BASE (todavía no existen) — caen a
     mock con isSimulado hasta que respondan.
   - Próximos vencimientos: intenta subscriptionService.getExpiringSubscriptionsAlert
     (existe pero nunca confirmado en uso real, ver doc) y si falla cae al
     mismo mock derivado que usaba el servicio anterior.
------------------------------------------------------------------------ */

import { useMemo } from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useSaasMetrics } from "@/hooks/useSaasMetrics";
import { useGrowthSeries } from "./useDashboard";
import { getAllCompanies } from "@/services/companyService";
import { getAllPlans, getExpiringSubscriptionsAlert } from "@/services/subscriptionService";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { suscripcionesMock, mrrPorPlanMock } from "@/mocks/superadmin";
import type { ISuscripcion, EstadoSuscripcion, PlanEmpresa, IMrrHistorico, IMrrPorPlan } from "@/interfaces/superadmin";
import type { PageParams, PagedResponse } from "@/services/superadmin/shared";

/* -----------------------------------------------------------------------
   Helper interno — mismo patrón que useDashboard.ts: intenta el endpoint
   real, si falla (404 / network error) cae al mock y marca isSimulado.
------------------------------------------------------------------------ */
function useBackedQuery<T>(opts: {
  queryKey: unknown[];
  path: string;
  token?: string;
  params?: Record<string, unknown>;
  mock: T;
  enabled?: boolean;
}): { data: T; isLoading: boolean; isSimulado: boolean } {
  const query = useQuery<T>({
    queryKey: opts.queryKey,
    queryFn: async () => {
      const res = await axios.get<T>(`${SUPERADMIN_API_BASE}${opts.path}`, {
        ...authHeaders(opts.token),
        params: opts.params,
      });
      return res.data;
    },
    enabled: (opts.enabled ?? true) && !!opts.token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  } as UseQueryOptions<T>);

  return {
    data: query.isError ? opts.mock : (query.data ?? opts.mock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/* -----------------------------------------------------------------------
   1. KPIs — MRR total / Churn / ARR reales (saas-metrics, compartido con
   el Dashboard). Activas / Canceladas / Nuevas(30d) dependen del endpoint
   agregado propuesto (resumen-estado) — ver punto 2 más abajo, un solo
   fetch alimenta ambos.
------------------------------------------------------------------------ */
export interface KpisSuscripciones {
  mrrTotal: number;
  arr: number;
  tasaChurnPct: number;
  activas: number;
  canceladas: number;
  nuevas30d: number;
  isEstadoSimulado: boolean;
}

export function useKpisSuscripciones() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const { data: saas, isLoading: loadingSaas } = useSaasMetrics(token);
  const { data: estado, isLoading: loadingEstado, isSimulado } = useResumenEstadoSuscripciones();

  const isLoading = loadingSaas || loadingEstado || !saas;

  const data: KpisSuscripciones | null = useMemo(() => {
    if (!saas) return null;
    return {
      mrrTotal: saas.mrr,
      arr: saas.mrr * 12,
      tasaChurnPct: Math.round(saas.churnRate * 10) / 10,
      activas: estado.activa,
      canceladas: estado.cancelada,
      nuevas30d: estado.nuevas30d,
      isEstadoSimulado: isSimulado,
    };
  }, [saas, estado, isSimulado]);

  return { data, isLoading };
}

/* -----------------------------------------------------------------------
   2. Estado agregado (activa/trial/vencida/cancelada + nuevas30d) — P0,
   endpoint propuesto: GET /suscripciones/resumen-estado.
------------------------------------------------------------------------ */
export interface ResumenEstadoSuscripciones extends Record<EstadoSuscripcion, number> {
  nuevas30d: number;
}

const RESUMEN_ESTADO_MOCK: ResumenEstadoSuscripciones = (() => {
  const conteos: ResumenEstadoSuscripciones = { activa: 0, trial: 0, vencida: 0, cancelada: 0, nuevas30d: 0 };
  suscripcionesMock.forEach((s) => {
    conteos[s.estado] += 1;
    const dias = (Date.now() - new Date(s.creadoEn).getTime()) / 86400000;
    if (dias <= 30) conteos.nuevas30d += 1;
  });
  return conteos;
})();

export function useResumenEstadoSuscripciones() {
  const { auth } = useAuth();
  return useBackedQuery<ResumenEstadoSuscripciones>({
    queryKey: ["superadmin", "suscripciones", "resumen-estado"],
    path: "/suscripciones/resumen-estado",
    token: auth?.accessToken,
    mock: RESUMEN_ESTADO_MOCK,
  });
}

/* -----------------------------------------------------------------------
   3. MRR por plan — P0, endpoint propuesto: GET /suscripciones/mrr-por-plan.
------------------------------------------------------------------------ */
export function useMrrPorPlan() {
  const { auth } = useAuth();
  return useBackedQuery<{ data: IMrrPorPlan[] }>({
    queryKey: ["superadmin", "suscripciones", "mrr-por-plan"],
    path: "/suscripciones/mrr-por-plan",
    token: auth?.accessToken,
    mock: { data: mrrPorPlanMock },
  });
}

/* -----------------------------------------------------------------------
   4. MRR histórico — comparte endpoint con el Dashboard, no se duplica.
   useGrowthSeries ya intenta el real y cae a mock con isSimulado; acá
   solo remapeamos {mes, valor} -> {mes, mrr} para StatsChart.
------------------------------------------------------------------------ */
export function useMrrHistoricoSuscripciones() {
  const { data, isLoading, isSimulado } = useGrowthSeries(12);
  const mrr: IMrrHistorico[] = useMemo(() => data.mrr.map((p) => ({ mes: p.mes, mrr: p.valor })), [data.mrr]);
  return { data: mrr, isLoading, isSimulado };
}

/* -----------------------------------------------------------------------
   5. Catálogo de planes — real, GET {API_SUBS}/plans.
------------------------------------------------------------------------ */
export function usePlanesCatalogo() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  return useQuery({
    queryKey: ["superadmin", "suscripciones", "planes"],
    queryFn: () => getAllPlans(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}

/* -----------------------------------------------------------------------
   6. Tabla de suscripciones por empresa — P0, endpoint propuesto:
   GET /suscripciones?page&pageSize&q&estado&plan.
------------------------------------------------------------------------ */
export interface SuscripcionesFilters extends PageParams {
  q?: string;
  estado?: EstadoSuscripcion | "todos";
  plan?: PlanEmpresa | "todos";
}

function mockSuscripcionesPage(filters: SuscripcionesFilters): PagedResponse<ISuscripcion> {
  let items = [...suscripcionesMock];
  if (filters.estado && filters.estado !== "todos") items = items.filter((s) => s.estado === filters.estado);
  if (filters.plan && filters.plan !== "todos") items = items.filter((s) => s.plan === filters.plan);
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    items = items.filter((s) => [s.empresaNombre, s.plan, s.metodoPago].some((h) => h?.toLowerCase().includes(q)));
  }
  const pageSize = filters.pageSize ?? 10;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const start = (page - 1) * pageSize;
  return { data: items.slice(start, start + pageSize), meta: { page, pageSize, total, totalPages } };
}

export function useSuscripcionesTabla(filters: SuscripcionesFilters) {
  const { auth } = useAuth();
  return useBackedQuery<PagedResponse<ISuscripcion>>({
    queryKey: ["superadmin", "suscripciones", "list", filters],
    path: "/suscripciones",
    params: { page: filters.page ?? 1, page_size: filters.pageSize ?? 10, q: filters.q, estado: filters.estado, plan: filters.plan },
    token: auth?.accessToken,
    mock: mockSuscripcionesPage(filters),
  });
}

/* -----------------------------------------------------------------------
   7. Próximos vencimientos — intenta el servicio real de ms-subscription
   (existe pero nunca confirmado en uso, ver doc). Si responde, enriquece
   cada resultado con el nombre de empresa vía la lista ya cacheada de
   getAllCompanies (join por userId, mismo patrón que empresas-endpoints.md
   documenta para el tab Suscripción del Perfil 360). Si falla, cae al
   mismo derivado que usaba el mock service anterior.
------------------------------------------------------------------------ */
export interface ProximoVencimiento {
  id: string;
  empresaId: string;
  empresaNombre: string;
  plan: string;
  proximoPago: string;
  estado: EstadoSuscripcion;
}

function mockProximosVencimientos(limit = 8): ProximoVencimiento[] {
  const activas = suscripcionesMock.filter((s) => s.estado === "activa" || s.estado === "trial");
  return [...activas]
    .sort((a, b) => new Date(a.proximoPago).getTime() - new Date(b.proximoPago).getTime())
    .slice(0, limit)
    .map((s) => ({ id: s.id, empresaId: s.empresaId, empresaNombre: s.empresaNombre, plan: s.plan, proximoPago: s.proximoPago, estado: s.estado }));
}

export function useProximosVencimientos(limit = 8) {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const expiringQuery = useQuery({
    queryKey: ["superadmin", "suscripciones", "expiring-soon", limit],
    queryFn: () => getExpiringSubscriptionsAlert(token!, 30),
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const companiesQuery = useQuery({
    queryKey: ["superadmin", "empresas", "raw"],
    queryFn: () => getAllCompanies(token!),
    enabled: !!token && !expiringQuery.isError && !!expiringQuery.data,
    staleTime: 5 * 60 * 1000,
  });

  const isSimulado = expiringQuery.isError;
  const isLoading = expiringQuery.isLoading || (!!expiringQuery.data && companiesQuery.isLoading);

  const data: ProximoVencimiento[] = useMemo(() => {
    if (isSimulado || !expiringQuery.data) return mockProximosVencimientos(limit);
    const companiesByUserId = new Map((companiesQuery.data ?? []).map((c) => [c.userId, c]));
    return expiringQuery.data.slice(0, limit).map((s) => {
      const empresa = companiesByUserId.get(s.userId);
      return {
        id: s.id,
        empresaId: empresa?.id ?? s.userId,
        empresaNombre: empresa?.name ?? "Empresa sin resolver",
        plan: s.plan?.name ?? "—",
        proximoPago: s.endDate,
        estado: (s.status?.toLowerCase() as EstadoSuscripcion) ?? "activa",
      };
    });
  }, [isSimulado, expiringQuery.data, companiesQuery.data, limit]);

  return { data, isLoading, isSimulado };
}
