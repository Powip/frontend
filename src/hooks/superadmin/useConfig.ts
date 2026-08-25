"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/config — ver
   docs/superadmin/config-endpoints.md para el contrato completo.

   Resumen del estado real (detalle en el doc):
   - Planes y precios: GET {API_SUBS}/plans es real (subscriptionService.
     getAllPlans) para nombre/precio mensual/descripción. Precio anual,
     límite de usuarios y el switch "activo" no existen en ese catálogo —
     se derivan/simulan client-side. No hay ningún endpoint de escritura
     real sobre /plans; togglePlan intenta el PATCH propuesto en el doc y,
     si falla (hoy siempre falla, el endpoint no existe), guarda el cambio
     en memoria para que el switch no "rebote" en la demo.
   - Parámetros, Seguridad, Branding, Cupones, Alertas, Anuncios: 100%
     simulado — no hay ningún sistema real detrás en el backend (ver doc
     para el detalle de qué se investigó en cada caso). Mismo patrón que
     useCampanas.ts: la query intenta el endpoint propuesto bajo
     SUPERADMIN_API_BASE primero, cae a mock con isSimulado si falla, y
     las mutaciones intentan la llamada real y si falla mutan el mock en
     memoria (best-effort) para que la demo siga funcionando.
----------------------------------------------------------------------- */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { getAllPlans, type Plan } from "@/services/subscriptionService";
import { nextId } from "@/mocks/superadmin/seed";
import { cuponesMock, alertasConfigMock, anunciosMock, planesConfigMock, parametrosGeneralesMock } from "@/mocks/superadmin";
import type { ICupon, IAlertaConfig, IAnuncio, IPlanConfig, IParametroGeneral } from "@/interfaces/superadmin";

/** Mismo host que subscriptionService.ts — el recurso Plan vive en ms-subscription, no en el API del panel. */
const API_SUBS = process.env.NEXT_PUBLIC_API_SUBS || "http://localhost:8081/api/v1";

/* -----------------------------------------------------------------------
   Helper interno — mismo patrón que useSuscripciones.ts/useCampanas.ts:
   intenta el endpoint real propuesto, si falla (404/network error) cae al
   mock y marca isSimulado.
------------------------------------------------------------------------ */
function useBackedQuery<T>(opts: {
  queryKey: unknown[];
  path: string;
  token?: string;
  mock: T;
}): { data: T; isLoading: boolean; isSimulado: boolean } {
  const query = useQuery<T>({
    queryKey: opts.queryKey,
    queryFn: async () => {
      const res = await axios.get<T>(`${SUPERADMIN_API_BASE}${opts.path}`, authHeaders(opts.token));
      return res.data;
    },
    enabled: !!opts.token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  } as UseQueryOptions<T>);

  return {
    data: query.isError ? opts.mock : (query.data ?? opts.mock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/** Igual que useBackedQuery pero para endpoints que responden `{ data: T[] }` — desenvuelve
 *  el array para que el componente no tenga que hacer `.data.data`. */
function useBackedListQuery<T>(opts: { queryKey: unknown[]; path: string; token?: string; mock: T[] }) {
  const { data, isLoading, isSimulado } = useBackedQuery<{ data: T[] }>({
    ...opts,
    mock: { data: opts.mock },
  });
  return { data: data.data, isLoading, isSimulado };
}

/* =========================================================================
   1. Planes y precios — parcial: GET real, resto derivado/simulado.
   Ver docs/superadmin/config-endpoints.md.
========================================================================= */
export interface PlanConfigRow extends IPlanConfig {
  /** Solo presente cuando la fila viene del catálogo real de ms-subscription. */
  id?: string;
  descripcion?: string;
}

/** Overrides en memoria para el switch "activo" — no hay PATCH real todavía
 *  (ver doc), así que togglePlanConfig cae acá cuando el plan viene del
 *  catálogo real (que no tiene ese campo en absoluto). */
const activoOverrides = new Map<string, boolean>();

function planFromReal(p: Plan): PlanConfigRow {
  const mockMatch = planesConfigMock.find((m) => m.nombre.toUpperCase() === p.name.toUpperCase());
  return {
    id: p.id,
    nombre: p.name,
    descripcion: p.description,
    precioMensual: p.price,
    // precioAnual y limiteUsuarios: no existen en /plans, no hay de dónde derivarlos con confianza.
    // Se completan con el mock homónimo solo como valor de referencia visual (ver SimuladoBadge en PlanesTab).
    precioAnual: mockMatch?.precioAnual ?? Math.round(p.price * 10),
    limiteUsuarios: mockMatch?.limiteUsuarios ?? 0,
    activo: activoOverrides.get(p.id) ?? mockMatch?.activo ?? true,
  };
}

export function usePlanesConfig() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery({
    queryKey: ["superadmin", "config", "planes"],
    queryFn: () => getAllPlans(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const fuenteSimulada = query.isError || (query.isSuccess && query.data.length === 0);

  const data: PlanConfigRow[] = useMemo(() => {
    if (fuenteSimulada) return planesConfigMock.map((p) => ({ ...p }));
    return (query.data ?? []).map(planFromReal);
  }, [query.data, fuenteSimulada]);

  return {
    data,
    isLoading: query.isLoading,
    // Toda la fila es simulada (no llegó nada real todavía).
    isSimulado: fuenteSimulada,
    // Aun con GET real, precio anual/límite de usuarios/activo siguen siendo derivados — ver doc.
    camposDerivadosSimulados: !fuenteSimulada,
  };
}

export function useTogglePlanConfig() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (row: PlanConfigRow): Promise<PlanConfigRow> => {
      const nuevoActivo = !row.activo;
      if (row.id) {
        try {
          // Propuesto en el doc: el recurso Plan vive en ms-subscription (API_SUBS), no bajo el API propio del panel.
          await axios.patch(`${API_SUBS}/plans/${row.id}`, { isActive: nuevoActivo }, authHeaders(token));
        } catch {
          // Endpoint propuesto todavía no existe en ms-subscription — ver doc. Guardamos en memoria.
          activoOverrides.set(row.id, nuevoActivo);
        }
      } else {
        const mockPlan = planesConfigMock.find((p) => p.nombre === row.nombre);
        if (mockPlan) mockPlan.activo = nuevoActivo;
      }
      return { ...row, activo: nuevoActivo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "planes"] });
    },
  });
}

/* =========================================================================
   2. Parámetros generales — 100% simulado, no existe store de config.
========================================================================= */
export function useParametrosConfig() {
  const { auth } = useAuth();
  return useBackedListQuery<IParametroGeneral>({
    queryKey: ["superadmin", "config", "parametros"],
    path: "/config/parametros",
    token: auth?.accessToken,
    mock: parametrosGeneralesMock,
  });
}

export function useToggleParametro() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (clave: string): Promise<IParametroGeneral | null> => {
      try {
        const res = await axios.patch<IParametroGeneral>(`${SUPERADMIN_API_BASE}/config/parametros/${clave}`, {}, authHeaders(token));
        return res.data;
      } catch {
        const parametro = parametrosGeneralesMock.find((p) => p.clave === clave);
        if (parametro) parametro.activo = !parametro.activo;
        return parametro ?? null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "parametros"] });
    },
  });
}

/* =========================================================================
   3. Seguridad — 100% simulado. No hay ni siquiera un mock service previo
   (SeguridadTab.tsx original era useState local sin persistencia) — el
   mock vive acá porque no hay interfaz/mock compartido en IConfig.ts para
   esto (es un tab nuevo en términos de datos, no una migración de mock).
========================================================================= */
export interface ISeguridadItem {
  clave: string;
  label: string;
  descripcion: string;
  activo: boolean;
}

const seguridadConfigMock: ISeguridadItem[] = [
  {
    clave: "2fa_dinero",
    label: "Exigir 2FA para roles con acceso a dinero",
    descripcion: "Finanzas y Super Admin deben confirmar con doble factor en cada login.",
    activo: true,
  },
  {
    clave: "expirar_sesion",
    label: "Expirar sesión tras 30 min de inactividad",
    descripcion: "Cierra la sesión automáticamente si no hay actividad en el panel.",
    activo: true,
  },
  {
    clave: "whitelist_ip",
    label: "Restringir por whitelist de IPs",
    descripcion: "Solo permite acceso al Super Admin desde IPs autorizadas.",
    activo: false,
  },
  {
    clave: "politica_password",
    label: "Política de contraseña fuerte",
    descripcion: "Exige mínimo 10 caracteres, mayúsculas, números y símbolos.",
    activo: true,
  },
];

export function useSeguridadConfig() {
  const { auth } = useAuth();
  return useBackedListQuery<ISeguridadItem>({
    queryKey: ["superadmin", "config", "seguridad"],
    path: "/config/seguridad",
    token: auth?.accessToken,
    mock: seguridadConfigMock,
  });
}

export function useToggleSeguridad() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (clave: string): Promise<ISeguridadItem | null> => {
      try {
        const res = await axios.patch<ISeguridadItem>(`${SUPERADMIN_API_BASE}/config/seguridad/${clave}`, {}, authHeaders(token));
        return res.data;
      } catch {
        const item = seguridadConfigMock.find((i) => i.clave === clave);
        if (item) item.activo = !item.activo;
        return item ?? null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "seguridad"] });
    },
  });
}

/* =========================================================================
   4. Branding — 100% simulado (mismo caso que Seguridad: no hay interfaz
   compartida, el original era useState local sin persistencia).
========================================================================= */
export interface IBrandingConfig {
  nombrePlataforma: string;
  colorPrimario: string;
  logoUrl: string;
}

const brandingConfigMock: IBrandingConfig = {
  nombrePlataforma: "POWIP",
  colorPrimario: "#0F9D8A",
  logoUrl: "https://cdn.powip.pe/brand/logo.png",
};

export function useBrandingConfig() {
  const { auth } = useAuth();
  return useBackedQuery<IBrandingConfig>({
    queryKey: ["superadmin", "config", "branding"],
    path: "/config/branding",
    token: auth?.accessToken,
    mock: brandingConfigMock,
  });
}

export function useGuardarBranding() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (input: IBrandingConfig): Promise<IBrandingConfig> => {
      try {
        const res = await axios.put<IBrandingConfig>(`${SUPERADMIN_API_BASE}/config/branding`, input, authHeaders(token));
        return res.data;
      } catch {
        Object.assign(brandingConfigMock, input);
        return brandingConfigMock;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "branding"] });
    },
  });
}

/* =========================================================================
   5. Cupones — 100% simulado. No confundir con promos.service.ts (packs de
   producto por empresa, real, no relacionado — ver doc).
========================================================================= */
export function useCuponesConfig() {
  const { auth } = useAuth();
  return useBackedListQuery<ICupon>({
    queryKey: ["superadmin", "config", "cupones"],
    path: "/config/cupones",
    token: auth?.accessToken,
    mock: cuponesMock,
  });
}

export interface NuevoCuponInput {
  codigo: string;
  beneficio: string;
  aplicaA: string;
}

export function useCrearCupon() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (input: NuevoCuponInput): Promise<ICupon> => {
      try {
        const res = await axios.post<ICupon>(`${SUPERADMIN_API_BASE}/config/cupones`, input, authHeaders(token));
        return res.data;
      } catch {
        const nuevo: ICupon = {
          id: nextId("cup"),
          codigo: input.codigo,
          beneficio: input.beneficio,
          aplicaA: input.aplicaA,
          estado: "activo",
          activo: true,
          usosCount: 0,
        };
        cuponesMock.unshift(nuevo);
        return nuevo;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "cupones"] });
    },
  });
}

export function useToggleCupon() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (id: string): Promise<ICupon | null> => {
      try {
        const res = await axios.patch<ICupon>(`${SUPERADMIN_API_BASE}/config/cupones/${id}`, {}, authHeaders(token));
        return res.data;
      } catch {
        const cupon = cuponesMock.find((c) => c.id === id);
        if (cupon) cupon.activo = !cupon.activo;
        return cupon ?? null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "cupones"] });
    },
  });
}

/* =========================================================================
   6. Alertas configurables — 100% simulado. Es el lado "config" del motor
   de alertas ya documentado como faltante en dashboard-endpoints.md §11.
========================================================================= */
export function useAlertasConfig() {
  const { auth } = useAuth();
  return useBackedListQuery<IAlertaConfig>({
    queryKey: ["superadmin", "config", "alertas"],
    path: "/config/alertas",
    token: auth?.accessToken,
    mock: alertasConfigMock,
  });
}

export function useToggleAlerta() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (id: string): Promise<IAlertaConfig | null> => {
      try {
        const res = await axios.patch<IAlertaConfig>(`${SUPERADMIN_API_BASE}/config/alertas/${id}`, {}, authHeaders(token));
        return res.data;
      } catch {
        const alerta = alertasConfigMock.find((a) => a.id === id);
        if (alerta) alerta.activo = !alerta.activo;
        return alerta ?? null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "alertas"] });
    },
  });
}

/* =========================================================================
   7. Anuncios & Changelog — 100% simulado.
========================================================================= */
export function useAnunciosConfig() {
  const { auth } = useAuth();
  return useBackedListQuery<IAnuncio>({
    queryKey: ["superadmin", "config", "anuncios"],
    path: "/config/anuncios",
    token: auth?.accessToken,
    mock: anunciosMock,
  });
}

export interface NuevoAnuncioInput {
  titulo: string;
  cuerpo: string;
}

export function useCrearAnuncio() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (input: NuevoAnuncioInput): Promise<IAnuncio> => {
      try {
        const res = await axios.post<IAnuncio>(`${SUPERADMIN_API_BASE}/config/anuncios`, input, authHeaders(token));
        return res.data;
      } catch {
        const nuevo: IAnuncio = {
          id: nextId("an"),
          titulo: input.titulo,
          cuerpo: input.cuerpo,
          fecha: new Date().toISOString(),
          estado: "borrador",
        };
        anunciosMock.unshift(nuevo);
        return nuevo;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "anuncios"] });
    },
  });
}
