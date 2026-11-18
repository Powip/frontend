"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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

const PAGE_SIZE = 20;

export default function BusinessProductCatalog({ onCreate }: { onCreate: () => void }) {
  const { auth } = useAuth();
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
  const availableByProduct = useMemo(() => {
    const sums = new Map<string, number>();
    for (const row of stock.data ?? []) sums.set(row.productId, (sums.get(row.productId) ?? 0) + row.availableStock);
    return sums;
  }, [stock.data]);
  const brandNames = useMemo(() => new Map(brands.map((brand) => [brand.id, brand.name])), [brands]);
  // El alcance (tienda) se aplica primero; después, los filtros del catálogo (FEAT-24 H4).
  const filtered = useMemo(
    () => filterCatalogProducts(scopeBusinessProducts(products.data ?? [], stock.data ?? [], scope, ""), filters, { categoryTree: categories.tree, availableByProduct }),
    [products.data, stock.data, scope, filters, categories.tree, availableByProduct],
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
      <p className="text-sm text-muted-foreground">{filtered.length} productos · {scope === "business" ? "Todo el negocio" : "Tienda seleccionada"}</p>
      <CatalogProductTable
        products={pageProducts}
        brandNames={brandNames}
        categoryTree={categories.tree}
        availableByProduct={availableByProduct}
        leadingHead={<input type="checkbox" aria-label="Seleccionar los productos de la página" checked={allPageSelected} onChange={togglePage} />}
        leadingCell={(product) => <input type="checkbox" aria-label={`Seleccionar ${product.name}`} checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />}
      />
      {printing ? <PrintLabelsDialog open source={{ kind: "products", productIds: selected }} onOpenChange={setPrinting} /> : null}
      <Pagination currentPage={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} itemName="productos" />
    </>}
  </div>;
}
