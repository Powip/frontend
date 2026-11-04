"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import {
  getOperationsPedidosPage,
  type OperationsOrder,
  type OperationsPedidosPage,
  type OperationsPedidosQuery,
} from "@/services/operationsPedidosService";
import { operationalStatus } from "@/utils/orderState";

/** Llave base de las consultas de la vista; `useInvalidateBusinessData` también la invalida. */
export const OPERATIONS_PEDIDOS_QUERY_KEY = "operations-pedidos";

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Una página de una pestaña de /operaciones/pedidos, paginada en servidor.
 * Devuelve además los contadores de todas las pestañas (vienen en la misma respuesta) y
 * conserva la página anterior mientras llega la siguiente para que la tabla no parpadee.
 */
export function useOperationsPedidos(query: OperationsPedidosQuery, options: { enabled?: boolean } = {}) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const { storeIds, canFetch } = useBusinessScope();
  const companyId = auth?.company?.id;
  const userId = auth?.user?.id;
  const ids = useMemo(() => [...new Set(storeIds)].sort(), [storeIds]);

  // La búsqueda se espera un instante para no pedir una página por cada tecla.
  const rawSearch = query.filters.search ?? "";
  const [search, setSearch] = useState(rawSearch);
  const isDebouncing = search !== rawSearch;
  useEffect(() => {
    const timer = setTimeout(() => setSearch(rawSearch), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ companyId?: string }>).detail?.companyId === companyId) {
        void queryClient.invalidateQueries({ queryKey: [OPERATIONS_PEDIDOS_QUERY_KEY, companyId] });
      }
    };
    window.addEventListener("commercial-leads:changed", changed);
    return () => window.removeEventListener("commercial-leads:changed", changed);
  }, [companyId, queryClient]);

  const effective: OperationsPedidosQuery = { ...query, filters: { ...query.filters, search } };
  const enabled = canFetch && !!companyId && !!userId && ids.length > 0 && !isDebouncing && options.enabled !== false;
  const result = useQuery({
    queryKey: [OPERATIONS_PEDIDOS_QUERY_KEY, companyId, userId, ids, effective],
    queryFn: ({ signal }) => getOperationsPedidosPage(ids, effective, signal),
    enabled,
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const stores = auth?.company?.stores;
  // Mismos nombres de tienda y estado operativo que useBusinessOrders: la fila queda lista para mapOrderToSale.
  const data = useMemo<OperationsPedidosPage | undefined>(() => {
    if (!result.data) return undefined;
    const names = new Map(stores?.map((store) => [store.id, store.name]));
    const rows: OperationsOrder[] = result.data.data.map((order) => ({
      ...order,
      status: operationalStatus(order.status),
      storeName: names.get(order.storeId) ?? order.storeName,
      stockStoreName: order.stockStoreId ? names.get(order.stockStoreId) ?? order.stockStoreName : undefined,
    }));
    return { ...result.data, data: rows };
  }, [result.data, stores]);

  const refetch = result.refetch;
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: [OPERATIONS_PEDIDOS_QUERY_KEY] }),
    [queryClient],
  );

  return {
    data,
    isLoading: enabled && result.isPending,
    isFetching: result.isFetching || isDebouncing,
    isError: enabled && result.isError,
    refetch,
    invalidate,
  };
}

const hasNarrowing = (query: OperationsPedidosQuery) =>
  Object.values(query.filters).some((value) => value !== undefined && value !== "") ||
  query.minAgeDays !== undefined ||
  query.quick !== undefined ||
  query.sub !== undefined;

/**
 * De los pedidos seleccionados, cuáles cumplen la pestaña y los filtros actuales: lo decide el servidor
 * (la selección cruza páginas, así que el navegador ya no tiene todos los pedidos).
 * `visibleIds` es `null` cuando no hay filtros activos (todos los seleccionados cuentan) o mientras llega la respuesta.
 */
export function useVisibleSelection(selectedIds: readonly string[], query: OperationsPedidosQuery) {
  const { auth } = useAuth();
  const { storeIds, canFetch } = useBusinessScope();
  const companyId = auth?.company?.id;
  const userId = auth?.user?.id;
  const ids = useMemo(() => [...selectedIds].sort(), [selectedIds]);
  const narrowed = hasNarrowing(query);
  const base = { ...query, page: 1, limit: 100, includeSummary: false as const, view: undefined };
  const result = useQuery({
    queryKey: [OPERATIONS_PEDIDOS_QUERY_KEY, "visible-selection", companyId, userId, storeIds, ids, { ...base, page: undefined }],
    enabled: canFetch && !!companyId && narrowed && ids.length > 0,
    queryFn: async ({ signal }) => {
      const visible = new Set<string>();
      for (let i = 0; i < ids.length; i += 100) {
        const page = await getOperationsPedidosPage(storeIds, { ...base, ids: ids.slice(i, i + 100) }, signal);
        for (const order of page.data) visible.add(order.id);
      }
      return visible;
    },
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
  return {
    visibleIds: narrowed && ids.length > 0 ? result.data ?? null : null,
    loading: narrowed && ids.length > 0 && result.isFetching,
  };
}

/** Separa la selección en lo que cumple los filtros actuales (se exporta) y lo que quedó oculto por ellos. */
export function splitVisibleSelection<T extends { id: string }>(selected: T[], visibleIds: Set<string> | null) {
  if (!visibleIds) return { visible: selected, hiddenCount: 0 };
  const visible = selected.filter((sale) => visibleIds.has(sale.id));
  return { visible, hiddenCount: selected.length - visible.length };
}
