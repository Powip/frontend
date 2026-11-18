"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVariantsByIds } from "@/services/variantCodesService";

// FEAT-24 H5-L — qué variantes son de un producto que maneja lotes (`product.tracksLots`
// de `POST /product-variant/multiple/by-ids`). Lo usan la recepción de OC y los
// selectores de lote de traslados y ajustes.

export type LotTracking =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "ready"; variantIds: ReadonlySet<string> };

const NONE: ReadonlySet<string> = new Set();

export function useLotTrackedVariants(variantIds: readonly string[], companyId: string, options: { enabled?: boolean } = {}): LotTracking {
  const ids = useMemo(() => [...new Set(variantIds)].sort(), [variantIds]);
  const enabled = (options.enabled ?? true) && Boolean(companyId) && ids.length > 0;
  const query = useQuery({
    queryKey: ["lot-tracked-variants", companyId, ids],
    queryFn: async () => new Set((await fetchVariantsByIds(ids, companyId)).filter((variant) => variant.tracksLots).map((variant) => variant.id)),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  const { data, isError, refetch } = query;
  return useMemo<LotTracking>(() => {
    // Sin empresa no hay a quién preguntar: no se bloquea (el servidor valida igual).
    if (ids.length === 0 || !companyId) return { status: "ready", variantIds: NONE };
    if (data) return { status: "ready", variantIds: data };
    if (isError) return { status: "error", retry: () => void refetch() };
    return { status: "loading" };
  }, [ids.length, companyId, data, isError, refetch]);
}
