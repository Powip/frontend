"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/facturacion.

   Facturación de POWIP -> empresa cliente (cobro de la suscripción SaaS),
   NO la facturación SUNAT de cada negocio hacia sus propios clientes
   finales (esa es otro dominio, ver sunatDocumentService). Ver
   docs/superadmin/facturacion-endpoints.md para el contrato completo.

   A diferencia de la mayoría de los otros módulos, acá no hay NADA real
   que conectar todavía: no existe una entidad "factura" en ningún backend
   (verificado por grep — subscriptionService.ts no tiene monto/vencimiento
   por ciclo, solo el estado actual de la suscripción). Mismo patrón
   real-primero-simulado-después que el resto: cada hook intenta el
   endpoint propuesto y cae a datos de ejemplo con `isSimulado: true` si
   todavía no existe (404 / network error) — el día que el endpoint
   responda, empieza a andar solo, sin tocar este archivo.
----------------------------------------------------------------------- */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import { paginate, matchesQuery, type PagedResponse } from "@/services/superadmin/shared";
import { facturasMock } from "@/mocks/superadmin";
import type { EstadoFactura, IFactura } from "@/interfaces/superadmin";

/* -----------------------------------------------------------------------
   1. Listado de facturas de la red — paginado server-side (ver doc:
   nunca traer todas las facturas de todas las empresas y cortar en el
   front, mismo anti-patrón ya evitado en Oportunidades/Operación).
------------------------------------------------------------------------ */
export interface FacturasFilters {
  q?: string;
  estado?: EstadoFactura | "todos";
  page?: number;
  pageSize?: number;
}

function mockFacturas(filters: FacturasFilters): PagedResponse<IFactura> {
  const { q = "", estado = "todos", page = 1, pageSize = 10 } = filters;
  let items = [...facturasMock];
  if (estado !== "todos") items = items.filter((f) => f.estado === estado);
  if (q) items = items.filter((f) => matchesQuery([f.empresaNombre, f.id, f.plan], q));
  return paginate(items, { page, pageSize });
}

export function useFacturas(filters: FacturasFilters = {}) {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const { q = "", estado = "todos", page = 1, pageSize = 10 } = filters;

  const query = useQuery<PagedResponse<IFactura>>({
    queryKey: ["superadmin", "facturacion", "facturas", { q, estado, page, pageSize }],
    queryFn: async () => {
      const res = await axios.get<PagedResponse<IFactura>>(`${SUPERADMIN_API_BASE}/facturacion/facturas`, {
        ...authHeaders(token),
        params: { q: q || undefined, estado: estado === "todos" ? undefined : estado, page, page_size: pageSize },
      });
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const result = query.isError ? mockFacturas(filters) : (query.data ?? mockFacturas(filters));
  return { data: result.data, meta: result.meta, isLoading: query.isLoading, isSimulado: query.isError };
}

/* -----------------------------------------------------------------------
   2. KPIs de facturación — agregación sobre la Sección 1. "Regla de oro":
   nunca recalcular dinero, solo sumar montos que ya vienen en el dato
   (real o mock).
------------------------------------------------------------------------ */
export interface KpisFacturacion {
  facturadoMes: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
}

function mockKpisFacturacion(): KpisFacturacion {
  return {
    facturadoMes: facturasMock.reduce((sum, f) => sum + f.monto, 0),
    cobrado: facturasMock.filter((f) => f.estado === "pagado").reduce((sum, f) => sum + f.monto, 0),
    pendiente: facturasMock.filter((f) => f.estado === "pendiente").reduce((sum, f) => sum + f.monto, 0),
    vencido: facturasMock.filter((f) => f.estado === "vencido").reduce((sum, f) => sum + f.monto, 0),
  };
}

export function useKpisFacturacion() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<KpisFacturacion>({
    queryKey: ["superadmin", "facturacion", "kpis"],
    queryFn: async () => {
      const res = await axios.get<KpisFacturacion>(`${SUPERADMIN_API_BASE}/facturacion/kpis`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  return { data: query.isError ? mockKpisFacturacion() : (query.data ?? mockKpisFacturacion()), isLoading: query.isLoading, isSimulado: query.isError };
}

/* -----------------------------------------------------------------------
   3. Cobranza / dunning — facturas vencidas. La regla de recordatorios
   automáticos (3/7/15 días) y suspensión tras 3 reintentos (spec 8.23)
   es un motor/job, no un endpoint — ver doc. Esta bandeja solo lee lo
   que ese motor ya calculó.
------------------------------------------------------------------------ */
export function useFacturasVencidas() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  const query = useQuery<{ data: IFactura[] }>({
    queryKey: ["superadmin", "facturacion", "vencidas"],
    queryFn: async () => {
      const res = await axios.get<{ data: IFactura[] }>(`${SUPERADMIN_API_BASE}/facturacion/vencidas`, authHeaders(token));
      return res.data;
    },
    enabled: !!token,
    ...PENDING_BACKEND_QUERY_OPTIONS,
  });

  const mock = facturasMock.filter((f) => f.estado === "vencido");
  return { data: query.isError ? mock : (query.data?.data ?? mock), isLoading: query.isLoading, isSimulado: query.isError };
}

/* -----------------------------------------------------------------------
   Mutaciones — intentan el endpoint real primero; si todavía no existe,
   caen a mutar el mock en memoria (best-effort, mismo patrón que
   useMarcarTareaHecha en useDashboard.ts) para que la demo no se rompa
   mientras no hay nada real contra qué reintentar.
------------------------------------------------------------------------ */
export function useMarcarFacturaPagada() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<IFactura | null> => {
      try {
        const res = await axios.patch<IFactura>(`${SUPERADMIN_API_BASE}/facturacion/facturas/${id}/pagar`, {}, authHeaders(token));
        return res.data;
      } catch {
        const factura = facturasMock.find((f) => f.id === id);
        if (factura) {
          factura.estado = "pagado";
          factura.diasVencida = undefined;
          factura.reintentos = undefined;
        }
        return factura ?? null;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["superadmin", "facturacion"] }),
  });
}

export function useReenviarFactura() {
  const { auth } = useAuth();
  const token = auth?.accessToken;

  return useMutation({
    mutationFn: async (id: string): Promise<{ id: string }> => {
      try {
        await axios.post(`${SUPERADMIN_API_BASE}/facturacion/facturas/${id}/reenviar`, {}, authHeaders(token));
      } catch {
        // Endpoint todavía no existe — no hay reenvío real posible, solo confirmamos en UI.
      }
      return { id };
    },
  });
}

export function useRecordarCobro() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<IFactura | null> => {
      try {
        const res = await axios.post<IFactura>(`${SUPERADMIN_API_BASE}/facturacion/facturas/${id}/recordar-cobro`, {}, authHeaders(token));
        return res.data;
      } catch {
        const factura = facturasMock.find((f) => f.id === id);
        if (factura) factura.reintentos = (factura.reintentos ?? 0) + 1;
        return factura ?? null;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["superadmin", "facturacion"] }),
  });
}
