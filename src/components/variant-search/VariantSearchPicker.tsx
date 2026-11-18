"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { searchReconciliationVariants, type VariantSearchResult } from "@/services/reconciliationTask.service";
import { variantLabel } from "@/lib/packs/packMath";

export type { VariantSearchResult };

/** Componente o regalo válido: sin IMEI/serie y que no sea un pack (lo exige el backend). */
export const isPlainVariant = (result: VariantSearchResult) =>
  (result.product_type ?? "") !== "pack" && (!result.tracking_mode || result.tracking_mode === "NONE");

export const searchResultLabel = (result: VariantSearchResult) => variantLabel(result.product_name, result.attribute_values);

/**
 * FEAT-24 H9/H12 — buscador de variantes de la empresa (nombre o SKU, la empresa sale del token). Usa el
 * mismo endpoint que la unificación manual (H11): máximo 20 resultados, solo variantes activas.
 */
export function VariantSearchPicker({
  label,
  placeholder = "Busca por nombre o SKU",
  onSelect,
  filter = isPlainVariant,
  excludeIds,
  disabled,
}: {
  label: string;
  placeholder?: string;
  onSelect: (result: VariantSearchResult) => void;
  filter?: (result: VariantSearchResult) => boolean;
  excludeIds?: readonly string[];
  disabled?: boolean;
}) {
  const { auth } = useAuth();
  const id = useId();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const searchable = debounced.length >= 2;
  const results = useQuery({
    queryKey: ["feat24-variant-search", auth?.company?.id, debounced],
    queryFn: () => searchReconciliationVariants(debounced),
    enabled: searchable && Boolean(auth?.company?.id && auth?.accessToken),
    staleTime: 30_000,
    retry: false,
  });
  const excluded = new Set(excludeIds ?? []);
  const options = (results.data ?? []).filter((result) => filter(result) && !excluded.has(result.variant_id));

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input id={id} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className="pl-8" disabled={disabled} autoComplete="off" />
      </div>
      {query.trim().length > 0 && query.trim().length < 2 ? <p className="text-xs text-muted-foreground">Escribe al menos 2 caracteres.</p> : null}
      {searchable && results.isFetching ? <p className="text-xs text-muted-foreground" role="status">Buscando…</p> : null}
      {searchable && results.isError ? <p className="text-xs text-destructive" role="alert">No se pudo buscar. Intenta de nuevo.</p> : null}
      {searchable && results.isSuccess && options.length === 0 ? <p className="text-xs text-muted-foreground">Sin resultados que se puedan usar.</p> : null}
      {searchable && options.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto rounded-md border" aria-label={`Resultados de ${label}`}>
          {options.map((result) => (
            <li key={result.variant_id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelect(result);
                  setQuery("");
                  setDebounced("");
                }}
              >
                <span className="truncate">{searchResultLabel(result)}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{result.company_sku || result.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
