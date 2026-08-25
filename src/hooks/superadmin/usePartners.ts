"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/partners y /superadmin/partners/[id]/portal.

   Ver docs/superadmin/partners-endpoints.md — a diferencia de los demás
   módulos migrados, ACÁ NO HAY NINGUNA PIEZA REAL: Partners (programa de
   referidos externo) no existe como entidad en ningún microservicio. Todo
   hook de este archivo sigue el mismo patrón: intenta el endpoint
   propuesto bajo SUPERADMIN_API_BASE, y si falla (hoy, siempre — el
   endpoint no existe todavía) cae al mock de src/mocks/superadmin/partners.ts
   y marca isSimulado. Las mutaciones intentan el PATCH/PUT real y, si
   falla, mutan el mock en memoria (mismo patrón best-effort que
   useMarcarTareaHecha en useDashboard.ts) para no romper la demo.
----------------------------------------------------------------------- */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { paginate, matchesQuery, type PagedResponse } from "@/services/superadmin/shared";
import {
  partnersMock,
  referidosMock,
  comisionesMock,
  liquidacionesMock,
  configProgramaMock,
} from "@/mocks/superadmin";
import type {
  IPartner,
  IReferido,
  IComision,
  ILiquidacion,
  IConfigPrograma,
  EstadoPartner,
  NivelPartner,
  EstadoReferido,
} from "@/interfaces/superadmin";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* -----------------------------------------------------------------------
   Helper genérico: GET real primero, mock si falla. Mismo patrón que
   useBackedQuery en useDashboard.ts / useBackedList en useOportunidades.ts,
   repetido acá localmente porque no está exportado desde ningún lado común.
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

function invalidatePartners(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["superadmin", "partners"] });
}

/* -----------------------------------------------------------------------
   1. KPIs — Dashboard del canal (spec 8.6.1). MRR referido, comisiones
   del mes, CAC/ROI vs. ads, conversión, top partners.
------------------------------------------------------------------------ */
export interface KpisPartners {
  partnersActivos: number;
  partnersTotal: number;
  mrrReferido: number;
  comisionesMes: number;
  referidosActivos: number;
  referidosTotal: number;
  conversionPct: number;
  cacPartners: number;
  cacAds: number;
  roiPct: number;
  topPartners: IPartner[];
}

function computeKpisMock(): KpisPartners {
  const partnersActivos = partnersMock.filter((p) => p.estado === "activo");
  const mrrReferido = round2(partnersActivos.reduce((acc, p) => acc + p.mrrActivo, 0));

  const periodoActual = "2026-07";
  const comisionesDelMes = comisionesMock.filter((c) => c.periodo === periodoActual);
  const comisionesPositivas = comisionesDelMes.filter((c) => c.tipo !== "reverso").reduce((a, c) => a + c.monto, 0);
  const reversos = comisionesDelMes.filter((c) => c.tipo === "reverso").reduce((a, c) => a + c.monto, 0);
  const comisionesMes = round2(comisionesPositivas - reversos);

  const referidosActivos = referidosMock.filter((r) => r.estado === "activo").length;
  const referidosTotal = referidosMock.length;
  const conversionPct = referidosTotal ? round2((referidosActivos / referidosTotal) * 100) : 0;

  const cacAds = 140;
  const cacPartners = referidosActivos ? round2(comisionesMes / referidosActivos) : 0;
  const roiPct = comisionesMes > 0 ? round2(((mrrReferido - comisionesMes) / comisionesMes) * 100) : 0;

  const topPartners = [...partnersMock].sort((a, b) => b.mrrActivo - a.mrrActivo).slice(0, 5);

  return {
    partnersActivos: partnersActivos.length,
    partnersTotal: partnersMock.length,
    mrrReferido,
    comisionesMes,
    referidosActivos,
    referidosTotal,
    conversionPct,
    cacPartners,
    cacAds,
    roiPct,
    topPartners,
  };
}

export function useKpisPartners() {
  const { auth } = useAuth();
  const mock = useMemo(computeKpisMock, []);
  return useBackedQuery<KpisPartners>({
    queryKey: ["superadmin", "partners", "kpis"],
    path: "/partners/kpis",
    token: auth?.accessToken,
    mock,
  });
}

/* -----------------------------------------------------------------------
   2. Tabla de partners (spec 8.6.2) — filtro + paginación.
------------------------------------------------------------------------ */
export interface PartnersFilters {
  q?: string;
  estado?: EstadoPartner | "todos";
  nivel?: NivelPartner | "todos";
  page?: number;
  pageSize?: number;
}

function filterPartnersMock(filters: PartnersFilters): PagedResponse<IPartner> {
  let items = [...partnersMock];
  if (filters.estado && filters.estado !== "todos") items = items.filter((p) => p.estado === filters.estado);
  if (filters.nivel && filters.nivel !== "todos") items = items.filter((p) => p.nivel === filters.nivel);
  if (filters.q) items = items.filter((p) => matchesQuery([p.nombre, p.handle, p.codigo, p.slugLink], filters.q!));
  return paginate(items, filters);
}

export function usePartnersList(filters: PartnersFilters = {}) {
  const { auth } = useAuth();
  const { q, estado = "todos", nivel = "todos", page = 1, pageSize = 10 } = filters;

  const mock = useMemo(() => filterPartnersMock({ q, estado, nivel, page, pageSize }), [q, estado, nivel, page, pageSize]);

  return useBackedQuery<PagedResponse<IPartner>>({
    queryKey: ["superadmin", "partners", "list", { q, estado, nivel, page, pageSize }],
    path: "/partners",
    token: auth?.accessToken,
    params: { q, estado: estado === "todos" ? undefined : estado, nivel: nivel === "todos" ? undefined : nivel, page, pageSize },
    mock,
  });
}

export function useAprobarPartner() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;
  return useMutation({
    mutationFn: async (id: string): Promise<IPartner | null> => {
      try {
        const res = await axios.patch<IPartner>(`${SUPERADMIN_API_BASE}/partners/${id}/aprobar`, {}, authHeaders(token));
        return res.data;
      } catch {
        const partner = partnersMock.find((p) => p.id === id);
        if (partner) partner.estado = "activo";
        return partner ?? null;
      }
    },
    onSuccess: () => invalidatePartners(queryClient),
  });
}

export function useSuspenderPartner() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;
  return useMutation({
    mutationFn: async (id: string): Promise<IPartner | null> => {
      try {
        const res = await axios.patch<IPartner>(`${SUPERADMIN_API_BASE}/partners/${id}/suspender`, {}, authHeaders(token));
        return res.data;
      } catch {
        const partner = partnersMock.find((p) => p.id === id);
        if (partner) partner.estado = partner.estado === "suspendido" ? "activo" : "suspendido";
        return partner ?? null;
      }
    },
    onSuccess: () => invalidatePartners(queryClient),
  });
}

/* -----------------------------------------------------------------------
   3. Ficha de partner — drawer admin y portal individual (spec 8.6.2/8.6.7).
   Todo scoped por {id} — ver doc: el endpoint de liquidaciones acá es
   justamente el que hoy NO existe scoped, y por eso el portal termina
   trayendo la facturación de todos los partners para filtrar una sola.
------------------------------------------------------------------------ */
export function usePartnerDetail(id: string | null) {
  const { auth } = useAuth();
  const mock = useMemo(() => partnersMock.find((p) => p.id === id) ?? null, [id]);
  return useBackedQuery<IPartner | null>({
    queryKey: ["superadmin", "partners", "detail", id],
    path: `/partners/${id}`,
    token: auth?.accessToken,
    mock,
    enabled: !!id,
  });
}

export function useReferidosDePartner(id: string | null) {
  const { auth } = useAuth();
  const mock = useMemo(
    () =>
      referidosMock
        .filter((r) => r.partnerId === id)
        .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()),
    [id]
  );
  return useBackedQuery<IReferido[]>({
    queryKey: ["superadmin", "partners", "referidos", id],
    path: `/partners/${id}/referidos`,
    token: auth?.accessToken,
    mock,
    enabled: !!id,
  });
}

export function useComisionesDePartner(id: string | null) {
  const { auth } = useAuth();
  const mock = useMemo(() => comisionesMock.filter((c) => c.partnerId === id), [id]);
  return useBackedQuery<IComision[]>({
    queryKey: ["superadmin", "partners", "comisiones", id],
    path: `/partners/${id}/comisiones`,
    token: auth?.accessToken,
    mock,
    enabled: !!id,
  });
}

/** Liquidaciones de UN partner — scoped, ver nota del doc sobre la fuga de
 * datos que evita este endpoint frente a traer todas y filtrar en el portal. */
export function useLiquidacionesDePartner(id: string | null) {
  const { auth } = useAuth();
  const mock = useMemo(() => liquidacionesMock.filter((l) => l.partnerId === id), [id]);
  return useBackedQuery<ILiquidacion[]>({
    queryKey: ["superadmin", "partners", "liquidaciones", id],
    path: `/partners/${id}/liquidaciones`,
    token: auth?.accessToken,
    mock,
    enabled: !!id,
  });
}

/* -----------------------------------------------------------------------
   Detalle de comisión por referido (drawer admin) — fórmula pura, spec 8.6:
   comision_primer_mes = precio_neto * (first% / 100);
   comision_recurrente = precio_lista * ((rec% + residual_nivel) / 100).
   El descuento del partner reduce SU comisión (aplica sobre precio_neto),
   nunca el ingreso de Powip (precio_lista, base de la recurrente).

   PRECIO_LISTA_PLAN acá es un duplicado del mismo mapa en empresasService
   — ver doc: lo correcto es que el backend devuelva este desglose ya
   calculado (es dueño del precio de lista real), no que el frontend
   mantenga su propia copia.
------------------------------------------------------------------------ */
const PRECIO_LISTA_PLAN: Record<string, number> = {
  Trial: 0,
  Basic: 89,
  Pro: 179,
  Scale: 349,
  Enterprise: 799,
};

export interface DetalleComision {
  precioLista: number;
  precioNeto: number;
  firstPct: number;
  recPct: number;
  residualNivel: number;
  descuentoPartnerPct: number;
  comisionPrimerMes: number;
  comisionRecurrente: number;
}

export function calcularDetalleComision(partner: IPartner, referido: IReferido, config: IConfigPrograma): DetalleComision {
  const opcion = config.opciones.find((o) => o.id === partner.opcionComision);
  const firstPct = partner.overridePct ?? opcion?.firstPct ?? 0;
  const recPct = opcion?.recPct ?? 0;
  const residualNivel = partner.acuerdo.residualNivel;
  const descuentoPartnerPct = referido.descuentoPct;

  const precioLista = PRECIO_LISTA_PLAN[referido.plan] ?? 0;
  const precioNeto = round2(precioLista * (1 - descuentoPartnerPct / 100));

  return {
    precioLista,
    precioNeto,
    firstPct,
    recPct,
    residualNivel,
    descuentoPartnerPct,
    comisionPrimerMes: round2(precioNeto * (firstPct / 100)),
    comisionRecurrente: round2(precioLista * ((recPct + residualNivel) / 100)),
  };
}

/* -----------------------------------------------------------------------
   4. Cola de referidos (spec 8.6.3) — global, todos los partners.
------------------------------------------------------------------------ */
export function useColaReferidos(estado: EstadoReferido | "todos" = "pendiente") {
  const { auth } = useAuth();
  const mock = useMemo(() => {
    let items = [...referidosMock];
    if (estado !== "todos") items = items.filter((r) => r.estado === estado);
    return items.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
  }, [estado]);

  return useBackedQuery<IReferido[]>({
    queryKey: ["superadmin", "partners", "cola-referidos", estado],
    path: "/partners/referidos",
    token: auth?.accessToken,
    params: { estado: estado === "todos" ? undefined : estado },
    mock,
  });
}

export function useAprobarReferido() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;
  return useMutation({
    mutationFn: async (id: string): Promise<IReferido | null> => {
      try {
        const res = await axios.patch<IReferido>(`${SUPERADMIN_API_BASE}/partners/referidos/${id}/aprobar`, {}, authHeaders(token));
        return res.data;
      } catch {
        const referido = referidosMock.find((r) => r.id === id);
        if (referido) referido.estado = "aprobado";
        return referido ?? null;
      }
    },
    onSuccess: () => invalidatePartners(queryClient),
  });
}

export function useRechazarReferido() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;
  return useMutation({
    mutationFn: async (id: string): Promise<IReferido | null> => {
      try {
        const res = await axios.patch<IReferido>(`${SUPERADMIN_API_BASE}/partners/referidos/${id}/rechazar`, {}, authHeaders(token));
        return res.data;
      } catch {
        const referido = referidosMock.find((r) => r.id === id);
        if (referido) referido.estado = "rechazado";
        return referido ?? null;
      }
    },
    onSuccess: () => invalidatePartners(queryClient),
  });
}

/* -----------------------------------------------------------------------
   5. Liquidaciones — vista admin de toda la red (spec 8.6.4).
------------------------------------------------------------------------ */
export function useLiquidaciones() {
  const { auth } = useAuth();
  return useBackedQuery<ILiquidacion[]>({
    queryKey: ["superadmin", "partners", "liquidaciones"],
    path: "/partners/liquidaciones",
    token: auth?.accessToken,
    mock: liquidacionesMock,
  });
}

export function useConfirmarPagoLiquidacion() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;
  return useMutation({
    mutationFn: async (id: string): Promise<ILiquidacion | null> => {
      try {
        const res = await axios.patch<ILiquidacion>(`${SUPERADMIN_API_BASE}/partners/liquidaciones/${id}/confirmar-pago`, {}, authHeaders(token));
        return res.data;
      } catch {
        const liquidacion = liquidacionesMock.find((l) => l.id === id);
        if (liquidacion) liquidacion.estado = "pagada";
        return liquidacion ?? null;
      }
    },
    onSuccess: () => invalidatePartners(queryClient),
  });
}

/* -----------------------------------------------------------------------
   6. Reglas & Comisiones (spec 8.6.5).
------------------------------------------------------------------------ */
export function useConfigPrograma() {
  const { auth } = useAuth();
  const mock = useMemo(() => ({ ...configProgramaMock, opciones: configProgramaMock.opciones.map((o) => ({ ...o })) }), []);
  return useBackedQuery<IConfigPrograma>({
    queryKey: ["superadmin", "partners", "config"],
    path: "/partners/config",
    token: auth?.accessToken,
    mock,
  });
}

export function useActualizarConfigPrograma() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;
  return useMutation({
    mutationFn: async (input: IConfigPrograma): Promise<IConfigPrograma> => {
      try {
        const res = await axios.put<IConfigPrograma>(`${SUPERADMIN_API_BASE}/partners/config`, input, authHeaders(token));
        return res.data;
      } catch {
        if (input.opciones) {
          input.opciones.forEach((nueva) => {
            const actual = configProgramaMock.opciones.find((o) => o.id === nueva.id);
            if (actual) {
              actual.firstPct = nueva.firstPct;
              actual.recPct = nueva.recPct;
            }
          });
        }
        const { opciones: _opciones, ...resto } = input;
        Object.assign(configProgramaMock, resto);
        return { ...configProgramaMock, opciones: configProgramaMock.opciones.map((o) => ({ ...o })) };
      }
    },
    onSuccess: (config) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "partners", "config"] });
      return config;
    },
  });
}
