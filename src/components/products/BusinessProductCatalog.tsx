"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { useCompanyBrands } from "@/hooks/useCompanyBrands";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { fetchBusinessProducts, scopeBusinessProducts } from "@/services/businessProductsService";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import CatalogFiltersBar from "@/components/catalog/CatalogFiltersBar";
import CatalogProductTable from "@/components/catalog/CatalogProductTable";
import { DEFAULT_CATALOG_FILTERS, filterCatalogProducts, type CatalogFilters } from "@/lib/catalog/catalogProducts";
import { PrintLabelsDialog } from "@/components/labels/PrintLabelsDialog";
import { ChannelLegend } from "@/components/catalog/ChannelIcons";
import { productChannelStates } from "@/lib/catalog/productChannels";
import { getChannelSummary } from "@/services/productChannelsService";
import { listPromotions } from "@/services/promotionsService";
import { activeCampaign, campaignTag, productCampaigns } from "@/lib/promotions/campaign";
import { canManagePromotions } from "@/config/permissions.config";

const PAGE_SIZE = 20;
/** FEAT-32 M3 — tope de «Crear promoción» desde la selección (los ids viajan en la URL). */
export const MAX_PROMO_PRODUCTS = 200;

export default function BusinessProductCatalog({ onCreate }: { onCreate: () => void }) {
  const { auth } = useAuth();
  const router = useRouter();
  const { scope, storeIds, canFetch } = useBusinessScope();
  const warehouses = useBusinessInventories({ scope, storeIds });
  const { brands } = useCompanyBrands();
  const categories = useCatalogCategories();
  const companyId = auth?.company?.id ?? "";
  const accessToken = auth?.accessToken ?? "";
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const [page, setPage] = useState(1);
  // FEAT-24 H7 — productos elegidos para imprimir sus etiquetas.
  const [selected, setSelected] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);
  const products = useQuery({
    queryKey: ["business-product-catalog", companyId, auth?.user?.id],
    queryFn: ({ signal }) => fetchBusinessProducts({ companyId, accessToken, signal }),
    enabled: canFetch, retry: false,
  });
  const stock = useQuery({
    queryKey: ["business-inventory-items", companyId, auth?.user?.id, scope, storeIds, warehouses.inventories.map((inv) => inv.id).sort()],
    queryFn: ({ signal }) => fetchBusinessInventoryItems({ inventories: warehouses.inventories, companyId, accessToken, signal }),
    enabled: canFetch && warehouses.isSuccess, retry: false,
  });
  // FEAT-32 M2 — estado de cada producto en los canales de POWIP (sin fila = activo). Si falla, la columna
  // muestra todo «Al día» (el producto nace activo) y la lista sigue andando.
  const channelSummary = useQuery({
    queryKey: ["product-channel-summary", companyId],
    queryFn: ({ signal }) => getChannelSummary(signal),
    enabled: canFetch, retry: false, staleTime: 60_000,
  });
  const scopeStores = useMemo(
    () => (scope === "business" ? (auth?.company?.stores ?? []).map((store) => store.id) : storeIds),
    [scope, storeIds, auth?.company?.stores],
  );
  const channelStates = useCallback(
    (productId: string) => productChannelStates(channelSummary.data, productId, scopeStores),
    [channelSummary.data, scopeStores],
  );
  // FEAT-32 M3 — etiqueta de la campaña activa bajo el precio (§7.1). Si /promos falla, no se muestra nada.
  const promos = useQuery({
    queryKey: ["promotions", companyId],
    queryFn: ({ signal }) => listPromotions(signal),
    enabled: canFetch && !!companyId, retry: false, staleTime: 60_000,
  });
  const promoTags = useCallback(
    (productId: string) => {
      const tags: string[] = [];
      for (const promo of productCampaigns(promos.data ?? [], productId, scopeStores)) {
        const live = promo.channels.some((channel) => activeCampaign([promo], productId, scopeStores, channel));
        if (live) tags.push(campaignTag(promo, productId));
      }
      return tags;
    },
    [promos.data, scopeStores],
  );
  const canPromote = canManagePromotions(auth?.user);
  const goCreatePromotion = () => router.push(`/packs-promos?nueva=campana&productos=${selected.map(encodeURIComponent).join(",")}`);
  const availableByProduct = useMemo(() => {
    const sums = new Map<string, number>();
    for (const row of stock.data ?? []) sums.set(row.productId, (sums.get(row.productId) ?? 0) + row.availableStock);
    return sums;
  }, [stock.data]);
  const brandNames = useMemo(() => new Map(brands.map((brand) => [brand.id, brand.name])), [brands]);
  // El alcance (tienda) se aplica primero; después, los filtros del catálogo (FEAT-24 H4).
  const filtered = useMemo(
    () => filterCatalogProducts(scopeBusinessProducts(products.data ?? [], stock.data ?? [], scope, ""), filters, { categoryTree: categories.tree, availableByProduct, channelStates }),
    [products.data, stock.data, scope, filters, categories.tree, availableByProduct, channelStates],
  );
  const changeFilters = (next: CatalogFilters) => { setFilters(next); setPage(1); };
  // FEAT-24 H7: selección por página para «Imprimir etiquetas» (se conserva al cambiar de página o de filtro).
  const pageProducts = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPageSelected = pageProducts.length > 0 && pageProducts.every((product) => selected.includes(product.id));
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const togglePage = () => setSelected((current) => allPageSelected
    ? current.filter((id) => !pageProducts.some((product) => product.id === id))
    : [...new Set([...current, ...pageProducts.map((product) => product.id)])]);
  const error = products.error || warehouses.error || stock.error;
  const loading = products.isPending || warehouses.isPending || (warehouses.isSuccess && stock.isPending);
  return <div className="space-y-4 p-6">
    <HeaderConfig title="Productos" description="Catálogo y stock del alcance seleccionado" />
    <div className="flex flex-wrap items-start justify-between gap-3">
      <CatalogFiltersBar filters={filters} onChange={changeFilters} brands={brands} categoryTree={categories.tree} />
      <div className="flex gap-2">
        <Button variant="outline" disabled={selected.length === 0} onClick={() => setPrinting(true)}>Imprimir etiquetas{selected.length ? ` (${selected.length})` : ""}</Button>
        <Button variant="outline" asChild><Link href="/productos/categorias">Categorías</Link></Button>
        <Button onClick={onCreate}>Crear producto</Button>
      </div>
    </div>
    {error ? <div role="alert">No se pudo cargar el catálogo. {error instanceof Error ? error.message : "Verifica la sesión."} <Button variant="outline" onClick={() => { void products.refetch(); void warehouses.refetch(); if (warehouses.isSuccess) void stock.refetch(); }}>Reintentar</Button></div> : loading ? <p role="status">Cargando productos y almacenes...</p> : <>
      {selected.length ? (
        <div role="region" aria-label="Productos seleccionados" className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{selected.length} producto{selected.length === 1 ? "" : "s"} seleccionado{selected.length === 1 ? "" : "s"}</span>
          <Button variant="outline" size="sm" onClick={() => setSelected([])}>Quitar selección</Button>
          {canPromote ? (
            <Button
              variant="outline"
              size="sm"
              disabled={selected.length > MAX_PROMO_PRODUCTS}
              title={selected.length > MAX_PROMO_PRODUCTS ? `Elige hasta ${MAX_PROMO_PRODUCTS} productos o usa «Todos los productos» en la promoción.` : undefined}
              onClick={goCreatePromotion}
            >
              ％ Crear promoción
            </Button>
          ) : null}
          {selected.length > MAX_PROMO_PRODUCTS && canPromote ? (
            <span className="text-xs text-muted-foreground">Para crear una promoción elige hasta {MAX_PROMO_PRODUCTS} productos.</span>
          ) : null}
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">{filtered.length} productos · {scope === "business" ? "Todo el negocio" : "Tienda seleccionada"}</p>
      <CatalogProductTable
        products={pageProducts}
        brandNames={brandNames}
        categoryTree={categories.tree}
        availableByProduct={availableByProduct}
        leadingHead={<input type="checkbox" aria-label="Seleccionar los productos de la página" checked={allPageSelected} onChange={togglePage} />}
        leadingCell={(product) => <input type="checkbox" aria-label={`Seleccionar ${product.name}`} checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />}
        channelStates={channelStates}
        promoTags={promoTags}
      />
      <ChannelLegend />
      {printing ? <PrintLabelsDialog open source={{ kind: "products", productIds: selected }} onOpenChange={setPrinting} /> : null}
      <Pagination currentPage={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} itemName="productos" />
    </>}
  </div>;
}
