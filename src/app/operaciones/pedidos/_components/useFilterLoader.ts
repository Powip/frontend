"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import {
  OperationsTooManyError,
  fetchAllOperationsOrders,
  type OperationsPedidosQuery,
} from "@/services/operationsPedidosService";
import { mapOrderToSale, type Sale } from "./types";

export interface FilterLoadProgress {
  purpose: "select" | "export";
  loaded: number;
  total: number;
}

export type FilterLoadResult =
  | { status: "done"; sales: Sale[] }
  | { status: "too-many"; total: number; cap: number }
  | { status: "cancelled" }
  | { status: "error" };

/**
 * Baja todo lo que cumple la pestaña y los filtros actuales (paginando de a 100 por dentro), con
 * progreso y cancelación. Sirve para "Seleccionar los N pedidos del filtro" y para exportar el filtro completo.
 */
export function useFilterLoader(query: OperationsPedidosQuery) {
  const { storeIds } = useBusinessScope();
  const [progress, setProgress] = useState<FilterLoadProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const load = useCallback(
    async (purpose: FilterLoadProgress["purpose"], cap: number): Promise<FilterLoadResult> => {
      if (abortRef.current) return { status: "cancelled" }; // ya hay una carga en curso
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({ purpose, loaded: 0, total: 0 });
      try {
        const orders = await fetchAllOperationsOrders(storeIds, queryRef.current, {
          cap,
          signal: controller.signal,
          onProgress: (loaded, total) => {
            if (mountedRef.current) setProgress({ purpose, loaded, total });
          },
        });
        return { status: "done", sales: orders.map(mapOrderToSale) };
      } catch (error) {
        if (error instanceof OperationsTooManyError) return { status: "too-many", total: error.total, cap: error.cap };
        if (controller.signal.aborted) return { status: "cancelled" };
        return { status: "error" };
      } finally {
        abortRef.current = null;
        if (mountedRef.current) setProgress(null);
      }
    },
    [storeIds],
  );

  return { progress, load, cancel };
}
