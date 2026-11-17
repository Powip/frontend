"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listSkuConflictGroups, type SkuConflictPage } from "@/services/unification.service";

export const SKU_CONFLICT_PAGE_SIZE = 10;
export const SKU_CONFLICTS_QUERY_KEY = "unification-sku-conflicts";

/**
 * FEAT-24 H11 — grupos de «SKU repetido» de «Por unificar». La bandeja pide la
 * página 1 sin búsqueda solo para el contador de la pestaña; como usa la misma
 * clave que la lista, react-query hace un solo pedido.
 */
export function useSkuConflictGroups({ companyId, page, q }: { companyId: string | undefined; page: number; q: string }) {
  const { auth } = useAuth();
  const query = q.trim().length >= 2 ? q.trim() : "";
  return useQuery<SkuConflictPage, Error>({
    queryKey: [SKU_CONFLICTS_QUERY_KEY, companyId, auth?.user?.id, page, query],
    queryFn: () => listSkuConflictGroups({ page, limit: SKU_CONFLICT_PAGE_SIZE, q: query }),
    enabled: Boolean(companyId && auth?.company?.id === companyId && auth?.user?.id && auth?.accessToken),
    retry: false,
    staleTime: 15 * 1000,
  });
}
