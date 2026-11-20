"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CategoryTreeSelect, { NATIVE_SELECT_CLASS } from "./CategoryTreeSelect";
import { CHANNEL_LABEL, KIND_LABEL, hasActiveCatalogFilters, DEFAULT_CATALOG_FILTERS, type CatalogFilters, type ProductChannel, type ProductKind } from "@/lib/catalog/catalogProducts";
import type { CatalogCategoryNode } from "@/lib/catalog/categoryTree";

const CHANNELS = Object.keys(CHANNEL_LABEL) as ProductChannel[];
const KINDS: ProductKind[] = ["simple", "variantes"];

/** FEAT-24 H4 (H4-D11) — filtros del listado: marca, categoría (árbol), canal, tipo, estado y con/sin stock. */
export default function CatalogFiltersBar({
  filters,
  onChange,
  brands,
  categoryTree,
}: {
  filters: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
  brands: Array<{ id: string; name: string }>;
  categoryTree: CatalogCategoryNode[];
}) {
  const set = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) => onChange({ ...filters, [key]: value });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="Buscar productos" placeholder="Buscar nombre o SKU" value={filters.search} onChange={(event) => set("search", event.target.value)} className="w-full sm:w-64" />
      <select aria-label="Marca" className={`${NATIVE_SELECT_CLASS} sm:w-44`} value={filters.brandId} onChange={(event) => set("brandId", event.target.value)}>
        <option value="all">Todas las marcas</option>
        <option value="none">Sin marca</option>
        {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
      </select>
      <CategoryTreeSelect aria-label="Categoría" filterMode tree={categoryTree} value={filters.categoryId} onChange={(value) => set("categoryId", value)} className="sm:w-48" />
      <select aria-label="Canal" className={`${NATIVE_SELECT_CLASS} sm:w-40`} value={filters.channel} onChange={(event) => set("channel", event.target.value as CatalogFilters["channel"])}>
        <option value="all">Todos los canales</option>
        {CHANNELS.map((channel) => <option key={channel} value={channel}>{CHANNEL_LABEL[channel]}</option>)}
      </select>
      <select aria-label="Tipo" className={`${NATIVE_SELECT_CLASS} sm:w-40`} value={filters.type} onChange={(event) => set("type", event.target.value as CatalogFilters["type"])}>
        <option value="all">Todos los tipos</option>
        {KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}
      </select>
      <select aria-label="Estado" className={`${NATIVE_SELECT_CLASS} sm:w-36`} value={filters.status} onChange={(event) => set("status", event.target.value as CatalogFilters["status"])}>
        <option value="all">Todos los estados</option>
        <option value="activo">Activos</option>
        <option value="inactivo">Inactivos</option>
      </select>
      <select aria-label="Stock" className={`${NATIVE_SELECT_CLASS} sm:w-36`} value={filters.stock} onChange={(event) => set("stock", event.target.value as CatalogFilters["stock"])}>
        <option value="all">Con y sin stock</option>
        <option value="con">Con stock</option>
        <option value="sin">Sin stock</option>
      </select>
      {hasActiveCatalogFilters(filters) ? <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_CATALOG_FILTERS)}>Limpiar filtros</Button> : null}
    </div>
  );
}
