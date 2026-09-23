"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  VariantSearchResult,
  searchReconciliationVariants,
} from "@/services/reconciliationTask.service";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

export interface UseReconciliationVariantSearchResult {
  results: VariantSearchResult[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  // `false` cuando el texto (recortado) todavía no llega al mínimo de
  // caracteres — el buscador no dispara fetch, se muestra el mensaje de
  // "escribí al menos 2 caracteres" en vez de un estado vacío real.
  isSearchable: boolean;
}

/**
 * FEAT-17 Anexo A (sección 4) — buscador de "Buscar otra variante" de la
 * bandeja de reconciliación. Debouncea (~300ms) el texto tipeado antes de
 * consultar `GET /reconciliation-tasks/variant-search` vía react-query; el
 * `useEffect` de acá sólo pospone la actualización de `debouncedQuery`, el
 * fetch en sí lo dispara siempre `useQuery` (nunca el efecto).
 */
export function useReconciliationVariantSearch(
  query: string,
): UseReconciliationVariantSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const trimmedQuery = debouncedQuery.trim();
  const isSearchable = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const { data, isFetching, isError, error } = useQuery<
    VariantSearchResult[],
    Error
  >({
    queryKey: ["reconciliation-variant-search", trimmedQuery],
    queryFn: () => searchReconciliationVariants(trimmedQuery),
    enabled: isSearchable,
    staleTime: 30 * 1000,
  });

  return {
    results: data ?? [],
    isLoading: isFetching,
    isError,
    error: error ?? null,
    isSearchable,
  };
}
