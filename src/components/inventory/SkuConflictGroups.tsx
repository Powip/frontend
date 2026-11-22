"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, GitMerge, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts } from "@/config/permissions.config";
import { SKU_CONFLICTS_QUERY_KEY, SKU_CONFLICT_PAGE_SIZE, useSkuConflictGroups } from "@/hooks/useSkuConflictGroups";
import type { SkuConflictVariant } from "@/services/unification.service";
import { formatMoney } from "@/lib/money";
import { ChannelBadge, KindBadge, ProductThumb } from "@/components/catalog/CatalogBadges";
import { SkuRenameField } from "@/components/catalog/SkuConflictsPanel";
import { productFichaHref } from "@/components/catalog/CatalogProductTable";
import VariantStatusControl from "@/components/products/VariantStatusControl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductKind } from "@/lib/catalog/catalogProducts";
import { isSerializedTracking, variantDisplayLabel } from "./unificationRules";

const SEARCH_DEBOUNCE_MS = 300;

const asKind = (type: string | null | undefined): ProductKind | null =>
  type === "simple" || type === "variantes" || type === "pack" ? type : null;

interface SkuConflictGroupsProps {
  companyId: string | undefined;
  /** «Unir a…»: abre la unión manual con esta variante como la que se une (origen). */
  onUnite: (variant: SkuConflictVariant) => void;
}

/**
 * FEAT-24 H11 (H11-D2) — «Por unificar» › SKU repetido: variantes activas que comparten SKU con otra
 * de la empresa (`sku_conflict`), agrupadas por SKU. Cada grupo se resuelve renombrando una
 * variante, desactivando la que sobra o uniéndola a otra si son el mismo artículo. El costo solo
 * lo ven los roles que ya ven costos (Administrador y Operaciones).
 */
export function SkuConflictGroups({ companyId, onUnite }: SkuConflictGroupsProps) {
  const { auth } = useAuth();
  const showCost = canSeeProductCosts(auth?.user);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const groups = useSkuConflictGroups({ companyId, page, q: search });
  const total = groups.data?.meta.total ?? 0;
  const totalPages = groups.data?.meta.totalPages ?? 0;
  const searching = search.trim().length >= 2;

  // Se resolvió el último grupo de una página > 1: volver a la anterior.
  useEffect(() => {
    if (groups.data && groups.data.data.length === 0 && page > 1) setPage(page - 1);
  }, [groups.data, page]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: [SKU_CONFLICTS_QUERY_KEY] });

  if (!companyId) return null;
  if (groups.isError) {
    return (
      <p role="alert" className="mb-4 text-sm text-muted-foreground">
        No se pudieron revisar los SKU repetidos.{" "}
        <Button variant="outline" size="sm" onClick={() => void groups.refetch()}>Reintentar</Button>
      </p>
    );
  }
  if (groups.isPending) return <Skeleton className="mb-4 h-20 w-full" />;
  if (total === 0 && !searching && searchInput.trim().length < 2) return null;

  return (
    <section aria-labelledby="sku-conflict-groups-title" className="mb-2 space-y-3 rounded-lg border border-amber-300 bg-amber-50/40 p-4 dark:bg-amber-950/10">
      <div>
        <h4 id="sku-conflict-groups-title" className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          SKU repetido ({total})
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Estas variantes comparten el mismo SKU. Resuelve cada grupo: renombra una, desactiva la que sobra o
          únela a otra si son el mismo artículo.
        </p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar en SKU repetidos"
          placeholder="Buscar producto o SKU…"
          className="bg-background pl-9"
          value={searchInput}
          maxLength={100}
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>

      {groups.data.data.length === 0 ? (
        <p className="rounded-md border bg-background py-6 text-center text-sm italic text-muted-foreground">Sin resultados para esa búsqueda.</p>
      ) : (
        groups.data.data.map((group) => (
          <article key={group.sku_key} aria-label={`SKU ${group.sku_key}`} className="overflow-hidden rounded-md border bg-background">
            <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
              <span className="font-mono text-sm font-semibold">{group.sku_key}</span>
              <span className="text-xs text-muted-foreground">{group.variants.length} variantes con este SKU</span>
            </header>
            <ul className="divide-y">
              {group.variants.map((variant) => {
                const kind = asKind(variant.product_type);
                const serialized = isSerializedTracking(variant.tracking_mode);
                const label = variantDisplayLabel(variant.attribute_values);
                return (
                  <li key={variant.variant_id} className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <ProductThumb src={variant.image_url} name={variant.product_name} />
                      <div className="min-w-0 space-y-1">
                        <Link href={productFichaHref(variant.product_id)} className="text-sm font-medium hover:underline">
                          {variant.product_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {kind ? <KindBadge kind={kind} /> : null}
                          <ChannelBadge source={variant.external_source} />
                          {serialized ? <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary">IMEI o serie</Badge> : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          SKU <span className="font-mono">{variant.company_sku || variant.sku || "—"}</span>
                          {" · "}Precio {formatMoney(variant.price)}
                          {showCost ? <>{" · "}Costo {formatMoney(variant.cost)}</> : null}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <SkuRenameField
                        row={{
                          kind: "variant",
                          id: variant.variant_id,
                          productId: variant.product_id,
                          productName: variant.product_name,
                          label,
                          sku: variant.company_sku?.trim() || "",
                        }}
                      />
                      <VariantStatusControl variant={{ id: variant.variant_id, isActive: true }} onChanged={() => void refresh()} />
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Unir a… ${variant.product_name} · ${label}`}
                          disabled={serialized}
                          onClick={() => onUnite(variant)}
                        >
                          <GitMerge className="mr-1 h-3.5 w-3.5" />
                          Unir a…
                        </Button>
                        {serialized ? (
                          <p className="max-w-[200px] text-right text-[11px] text-muted-foreground">
                            Con IMEI o serie no se unifica: renómbrala o desactívala.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        ))
      )}

      {totalPages > 1 ? (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={SKU_CONFLICT_PAGE_SIZE}
          onPageChange={setPage}
          itemName="grupos"
        />
      ) : null}
    </section>
  );
}
