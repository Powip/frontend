"use client";

/* -----------------------------------------------------------------------
   Hooks de datos para /superadmin/cobranza-mp — comisión 0.5% sobre pagos
   Mercado Pago, cuentas MP conectadas por negocio, liquidaciones del modo
   powip_temporal y control de métodos de pago (Yape directo) por negocio.

   Ver docs/superadmin/cobranza-mp-endpoints.md y
   POWIP_Hito1_Especificacion.md §5.4, §5.7 y §8 (endpoints Super Admin).

   Igual que Partners (usePartners.ts): ACÁ NO HAY NINGUNA PIEZA REAL
   todavía — Cobranza (link del cliente + repartidor + negocio + super
   admin) es un módulo nuevo completo, sin tablas creadas en ningún
   backend (orders.link_token, payment_links, mp_accounts, etc. son
   propuestas de la especificación). Mismo patrón best-effort: cada hook
   intenta el endpoint real bajo SUPERADMIN_API_BASE y, si falla (hoy,
   siempre), cae al mock y marca isSimulado; las mutaciones intentan el
   PATCH/POST real y, si falla, mutan el mock en memoria.
------------------------------------------------------------------------ */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { SUPERADMIN_API_BASE, authHeaders, PENDING_BACKEND_QUERY_OPTIONS } from "./superadminApi";
import {
  cuentasMpMock,
  comisionesPorFuenteMpMock,
  comisionesPorEmpresaMpMock,
  liquidacionesMpMock,
} from "@/mocks/superadmin";
import type { ICuentaMp, IComisionFuenteMp, IComisionEmpresaMp, ILiquidacionMp } from "@/interfaces/superadmin";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* -----------------------------------------------------------------------
   Helper genérico: GET real primero, mock si falla. Mismo patrón que
   useFinanzas.ts / usePartners.ts, repetido localmente (no está
   exportado desde ningún lado común todavía).
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

function invalidateCobranzaMp(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["superadmin", "cobranza-mp"] });
}

/* -----------------------------------------------------------------------
   1. KPIs — comisión del mes, negocios con MP activo y cola de
   liquidación del modo powip_temporal. GET /api/admin/comisiones (§8).
------------------------------------------------------------------------ */
export interface KpisComisionesMp {
  comisionMes: number;
  negociosConMp: number;
  negociosTotal: number;
  negociosModoTemporal: number;
  liquidacionPendienteTotal: number;
}

function computeKpisMock(): KpisComisionesMp {
  const comisionMes = round2(comisionesPorEmpresaMpMock.reduce((acc, c) => acc + c.comisionMonto, 0));
  const liquidacionPendienteTotal = round2(
    liquidacionesMpMock.filter((l) => l.estado === "pendiente").reduce((acc, l) => acc + l.neto, 0)
  );
  return {
    comisionMes,
    negociosConMp: cuentasMpMock.filter((c) => c.activa).length,
    negociosTotal: cuentasMpMock.length,
    negociosModoTemporal: cuentasMpMock.filter((c) => c.modo === "powip_temporal").length,
    liquidacionPendienteTotal,
  };
}

export function useKpisComisionesMp() {
  const { auth } = useAuth();
  const mock = useMemo(computeKpisMock, []);
  return useBackedQuery<KpisComisionesMp>({
    queryKey: ["superadmin", "cobranza-mp", "kpis"],
    path: "/admin/comisiones",
    token: auth?.accessToken,
    mock,
  });
}

/* -----------------------------------------------------------------------
   2. Comisión por fuente del cobro (deuda / upsell / catálogo).
------------------------------------------------------------------------ */
export function useComisionesPorFuente() {
  const { auth } = useAuth();
  return useBackedQuery<{ data: IComisionFuenteMp[] }>({
    queryKey: ["superadmin", "cobranza-mp", "por-fuente"],
    path: "/admin/comisiones/por-fuente",
    token: auth?.accessToken,
    mock: { data: comisionesPorFuenteMpMock },
  });
}

/* -----------------------------------------------------------------------
   3. Comisión por negocio — GET /api/admin/comisiones/por-negocio (§8).
------------------------------------------------------------------------ */
export function useComisionesPorEmpresa() {
  const { auth } = useAuth();
  return useBackedQuery<{ data: IComisionEmpresaMp[] }>({
    queryKey: ["superadmin", "cobranza-mp", "por-negocio"],
    path: "/admin/comisiones/por-negocio",
    token: auth?.accessToken,
    mock: { data: comisionesPorEmpresaMpMock },
  });
}

/* -----------------------------------------------------------------------
   4. Cuentas MP — estado de conexión OAuth por negocio (§5.4 mp_accounts).
------------------------------------------------------------------------ */
export function useCuentasMp() {
  const { auth } = useAuth();
  return useBackedQuery<{ data: ICuentaMp[] }>({
    queryKey: ["superadmin", "cobranza-mp", "cuentas"],
    path: "/admin/cuentas-mp",
    token: auth?.accessToken,
    mock: { data: cuentasMpMock },
  });
}

export function useDesconectarCuentaMp() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;
  return useMutation({
    mutationFn: async (empresaId: string): Promise<ICuentaMp | null> => {
      try {
        const res = await axios.patch<ICuentaMp>(
          `${SUPERADMIN_API_BASE}/admin/cuentas-mp/${empresaId}/desconectar`,
          {},
          authHeaders(token)
        );
        return res.data;
      } catch {
        const cuenta = cuentasMpMock.find((c) => c.empresaId === empresaId);
        if (cuenta) cuenta.activa = false;
        return cuenta ?? null;
      }
    },
    onSuccess: () => invalidateCobranzaMp(queryClient),
  });
}

/* -----------------------------------------------------------------------
   5. Liquidaciones del modo powip_temporal — GET/POST
   /api/admin/liquidaciones y /:empresa_id/ejecutar (§8, §5.7).
------------------------------------------------------------------------ */
export function useLiquidacionesMp() {
  const { auth } = useAuth();
  return useBackedQuery<{ data: ILiquidacionMp[] }>({
    queryKey: ["superadmin", "cobranza-mp", "liquidaciones"],
    path: "/admin/liquidaciones",
    token: auth?.accessToken,
    mock: { data: liquidacionesMpMock },
  });
}

export function useEjecutarLiquidacionMp() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;
  return useMutation({
    mutationFn: async (id: string): Promise<ILiquidacionMp | null> => {
      try {
        const res = await axios.post<ILiquidacionMp>(`${SUPERADMIN_API_BASE}/admin/liquidaciones/${id}/ejecutar`, {}, authHeaders(token));
        return res.data;
      } catch {
        const liquidacion = liquidacionesMpMock.find((l) => l.id === id);
        if (liquidacion) {
          liquidacion.estado = "pagada";
          liquidacion.ejecutadaEn = new Date().toISOString();
          liquidacion.nroOperacion = liquidacion.nroOperacion ?? `OP-${Math.floor(800000 + Math.random() * 100000)}`;
        }
        return liquidacion ?? null;
      }
    },
    onSuccess: () => invalidateCobranzaMp(queryClient),
  });
}

/* -----------------------------------------------------------------------
   6. Métodos de pago por negocio — PATCH /api/admin/negocios/:id/metodos
   (§8, §10 regla 2: Yape directo = 0% comisión; el toggle es exclusivo
   de Super Admin, el negocio no puede prenderlo por su cuenta).
------------------------------------------------------------------------ */
export function useActualizarMetodoPagoMp() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const token = auth?.accessToken;
  return useMutation({
    mutationFn: async (input: {
      empresaId: string;
      campo: "yapeMpActivo" | "yapeDirectoActivo";
      valor: boolean;
    }): Promise<ICuentaMp | null> => {
      try {
        const res = await axios.patch<ICuentaMp>(
          `${SUPERADMIN_API_BASE}/admin/negocios/${input.empresaId}/metodos`,
          { [input.campo]: input.valor },
          authHeaders(token)
        );
        return res.data;
      } catch {
        const cuenta = cuentasMpMock.find((c) => c.empresaId === input.empresaId);
        if (cuenta) cuenta[input.campo] = input.valor;
        return cuenta ?? null;
      }
    },
    onSuccess: () => invalidateCobranzaMp(queryClient),
  });
}
