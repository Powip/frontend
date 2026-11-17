"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { fetchBusinessProducts, scopeBusinessProducts } from "@/services/businessProductsService";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintLabelsDialog } from "@/components/labels/PrintLabelsDialog";

export default function BusinessProductCatalog({ onCreate }: { onCreate: () => void }) {
  const { auth } = useAuth();
  const { scope, storeIds, canFetch } = useBusinessScope();
  const warehouses = useBusinessInventories({ scope, storeIds });
  const companyId = auth?.company?.id ?? "";
  const accessToken = auth?.accessToken ?? "";
  const [search, setSearch] = useState("");
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
  const filtered = useMemo(() => scopeBusinessProducts(products.data ?? [], stock.data ?? [], scope, search), [products.data, stock.data, scope, search]);
  const stockByProduct = useMemo(() => {
    const sums = new Map<string, { physical: number; available: number }>();
    for (const row of stock.data ?? []) {
      const sum = sums.get(row.productId) ?? { physical: 0, available: 0 };
      sum.physical += row.physicalStock; sum.available += row.availableStock;
      sums.set(row.productId, sum);
    }
    return sums;
  }, [stock.data]);
  const pageProducts = filtered.slice((page - 1) * 20, page * 20);
  const allPageSelected = pageProducts.length > 0 && pageProducts.every((product) => selected.includes(product.id));
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const togglePage = () => setSelected((current) => allPageSelected
    ? current.filter((id) => !pageProducts.some((product) => product.id === id))
    : [...new Set([...current, ...pageProducts.map((product) => product.id)])]);
  const error = products.error || warehouses.error || stock.error;
  const loading = products.isPending || warehouses.isPending || (warehouses.isSuccess && stock.isPending);
  return <div className="space-y-4 p-6">
    <HeaderConfig title="Productos" description="Catálogo y stock del alcance seleccionado" />
    <div className="flex gap-3 justify-between"><Input aria-label="Buscar productos" placeholder="Buscar nombre o SKU" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="max-w-md" /><div className="flex gap-2"><Button variant="outline" disabled={selected.length === 0} onClick={() => setPrinting(true)}>Imprimir etiquetas{selected.length ? ` (${selected.length})` : ""}</Button><Button onClick={onCreate}>Crear producto</Button></div></div>
    {error ? <div role="alert">No se pudo cargar el catálogo. {error instanceof Error ? error.message : "Verifica la sesión."} <Button variant="outline" onClick={() => { void products.refetch(); void warehouses.refetch(); if (warehouses.isSuccess) void stock.refetch(); }}>Reintentar</Button></div> : loading ? <p role="status">Cargando productos y almacenes...</p> : <>
      <p className="text-sm text-muted-foreground">{filtered.length} productos · {scope === "business" ? "Todo el negocio" : "Tienda seleccionada"}</p>
      <Table><TableHeader><TableRow><TableHead className="w-10"><input type="checkbox" aria-label="Seleccionar los productos de la página" checked={allPageSelected} onChange={togglePage} /></TableHead><TableHead>Producto</TableHead><TableHead>SKU</TableHead><TableHead>Estado</TableHead><TableHead>Precio venta</TableHead><TableHead>Stock físico</TableHead><TableHead>Disponible</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
        <TableBody>{pageProducts.map((product) => {
          const variant = product.variants?.find((item) => item.status !== false) ?? product.variants?.[0];
          const sum = stockByProduct.get(product.id);
          return <TableRow key={product.id}><TableCell><input type="checkbox" aria-label={`Seleccionar ${product.name}`} checked={selected.includes(product.id)} onChange={() => toggle(product.id)} /></TableCell><TableCell>{product.name}</TableCell><TableCell>{product.companySku || product.sku}</TableCell><TableCell>{product.status ? "Activo" : "Inactivo"}</TableCell><TableCell>S/ {Number(product.priceVta || 0).toFixed(2)}</TableCell><TableCell>{sum?.physical ?? 0}</TableCell><TableCell>{sum?.available ?? 0}</TableCell><TableCell><Link href={variant ? `/productos?edit=${encodeURIComponent(variant.id)}` : `/productos/${encodeURIComponent(product.id)}/edit`}>Editar</Link></TableCell></TableRow>;
        })}{filtered.length === 0 ? <TableRow><TableCell colSpan={8}>No hay productos en este alcance.</TableCell></TableRow> : null}</TableBody>
      </Table>
      {printing ? <PrintLabelsDialog open source={{ kind: "products", productIds: selected }} onOpenChange={setPrinting} /> : null}
      <Pagination currentPage={page} totalPages={Math.ceil(filtered.length / 20)} totalItems={filtered.length} itemsPerPage={20} onPageChange={setPage} itemName="productos" />
    </>}
  </div>;
}
