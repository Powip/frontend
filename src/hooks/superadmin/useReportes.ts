"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/reportes.

   Catálogo de "reportes disponibles": vive en el frontend (mismo mock de
   siempre) porque es config de producto, no un dato transaccional — la
   novedad es que dos combinaciones reporte+formato YA pegan a rutas
   reales de este mismo Next.js (BFF, no al backend de superadmin):

     - "BBDD leads" (xlsx) -> /api/superadmin/reports/crm/excel
     - "MRR" (pdf)         -> /api/superadmin/reports/saas/pdf
       (el xlsx de "MRR" sigue simulado, no existe generador para ese formato)

   El resto del catálogo, y toda la sección de "reportes programados",
   siguen simulados — ver docs/superadmin/reportes-endpoints.md para el
   detalle completo y los endpoints propuestos.
----------------------------------------------------------------------- */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { reportesDisponiblesMock, reportesProgramadosMock } from "@/mocks/superadmin";
import { nextId } from "@/mocks/superadmin/seed";
import type { IReporteDisponible, IReporteProgramado } from "@/interfaces/superadmin";

/* -----------------------------------------------------------------------
   Reportes disponibles — catálogo + descarga.
------------------------------------------------------------------------ */

/** reporteId -> formato -> ruta real de descarga (BFF de este mismo Next.js). */
const REAL_DOWNLOAD_ROUTES: Partial<Record<string, Partial<Record<"xlsx" | "pdf", string>>>> = {
  "rep-bbdd-leads": { xlsx: "/api/superadmin/reports/crm/excel" },
  "rep-mrr": { pdf: "/api/superadmin/reports/saas/pdf" },
};

/** Devuelve la ruta real de descarga para esta combinación reporte+formato, o null si todavía es simulada. */
export function getRutaRealReporte(reporteId: string, formato: "xlsx" | "pdf"): string | null {
  return REAL_DOWNLOAD_ROUTES[reporteId]?.[formato] ?? null;
}

/** Catálogo de reportes disponibles — hoy es config estática del frontend, ver comentario de arriba. */
export function useReportesDisponibles() {
  return { data: reportesDisponiblesMock as IReporteDisponible[], isLoading: false };
}

/**
 * Descarga (o simula la descarga de) un reporte. Si la combinación
 * reporte+formato tiene ruta real, hace GET con responseType "blob" y
 * dispara el "Save As" del navegador con el mismo truco de object-URL +
 * anchor temporal usado en el resto del panel (ver ExportButton). Si no,
 * simula el delay de generación para no romper la demo del resto del
 * catálogo.
 */
export function useDescargarReporte() {
  return useMutation({
    mutationFn: async ({ reporte, formato }: { reporte: IReporteDisponible; formato: "xlsx" | "pdf" }) => {
      const ruta = getRutaRealReporte(reporte.id, formato);
      if (!ruta) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        return { simulado: true as const };
      }

      const res = await axios.get<Blob>(ruta, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reporte.id}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return { simulado: false as const };
    },
  });
}

/* -----------------------------------------------------------------------
   Reportes programados — 100% simulado por ahora (ver doc: hace falta el
   CRUD propuesto + un scheduler real + entrega por email). Las
   mutaciones intentan el POST/PATCH real y, si falla, mutan el mock en
   memoria (mismo patrón best-effort que useMarcarTareaHecha en
   useDashboard.ts / usePartners.ts) para no romper la demo.
------------------------------------------------------------------------ */
export function useReportesProgramados() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<{ data: IReporteProgramado[] }>({
    queryKey: ["superadmin", "reportes", "programados"],
    queryFn: async () => {
      const res = await axios.get<{ data: IReporteProgramado[] }>(`${SUPERADMIN_API_BASE}/reportes/programados`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  return {
    data: query.isError ? reportesProgramadosMock : (query.data?.data ?? reportesProgramadosMock),
    isLoading: query.isLoading,
    isSimulado: query.isError,
  };
}

export interface NuevoReporteProgramadoInput {
  reporte: string;
  frecuencia: IReporteProgramado["frecuencia"];
  destinatario: string;
}

export function useCrearReporteProgramado() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (input: NuevoReporteProgramadoInput): Promise<IReporteProgramado> => {
      try {
        const res = await axios.post<IReporteProgramado>(`${SUPERADMIN_API_BASE}/reportes/programados`, input, authHeaders(token));
        return res.data;
      } catch {
        const nuevo: IReporteProgramado = {
          id: nextId("repp"),
          reporte: input.reporte,
          frecuencia: input.frecuencia,
          destinatario: input.destinatario,
          proximoEnvio: new Date(Date.now() + 7 * 86400000).toISOString(),
          activo: true,
        };
        reportesProgramadosMock.unshift(nuevo);
        return nuevo;
      }
    },
    onSuccess: (reporte) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "reportes", "programados"] });
      toast.success(`"${reporte.reporte}" programado en frecuencia ${reporte.frecuencia.toLowerCase()}.`);
    },
  });
}

export function useToggleReporteProgramado() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (id: string): Promise<IReporteProgramado | null> => {
      try {
        const res = await axios.patch<IReporteProgramado>(`${SUPERADMIN_API_BASE}/reportes/programados/${id}/activo`, {}, authHeaders(token));
        return res.data;
      } catch {
        const reporte = reportesProgramadosMock.find((r) => r.id === id);
        if (reporte) reporte.activo = !reporte.activo;
        return reporte ?? null;
      }
    },
    onSuccess: (reporte) => {
      if (!reporte) return;
      queryClient.invalidateQueries({ queryKey: ["superadmin", "reportes", "programados"] });
      toast.success(`Envío de "${reporte.reporte}" ${reporte.activo ? "activado" : "desactivado"}.`);
    },
  });
}
