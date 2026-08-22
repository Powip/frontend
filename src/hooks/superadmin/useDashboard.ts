"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/dashboard — un archivo por página del
   panel (ver docs/superadmin/dashboard-endpoints.md para el contrato
   completo de cada endpoint nuevo, priorizado por costo/impacto).

   Regla de este archivo: cada hook intenta PRIMERO el endpoint real.
   Si ese endpoint todavía no existe en backend (404 / network error),
   el hook cae a datos de ejemplo y expone `isSimulado: true` para que el
   componente lo marque en rojo — sin que nadie tenga que volver a tocar
   este archivo el día que el endpoint se levante: en cuanto responda,
   `isSimulado` pasa a `false` solo.

   Las 3 fuentes que YA son reales (saas-metrics, conversion-funnel,
   ventas/summary) no tienen fallback: ya funcionan hoy.
------------------------------------------------------------------------ */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useSaasMetrics } from "@/hooks/useSaasMetrics";
import { useConversionFunnel } from "@/hooks/useConversionFunnel";
import { getGlobalSalesSummary } from "@/services/salesService";
import { getAllCompanies } from "@/services/companyService";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import {
  businessOverviewMock,
  mrrSerieMock,
  clientesActivosSerieMock,
  composicionClientesMock,
  alertasImportantesMock,
  actividadRecienteMock,
  clientesEnRiesgoMock,
  adopcionModulosMock,
  centroAccionMock,
  canalesRedMock,
  oportunidadProductoMock,
  integracionesMock,
  empresasMock,
} from "@/mocks/superadmin";
import type {
  IAlertaImportante,
  IActividadEvento,
  IClienteEnRiesgo,
  IAdopcionModulo,
  ICentroAccionTarea,
  ICanalRed,
  IOportunidadProducto,
  IComposicionClientes,
  IIntegracion,
} from "@/interfaces/superadmin";

/* -----------------------------------------------------------------------
   Helper interno — intenta el endpoint real; si falla, devuelve el
   fallback simulado. Un solo lugar para ese patrón, no 10 copias.
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
   1. Business Overview — MRR, Clientes Activos, Nuevos, Churn (reales,
   ya funcionan hoy) + Trials/Conversión/Demos Hoy (simulados: ver doc,
   "trial" no existe en ms-subscription y "Demos Hoy" requiere extender
   pipeline/summary).
------------------------------------------------------------------------ */
export interface BusinessOverviewData {
  mrr: number;
  mrrDeltaPct: number;
  clientesActivos: number;
  totalCompanies: number;
  clientesActivosDeltaPct: number;
  nuevosPeriodo: number;
  nuevosLabel: string;
  churnPct: number;
  trialsActivos: number;
  conversionTrialPagoPct: number;
  ingresosHoy: number;
  demosHoy: number;
  isTrialsSimulado: boolean;
  isDemosSimulado: boolean;
}

export function useBusinessOverview(from?: string, to?: string) {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const { data: saas, isLoading: loadingSaas } = useSaasMetrics(token, from, to);

  const { data: ingresosHoy, isLoading: loadingIngresos } = useQuery({
    queryKey: ["superadmin", "dashboard", "ingresos-hoy"],
    queryFn: async () => {
      const hoy = new Date();
      const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
      const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59).toISOString();
      const summary = await getGlobalSalesSummary(token!, inicioDia, finDia);
      return summary.totalSales ?? 0;
    },
    enabled: !!token,
  });

  const isLoading = loadingSaas || loadingIngresos || !saas;

  const data: BusinessOverviewData | null = useMemo(() => {
    if (!saas) return null;
    const clientesActivos = Math.round(saas.totalCompanies * (saas.activationRate / 100));
    const mrrStartPeriodo = Math.max(0, saas.mrr - saas.mrrNuevo + saas.mrrPerdido);
    const mrrDeltaPct = mrrStartPeriodo > 0 ? Math.round(((saas.mrrNuevo - saas.mrrPerdido) / mrrStartPeriodo) * 1000) / 10 : 0;
    return {
      mrr: saas.mrr,
      mrrDeltaPct,
      clientesActivos,
      totalCompanies: saas.totalCompanies,
      clientesActivosDeltaPct: Math.round(saas.altas.growth * 10) / 10,
      nuevosPeriodo: saas.altas.current,
      nuevosLabel: from ? "Nuevos en el período" : "Nuevos este mes",
      churnPct: Math.round(saas.churnRate * 10) / 10,
      // GET /api/v1/dashboard/clientes-composicion en la práctica no cubre esto;
      // "trial" y "demos hoy" quedan simulados hasta que existan en backend
      // (ver docs/superadmin/dashboard-endpoints.md).
      trialsActivos: businessOverviewMock.trialsActivos,
      conversionTrialPagoPct: businessOverviewMock.conversionTrialPagoPct,
      demosHoy: businessOverviewMock.demosHoy,
      isTrialsSimulado: true,
      isDemosSimulado: true,
      ingresosHoy: ingresosHoy ?? 0,
    };
  }, [saas, ingresosHoy, from]);

  return { data, isLoading };
}

/* -----------------------------------------------------------------------
   2. Serie de crecimiento (MRR + Clientes activos, 12 meses) — P0.
------------------------------------------------------------------------ */
export interface GrowthSeries {
  mrr: { mes: string; valor: number }[];
  clientesActivos: { mes: string; valor: number }[];
}

export function useGrowthSeries(meses = 12) {
  const { auth } = useAuth();
  return useBackedQuery<GrowthSeries>({
    queryKey: ["superadmin", "dashboard", "growth-series", meses],
    path: "/dashboard/growth-series",
    params: { meses },
    token: auth?.accessToken,
    mock: { mrr: mrrSerieMock, clientesActivos: clientesActivosSerieMock },
  });
}

/* -----------------------------------------------------------------------
   3. Top empresas por MRR — P0.
------------------------------------------------------------------------ */
export interface TopEmpresa {
  empresaId: string;
  nombre: string;
  logoIniciales?: string;
  colorAvatar?: string;
  plan: string;
  mrr: number;
  estado: string;
}

const TOP_EMPRESAS_MOCK: TopEmpresa[] = [...empresasMock]
  .sort((a, b) => b.mrr - a.mrr)
  .slice(0, 6)
  .map((e) => ({
    empresaId: e.id,
    nombre: e.nombre,
    logoIniciales: e.logoIniciales,
    colorAvatar: e.colorAvatar,
    plan: e.plan,
    mrr: e.mrr,
    estado: e.estado,
  }));

export function useTopEmpresas(limit = 6) {
  const { auth } = useAuth();
  return useBackedQuery<{ data: TopEmpresa[] }>({
    queryKey: ["superadmin", "dashboard", "top-empresas", limit],
    path: "/dashboard/top-empresas",
    params: { limit },
    token: auth?.accessToken,
    mock: { data: TOP_EMPRESAS_MOCK.slice(0, limit) },
  });
}

/* -----------------------------------------------------------------------
   4. Canales de venta de la red — P0.
------------------------------------------------------------------------ */
export interface CanalesRedData {
  canales: ICanalRed[];
  oportunidad: IOportunidadProducto;
  isSimulado: boolean;
}

/**
 * Real — `company.sales_channels` es un campo real de ms-company (ver
 * docs/superadmin/empresas-endpoints.md). Reusa la misma queryKey que
 * useEmpresasList (src/hooks/superadmin/useEmpresas.ts) para no duplicar
 * el fetch completo de empresas — React Query dedupea por key.
 * Solo "oportunidad" (qué priorizar) sigue siendo editorial/simulado.
 */
export function useCanalesRed(): CanalesRedData & { isLoading: boolean } {
  const { auth } = useAuth();
  const query = useQuery({
    queryKey: ["superadmin", "empresas", "raw"],
    queryFn: () => getAllCompanies(auth!.accessToken),
    enabled: !!auth?.accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const canales = useMemo(() => {
    const counts = new Map<string, number>();
    (query.data ?? []).forEach((c) => (c.sales_channels ?? []).forEach((ch: string) => counts.set(ch, (counts.get(ch) ?? 0) + 1)));
    const total = query.data?.length || 1;
    return Array.from(counts.entries())
      .map(([canal, count]) => ({ canal, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [query.data]);

  return { canales, oportunidad: oportunidadProductoMock, isSimulado: false, isLoading: query.isLoading };
}

/* -----------------------------------------------------------------------
   5. Composición de clientes (donut) — P1, ver nota de segmentos en doc.
------------------------------------------------------------------------ */
export function useComposicionClientes() {
  const { auth } = useAuth();
  return useBackedQuery<IComposicionClientes[]>({
    queryKey: ["superadmin", "dashboard", "composicion"],
    path: "/dashboard/clientes-composicion",
    token: auth?.accessToken,
    mock: composicionClientesMock,
  });
}

/* -----------------------------------------------------------------------
   6. Clientes en riesgo — P1, depende de health_score o regla MVP.
------------------------------------------------------------------------ */
export function useClientesEnRiesgo(limit = 10) {
  const { auth } = useAuth();
  return useBackedQuery<{ data: IClienteEnRiesgo[] }>({
    queryKey: ["superadmin", "dashboard", "clientes-riesgo", limit],
    path: "/dashboard/clientes-riesgo",
    params: { limit },
    token: auth?.accessToken,
    mock: { data: clientesEnRiesgoMock.slice(0, limit) },
  });
}

/* -----------------------------------------------------------------------
   7. Salud de la plataforma (integraciones) — P1, agregado nuevo sobre
   ms-integrations (hoy solo hay connection-test por vendor/empresa).
------------------------------------------------------------------------ */
export interface SaludIntegracionesData {
  integraciones: IIntegracion[];
  uptimePromedio: number;
}

export function useSaludIntegraciones() {
  const { auth } = useAuth();
  const activas = integracionesMock.filter((i) => i.estado === "operativo").length;
  return useBackedQuery<SaludIntegracionesData>({
    queryKey: ["superadmin", "dashboard", "salud-integraciones"],
    path: "/dashboard/salud-integraciones",
    token: auth?.accessToken,
    mock: { integraciones: integracionesMock, uptimePromedio: 98.6 },
  });
}
// Nota: `activas`/`total` para la card se derivan de `integraciones.length` en el componente.

/* -----------------------------------------------------------------------
   8. Embudo comercial — YA REAL (Supabase leads + ms-company). No hay
   fallback simulado porque no lo necesita.
------------------------------------------------------------------------ */
export function useEmbudoComercial() {
  const { auth } = useAuth();
  return useConversionFunnel(auth?.accessToken);
}

/* -----------------------------------------------------------------------
   9. Actividad en tiempo real (feed) — P2, depende de audit_log real.
------------------------------------------------------------------------ */
export function useActividadReciente(limit = 10) {
  const { auth } = useAuth();
  return useBackedQuery<{ data: IActividadEvento[] }>({
    queryKey: ["superadmin", "dashboard", "actividad", limit],
    path: "/dashboard/actividad",
    params: { limit },
    token: auth?.accessToken,
    mock: { data: actividadRecienteMock.slice(0, limit) },
  });
}

/* -----------------------------------------------------------------------
   10. Alertas importantes — P2, depende del motor de alertas (8.24).
------------------------------------------------------------------------ */
export function useAlertasImportantes() {
  const { auth } = useAuth();
  return useBackedQuery<{ data: IAlertaImportante[] }>({
    queryKey: ["superadmin", "dashboard", "alertas"],
    path: "/dashboard/alertas",
    token: auth?.accessToken,
    mock: { data: alertasImportantesMock },
  });
}

/* -----------------------------------------------------------------------
   11. KPIs de producto (DAU/WAU/MAU) — P2, requiere tracking de producto.
------------------------------------------------------------------------ */
export interface ProductoKpi {
  label: string;
  value: number;
}

const PRODUCTO_KPIS_MOCK: ProductoKpi[] = [
  { label: "DAU", value: 412 },
  { label: "WAU", value: 1180 },
  { label: "MAU", value: 2940 },
];

export function useProductoKpis() {
  const { auth } = useAuth();
  return useBackedQuery<{ data: ProductoKpi[] }>({
    queryKey: ["superadmin", "dashboard", "producto-kpis"],
    path: "/dashboard/producto-kpis",
    token: auth?.accessToken,
    mock: { data: PRODUCTO_KPIS_MOCK },
  });
}

export function useAdopcionModulos() {
  const { auth } = useAuth();
  return useBackedQuery<{ data: IAdopcionModulo[] }>({
    queryKey: ["superadmin", "dashboard", "adopcion-modulos"],
    path: "/dashboard/adopcion-modulos",
    token: auth?.accessToken,
    mock: { data: adopcionModulosMock },
  });
}

/* -----------------------------------------------------------------------
   12. Soporte & Experiencia — P2, depende del módulo Soporte (ticket).
------------------------------------------------------------------------ */
export interface SoporteResumen {
  ticketsAbiertos: number;
  tiempoRespuestaPromedioMin: number;
  csat: number;
}

const SOPORTE_RESUMEN_MOCK: SoporteResumen = { ticketsAbiertos: 6, tiempoRespuestaPromedioMin: 38, csat: 4.6 };

export function useSoporteResumen() {
  const { auth } = useAuth();
  return useBackedQuery<SoporteResumen>({
    queryKey: ["superadmin", "dashboard", "soporte-resumen"],
    path: "/dashboard/soporte-resumen",
    token: auth?.accessToken,
    mock: SOPORTE_RESUMEN_MOCK,
  });
}

/* -----------------------------------------------------------------------
   13. Centro de Acción — P2, requiere tabla tarea_admin. La mutación
   intenta el PATCH real; si el endpoint no existe todavía, resuelve
   igual en el cache local para no romper la demo (best-effort a
   propósito: no hay nada que "reintentar" contra un endpoint que aún
   no existe).
------------------------------------------------------------------------ */
export function useCentroAccion() {
  const { auth } = useAuth();
  return useBackedQuery<{ data: ICentroAccionTarea[] }>({
    queryKey: ["superadmin", "dashboard", "centro-accion"],
    path: "/dashboard/centro-accion",
    token: auth?.accessToken,
    mock: { data: centroAccionMock },
  });
}

export function useMarcarTareaHecha() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async ({ id, hecho }: { id: string; hecho: boolean }) => {
      try {
        await axios.patch(`${SUPERADMIN_API_BASE}/dashboard/centro-accion/${id}`, { hecho }, authHeaders(token));
      } catch {
        // Endpoint todavía no existe en backend — no es un error real del
        // usuario. Mutamos el mock en memoria para que el toggle no "rebote"
        // al refetch (ver cache local optimista, comentario arriba).
        const tarea = centroAccionMock.find((t) => t.id === id);
        if (tarea) tarea.hecho = hecho;
      }
      return { id, hecho };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "dashboard", "centro-accion"] });
    },
  });
}
