"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { useBusinessOrdersCount } from "@/hooks/useBusinessOrdersCount";
import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { type DateWindow, shiftPeruDate } from "@/lib/peruDate";
import { ventasAntiguosTo, ventasRecentFrom } from "./ventasTabs";

const DEBOUNCE_MS = 400;

const PENDIENTES_STATUSES: OrderStatus[] = ["PENDIENTE", "PAGADO"];
const ANULADAS_STATUSES: OrderStatus[] = ["ANULADO"];
const KPI_STATUSES: OrderStatus[] = ["PENDIENTE", "PAGADO", "ANULADO"];
/** Todos los estados menos INCOMPLETE: lo que muestra la pestaña Todas. */
export const TODAS_STATUSES: OrderStatus[] = [
  "PREVENTA", "PENDIENTE", "PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA",
  "EN_ENVIO", "ENTREGADO", "ANULADO", "PAGADO",
];

export interface QueryState {
  loading: boolean;
  error: boolean;
  retry: () => void;
}

export interface VentasOrders {
  orders: OrderHeader[];
  kpiOrders: OrderHeader[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  refetch: () => Promise<unknown>;
  anuladas: QueryState;
  todas: QueryState & { count: number | null };
  antiguos: QueryState & { count: number | null; countLoading: boolean };
  kpis: QueryState;
}

interface Options {
  today: string;
  anuladasWindow: DateWindow;
  todasWindow: DateWindow;
  todasEnabled: boolean;
  antiguosEnabled: boolean;
  kpiPeriod: { fromDate: string; toDate: string } | null;
}

const isValidDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 2000;
const isValidWindow = (w: DateWindow) => isValidDate(w.fromDate) && (w.toDate === "" || isValidDate(w.toDate));
const sameWindow = (a: DateWindow, b: DateWindow) => a.fromDate === b.fromDate && a.toDate === b.toDate;

/**
 * Ventana que va al servidor: el primer valor válido se usa de inmediato, los
 * siguientes esperan DEBOUNCE_MS. Un valor inválido se ignora (queda el último válido).
 */
function useDebouncedWindow(input: DateWindow | null): { value: DateWindow | null; pending: boolean } {
  const valid = input !== null && isValidWindow(input) ? input : null;
  const [applied, setApplied] = useState<DateWindow | null>(valid);
  const fromDate = valid?.fromDate;
  const toDate = valid?.toDate;

  useEffect(() => {
    if (fromDate === undefined || toDate === undefined) return;
    const next = { fromDate, toDate };
    if (applied === null) {
      setApplied(next);
      return;
    }
    if (sameWindow(applied, next)) return;
    const timer = setTimeout(() => setApplied(next), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fromDate, toDate, applied]);

  const pending = valid !== null && (applied === null || !sameWindow(applied, valid));
  return { value: applied, pending };
}

export function useVentasOrders(opts: Options): VentasOrders {
  const { today, todasEnabled, antiguosEnabled, kpiPeriod } = opts;
  const recentFrom = ventasRecentFrom(today);
  const antiguosTo = ventasAntiguosTo(today);

  const anuladasInput = useMemo(
    () => ({ fromDate: opts.anuladasWindow.fromDate || recentFrom, toDate: opts.anuladasWindow.toDate }),
    [opts.anuladasWindow.fromDate, opts.anuladasWindow.toDate, recentFrom],
  );
  const todasInput = useMemo(
    () => ({ fromDate: opts.todasWindow.fromDate || recentFrom, toDate: opts.todasWindow.toDate }),
    [opts.todasWindow.fromDate, opts.todasWindow.toDate, recentFrom],
  );
  const kpiInput = useMemo(
    () => (kpiPeriod ? { fromDate: kpiPeriod.fromDate, toDate: kpiPeriod.toDate } : null),
    [kpiPeriod],
  );

  const anuladasWin = useDebouncedWindow(anuladasInput);
  const todasWin = useDebouncedWindow(todasInput);
  const kpiWin = useDebouncedWindow(kpiInput);

  const anuladasFrom = anuladasWin.value?.fromDate ?? recentFrom;
  const anuladasTo = anuladasWin.value?.toDate || undefined;
  const todasFrom = todasWin.value?.fromDate ?? recentFrom;
  const todasTo = todasWin.value?.toDate || undefined;
  const kpiEnabled = kpiWin.value !== null;

  const pendientes = useBusinessOrders(recentFrom, undefined, { statuses: PENDIENTES_STATUSES });
  const anuladas = useBusinessOrders(anuladasFrom, anuladasTo, { statuses: ANULADAS_STATUSES });
  const todas = useBusinessOrders(todasFrom, todasTo, { statuses: TODAS_STATUSES, enabled: todasEnabled });
  const todasCount = useBusinessOrdersCount(todasFrom, todasTo, { statuses: TODAS_STATUSES });
  const antiguos = useBusinessOrders(undefined, antiguosTo, { statuses: PENDIENTES_STATUSES, enabled: antiguosEnabled });
  const antiguosCount = useBusinessOrdersCount(undefined, antiguosTo, { statuses: PENDIENTES_STATUSES });
  const kpis = useBusinessOrders(
    kpiWin.value ? shiftPeruDate(kpiWin.value.fromDate, -1) : undefined,
    kpiWin.value ? shiftPeruDate(kpiWin.value.toDate, 1) : undefined,
    { statuses: KPI_STATUSES, enabled: kpiEnabled },
  );

  // Anuladas solo tapa la página hasta su primera carga exitosa.
  const [anuladasLoaded, setAnuladasLoaded] = useState(false);
  const anuladasOk = !anuladas.loading && !anuladas.error;
  useEffect(() => {
    if (anuladasOk) setAnuladasLoaded(true);
  }, [anuladasOk]);

  const orders = useMemo(() => {
    const seen = new Set<string>();
    const merged: OrderHeader[] = [];
    for (const list of [pendientes.orders, anuladas.orders, todas.orders, antiguos.orders]) {
      for (const o of list) {
        if (seen.has(o.id)) continue;
        seen.add(o.id);
        merged.push(o);
      }
    }
    return merged;
  }, [pendientes.orders, anuladas.orders, todas.orders, antiguos.orders]);

  const pendientesRetry = pendientes.retry;
  const anuladasRetry = anuladas.retry;
  const pendientesError = pendientes.error;
  const anuladasError = anuladas.error;
  const retry = useCallback(() => {
    if (pendientesError) pendientesRetry();
    if (anuladasError && !anuladasLoaded) anuladasRetry();
  }, [pendientesError, anuladasError, anuladasLoaded, pendientesRetry, anuladasRetry]);

  const refetchPendientes = pendientes.refetch;
  const refetchAnuladas = anuladas.refetch;
  const refetchTodas = todas.refetch;
  const refetchTodasCount = todasCount.refetch;
  const refetchAntiguos = antiguos.refetch;
  const refetchAntiguosCount = antiguosCount.refetch;
  const refetchKpis = kpis.refetch;
  const refetch = useCallback(() => {
    const calls: Promise<unknown>[] = [
      refetchPendientes(), refetchAnuladas(), refetchTodasCount(), refetchAntiguosCount(),
    ];
    if (todasEnabled) calls.push(refetchTodas());
    if (antiguosEnabled) calls.push(refetchAntiguos());
    if (kpiEnabled) calls.push(refetchKpis());
    return Promise.all(calls);
  }, [
    refetchPendientes, refetchAnuladas, refetchTodasCount, refetchAntiguosCount, refetchTodas,
    refetchAntiguos, refetchKpis, todasEnabled, antiguosEnabled, kpiEnabled,
  ]);

  return {
    orders,
    kpiOrders: kpis.orders,
    loading: pendientes.loading || (!anuladasLoaded && anuladas.loading),
    error: pendientes.error || (!anuladasLoaded && anuladas.error),
    retry,
    refetch,
    anuladas: { loading: anuladas.loading || anuladasWin.pending, error: anuladas.error, retry: anuladas.retry },
    todas: {
      loading: todas.loading || todasWin.pending,
      error: todas.error,
      retry: todas.retry,
      count: todasCount.count,
    },
    antiguos: {
      loading: antiguos.loading,
      error: antiguos.error,
      retry: antiguos.retry,
      count: antiguosCount.count,
      countLoading: antiguosCount.loading,
    },
    kpis: {
      loading: kpiPeriod === null || kpiWin.pending || kpis.loading,
      error: kpis.error,
      retry: kpis.retry,
    },
  };
}
