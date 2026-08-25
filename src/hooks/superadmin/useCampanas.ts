"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/campanas.

   100% simulado — a diferencia de Adquisición/Seguimiento, acá no hay
   ninguna columna real esperando ser usada: no existe tabla de "campaña"
   en ningún ms-*, no hay motor de segmentación, y no hay mecanismo de
   envío (WhatsApp Business API / email masivo) en todo el codebase. Ver
   docs/superadmin/campanas-endpoints.md para el detalle completo de qué
   se investigó y los endpoints propuestos.

   El frontend ya apunta a esos endpoints propuestos (mismo patrón
   real-primero-simulado-después que el resto del panel) para que, el día
   que existan, esto empiece a resolver solo — no hay que tocar este
   archivo cuando eso pase. Las mutaciones (crear/toggle) intentan la
   llamada real y, si falla porque el endpoint todavía no existe, mutan
   `campanasMock` en memoria (best-effort, mismo criterio que
   useMarcarTareaHecha en useDashboard.ts) para que el modal y la tabla
   sigan funcionando en la demo.
----------------------------------------------------------------------- */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { campanasMock } from "@/mocks/superadmin";
import { nextId } from "@/mocks/superadmin/seed";
import type { CanalCampana, EstadoCampana, ICampana } from "@/interfaces/superadmin";

/* -----------------------------------------------------------------------
   1. Listado de campañas.
------------------------------------------------------------------------ */
export function useCampanasList() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<{ data: ICampana[] }>({
    queryKey: ["superadmin", "campanas", "list"],
    queryFn: async () => {
      const res = await axios.get<{ data: ICampana[] }>(`${SUPERADMIN_API_BASE}/campanas`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  return {
    data: query.isError ? campanasMock : (query.data?.data ?? campanasMock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/* -----------------------------------------------------------------------
   2. KPIs — el mock replica el mismo cálculo que tenía
   campanasService.getKpisCampanas (activas/enviados/promedios sobre
   campanasMock), pero el pedido real es que esto se agregue server-side
   (ver doc: promediar/sumar solo sobre la página visible sería incorrecto).
------------------------------------------------------------------------ */
export interface KpisCampanas {
  activas: number;
  enviados: number;
  aperturaProm: number;
  conversionProm: number;
}

function kpisMock(): KpisCampanas {
  const activas = campanasMock.filter((c) => c.estado === "activa").length;
  const enviados = campanasMock.reduce((acc, c) => acc + c.enviados, 0);
  const conEnvios = campanasMock.filter((c) => c.enviados > 0);
  const aperturaProm = conEnvios.length ? conEnvios.reduce((acc, c) => acc + c.aperturaPct, 0) / conEnvios.length : 0;
  const conversionProm = conEnvios.length ? conEnvios.reduce((acc, c) => acc + c.conversionPct, 0) / conEnvios.length : 0;
  return {
    activas,
    enviados,
    aperturaProm: Math.round(aperturaProm * 10) / 10,
    conversionProm: Math.round(conversionProm * 10) / 10,
  };
}

export function useKpisCampanas() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<KpisCampanas>({
    queryKey: ["superadmin", "campanas", "kpis"],
    queryFn: async () => {
      const res = await axios.get<KpisCampanas>(`${SUPERADMIN_API_BASE}/campanas/kpis`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  return {
    data: query.isError ? kpisMock() : (query.data ?? kpisMock()),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

/* -----------------------------------------------------------------------
   3. Crear campaña ("Nueva campaña") — el modal hoy solo captura
   `segmento` como texto libre (no hay UI de armado de filtros porque no
   hay motor de segmentación contra el cual validarlos, ver doc). El POST
   real propuesto espera un objeto de filtros; mientras tanto mandamos el
   string tal cual — el día que exista el motor, este payload es lo
   primero que cambia (no el resto del hook).
------------------------------------------------------------------------ */
export interface NuevaCampanaInput {
  nombre: string;
  segmento: string;
  canal: CanalCampana;
  mensaje: string;
}

export function useCrearCampana() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (input: NuevaCampanaInput): Promise<ICampana> => {
      try {
        const res = await axios.post<ICampana>(
          `${SUPERADMIN_API_BASE}/campanas`,
          { nombre: input.nombre, canal: input.canal, mensaje: input.mensaje, segmento: input.segmento },
          authHeaders(token)
        );
        return res.data;
      } catch {
        // Endpoint todavía no existe (no hay dominio de "campaña" en
        // backend) — agregamos al mock en memoria para que el modal no
        // se rompa en la demo.
        const nueva: ICampana = {
          id: nextId("camp"),
          nombre: input.nombre,
          segmento: input.segmento,
          canal: input.canal,
          estado: "borrador",
          enviados: 0,
          aperturaPct: 0,
          conversionPct: 0,
          mensaje: input.mensaje,
          creadoEn: new Date().toISOString(),
        };
        campanasMock.unshift(nueva);
        return nueva;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "campanas"] });
    },
  });
}

/* -----------------------------------------------------------------------
   4. Activar / pausar campaña.
------------------------------------------------------------------------ */
export function useToggleCampana() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async ({ id, estadoActual }: { id: string; estadoActual: EstadoCampana }): Promise<ICampana | null> => {
      const nuevoEstado: EstadoCampana = estadoActual === "activa" ? "pausada" : "activa";
      try {
        const res = await axios.patch<ICampana>(`${SUPERADMIN_API_BASE}/campanas/${id}`, { estado: nuevoEstado }, authHeaders(token));
        return res.data;
      } catch {
        const campana = campanasMock.find((c) => c.id === id);
        if (campana) campana.estado = nuevoEstado;
        return campana ?? null;
      }
    },
    onSuccess: (campana) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "campanas"] });
      return campana;
    },
  });
}
