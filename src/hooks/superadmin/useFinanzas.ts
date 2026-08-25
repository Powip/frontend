"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/finanzas — P&L / ingresos SaaS de POWIP
   (ver docs/superadmin/finanzas-endpoints.md para el contrato completo).

   No confundir con src/components/finanzas/ (Caja & COD por tienda, otra
   sección del panel) — este archivo es exclusivamente para la vista de
   Finanzas de Super Admin.

   Mismo patrón que el resto de src/hooks/superadmin/use*.ts: cada hook
   intenta PRIMERO el endpoint real bajo SUPERADMIN_API_BASE. Si todavía
   no existe (404 / network error), cae al mock y expone `isSimulado`
   para que el componente lo marque en rojo — sin tocar este archivo el
   día que el endpoint se levante.

   Excepción: `mrrActual` en useResumenMes no tiene fallback simulado
   porque no lo necesita — ya es real hoy vía saas-metrics (mismo dato
   que usa el dashboard, ver docs/superadmin/dashboard-endpoints.md).
------------------------------------------------------------------------ */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useSaasMetrics } from "@/hooks/useSaasMetrics";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { mrrWaterfallMock, ingresosFuenteMock, cobrosMock, cohortesMock } from "@/mocks/superadmin";
import type { IMrrWaterfallItem, IIngresoFuente, ICobro, ICohorte } from "@/interfaces/superadmin";

/** Meta de facturación mensual usada como fallback simulado — ver nota de
 * inconsistencia en el doc: `saas-metrics.targets.mrr.meta` ya devuelve
 * 80000 para lo que probablemente es el mismo concepto de negocio. */
const META_MES_MOCK = 50000;

/* -----------------------------------------------------------------------
   Helper interno — mismo patrón que useDashboard.ts / useSeguimiento.ts:
   intenta el endpoint real; si falla, devuelve el fallback simulado.
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
   1. Resumen del mes — KPIs (Facturado / Proyección de cierre / MRR
   actual / MRR proyectado) + Meta del mes. `mrrActual` es real (reusa
   saas-metrics.mrr, no un endpoint propio); el resto queda simulado
   hasta que exista /finanzas/resumen-mes — ver doc, requiere definir
   la fórmula de proyección antes de construirlo "bien".
------------------------------------------------------------------------ */
export interface ResumenMesData {
  facturadoMes: number;
  proyeccionCierre: number;
  mrrActual: number;
  mrrProyectado: number;
  meta: number;
  avancePct: number;
}

interface ResumenMesBackend {
  facturadoMes: number;
  proyeccionCierre: number;
  mrrProyectado: number;
  meta: number;
  avancePct: number;
}

const RESUMEN_MES_MOCK: ResumenMesBackend = (() => {
  const cierre = mrrWaterfallMock.find((w) => w.tipo === "cierre")?.valor ?? 0;
  return {
    facturadoMes: cierre,
    proyeccionCierre: cierre,
    mrrProyectado: cierre,
    meta: META_MES_MOCK,
    avancePct: Math.min(100, Math.round((cierre / META_MES_MOCK) * 100)),
  };
})();

export function useResumenMes(periodo?: string) {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const { data: saas, isLoading: loadingSaas } = useSaasMetrics(token);
  const backed = useBackedQuery<ResumenMesBackend>({
    queryKey: ["superadmin", "finanzas", "resumen-mes", periodo],
    path: "/finanzas/resumen-mes",
    params: periodo ? { periodo } : undefined,
    token,
    mock: RESUMEN_MES_MOCK,
  });

  const data: ResumenMesData = {
    ...backed.data,
    mrrActual: saas?.mrr ?? RESUMEN_MES_MOCK.facturadoMes,
  };

  return {
    data,
    isLoading: loadingSaas || backed.isLoading,
    isSimulado: backed.isSimulado,
  };
}

/* -----------------------------------------------------------------------
   2. MRR de cierre — Waterfall (Nuevo/Expansión/Downgrade/Churn). Más
   granular que dashboard's growth-series — ver doc, extiende el
   mrr_snapshot propuesto en dashboard-endpoints.md #1.
------------------------------------------------------------------------ */
export function useMrrWaterfall(periodo?: string) {
  const { auth } = useAuth();
  return useBackedQuery<{ data: IMrrWaterfallItem[] }>({
    queryKey: ["superadmin", "finanzas", "mrr-waterfall", periodo],
    path: "/finanzas/mrr-waterfall",
    params: periodo ? { periodo } : undefined,
    token: auth?.accessToken,
    mock: { data: mrrWaterfallMock },
  });
}

/* -----------------------------------------------------------------------
   3. Ingresos por fuente (Suscripciones / POWIP Payment / Add-ons) —
   ver doc: "Add-ons" está bloqueado porque hoy no existe como entidad
   facturable real en ningún backend.
------------------------------------------------------------------------ */
export function useIngresosFuente(periodo?: string) {
  const { auth } = useAuth();
  return useBackedQuery<{ data: IIngresoFuente[] }>({
    queryKey: ["superadmin", "finanzas", "ingresos-fuente", periodo],
    path: "/finanzas/ingresos-fuente",
    params: periodo ? { periodo } : undefined,
    token: auth?.accessToken,
    mock: { data: ingresosFuenteMock },
  });
}

/* -----------------------------------------------------------------------
   4. Detalle de cobros — ver doc: candidato a compartir fuente con
   Facturación (docs/superadmin/facturacion-endpoints.md) en vez de
   tener un endpoint propio duplicado.
------------------------------------------------------------------------ */
export function useCobros(periodo?: string, limit = 20) {
  const { auth } = useAuth();
  return useBackedQuery<{ data: ICobro[] }>({
    queryKey: ["superadmin", "finanzas", "cobros", periodo, limit],
    path: "/finanzas/cobros",
    params: { periodo, limit },
    token: auth?.accessToken,
    mock: { data: cobrosMock.slice(0, limit) },
  });
}

/* -----------------------------------------------------------------------
   5. Retención por cohorte de alta (Sección 8.22) — ver doc: requiere
   snapshot mensual POR EMPRESA, no solo el agregado que pide el
   dashboard.
------------------------------------------------------------------------ */
export function useCohortes(meses = 6) {
  const { auth } = useAuth();
  return useBackedQuery<{ data: ICohorte[] }>({
    queryKey: ["superadmin", "finanzas", "cohortes", meses],
    path: "/finanzas/cohortes",
    params: { meses },
    token: auth?.accessToken,
    mock: { data: cohortesMock },
  });
}
