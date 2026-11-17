"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { createCatalogCategory, listCatalogCategories, updateCatalogCategory } from "@/services/catalogCategoriesService";
import type { CatalogCategoryNode } from "@/lib/catalog/categoryTree";

const EMPTY: CatalogCategoryNode[] = [];

/** FEAT-24 H4 — árbol de categorías propias de la empresa del token (todas, también las desactivadas). */
export function useCatalogCategories() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const queryClient = useQueryClient();
  const queryKey = ["catalog-categories", companyId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => listCatalogCategories({ signal }),
    enabled: Boolean(companyId && auth?.accessToken),
    staleTime: 60_000,
    retry: false,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const create = useMutation({ mutationFn: createCatalogCategory, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; parentId?: string | null; active?: boolean }) => updateCatalogCategory(id, body),
    onSuccess: invalidate,
  });
  return {
    tree: query.data ?? EMPTY,
    isLoading: query.isPending && Boolean(companyId),
    error: query.error,
    refetch: query.refetch,
    createCategory: create.mutateAsync,
    updateCategory: update.mutateAsync,
    isSaving: create.isPending || update.isPending,
  };
}
