"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { useCompanyBrands } from "@/hooks/useCompanyBrands";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { getCatalogProduct, getProductVariants } from "@/services/catalogProductService";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MovementHistoryTable } from "@/components/inventory/MovementHistoryTable";
import { ChannelBadge, KindBadge, ProductThumb, SkuConflictBadge, StatusBadge } from "@/components/catalog/CatalogBadges";
import { liveVariants, productKind } from "@/lib/catalog/catalogProducts";
import { categoryPath } from "@/lib/catalog/categoryTree";
import { buildFichaStock } from "@/lib/catalog/fichaStock";
import FichaGeneralTab from "./FichaGeneralTab";
import FichaVariantsTab from "./FichaVariantsTab";
import FichaStockTab from "./FichaStockTab";
import FichaChannelsTab from "./FichaChannelsTab";

export type FichaTab = "general" | "variantes" | "stock" | "canales" | "historial";

/**
 * FEAT-24 H4 (H4-D11) — ficha del producto en pestañas (spec §6.1, mockup `vFicha`): General, Variantes,
 * Stock por almacén, Canales e Historial (kardex). Un producto simple no tiene pestaña Variantes: su SKU
 * y su código de barras están en General. `actions` deja lugar a botones de la cabecera (p. ej. etiquetas).
 */
export default function ProductFicha({ productId, actions }: { productId: string; actions?: ReactNode }) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const accessToken = auth?.accessToken ?? "";
  const { scope, storeIds, canFetch } = useBusinessScope();
  const warehouses = useBusinessInventories({ scope, storeIds });
  const { brands } = useCompanyBrands();
  const categories = useCatalogCategories();
  const [tab, setTab] = useState<FichaTab>("general");
  const enabled = Boolean(companyId && accessToken && productId);

  const productQuery = useQuery({
    queryKey: ["catalog-product", companyId, productId],
    queryFn: ({ signal }) => getCatalogProduct(productId, companyId, signal),
    enabled, retry: false,
  });
  const variantsQuery = useQuery({
    queryKey: ["catalog-product-variants", productId],
    queryFn: ({ signal }) => getProductVariants(productId, signal),
    enabled: enabled && productQuery.isSuccess, retry: false,
  });
  // Misma consulta (y misma caché) que el listado del catálogo.
  const stockQuery = useQuery({
    queryKey: ["business-inventory-items", companyId, auth?.user?.id, scope, storeIds, warehouses.inventories.map((inv) => inv.id).sort()],
    queryFn: ({ signal }) => fetchBusinessInventoryItems({ inventories: warehouses.inventories, companyId, accessToken, signal }),
    enabled: canFetch && warehouses.isSuccess, retry: false,
  });

  const product = productQuery.data;
  const variants = useMemo(() => variantsQuery.data ?? [], [variantsQuery.data]);
  const live = liveVariants(variants);
  const kind = product ? productKind({ ...product, variants }) : "variantes";
  const isSimple = kind === "simple";
  const stockView = useMemo(() => buildFichaStock(stockQuery.data ?? [], productId, variants), [stockQuery.data, productId, variants]);
  const itemIds = useMemo(() => stockView.rows.map((row) => row.inventoryItemId), [stockView.rows]);

  if (productQuery.error || variantsQuery.error) {
    const error = productQuery.error || variantsQuery.error;
    return (
      <div role="alert" className="space-y-3 p-6">
        <p>No se pudo abrir el producto. {error instanceof Error ? error.message : ""}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { void productQuery.refetch(); void variantsQuery.refetch(); }}>Reintentar</Button>
          <Button variant="ghost" asChild><Link href="/productos">Volver al catálogo</Link></Button>
        </div>
      </div>
    );
  }
  if (!product || variantsQuery.isPending) return <p role="status" className="p-6">Cargando producto...</p>;

  const brand = product.brandId ? brands.find((item) => item.id === product.brandId)?.name : undefined;
  const category = categoryPath(categories.tree, product.categoryId ?? product.category?.id) ?? product.category?.name;
  const conflict = Boolean(product.skuConflict) || live.some((variant) => variant.skuConflict);
  const editHref = live[0] ? `/productos?edit=${encodeURIComponent(live[0].id)}` : null;
  const activeTab: FichaTab = isSimple && tab === "variantes" ? "general" : tab;

  return (
    <div className="space-y-4 p-6">
      <Button variant="ghost" size="sm" asChild><Link href="/productos"><ArrowLeft className="mr-2 h-4 w-4" />Volver al catálogo</Link></Button>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-4">
          <ProductThumb src={product.imageUrl} name={product.name} size={56} />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-xl font-semibold">{product.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">{product.companySku || product.sku}</span>
              {brand ? <Badge variant="outline">{brand}</Badge> : <Badge variant="outline" className="text-muted-foreground">Sin marca</Badge>}
              {category ? <Badge variant="outline">{category}</Badge> : null}
              <KindBadge kind={kind} />
              <ChannelBadge source={product.externalSource} />
              <StatusBadge active={product.status !== false} />
              {conflict ? <SkuConflictBadge /> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions}
            {editHref ? <Button variant="outline" asChild><Link href={editHref}>Editar opciones y precios</Link></Button> : null}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(next) => setTab(next as FichaTab)}>
            <TabsList className="mb-4 h-auto flex-wrap">
              <TabsTrigger value="general">General</TabsTrigger>
              {!isSimple ? <TabsTrigger value="variantes">Variantes ({live.length})</TabsTrigger> : null}
              <TabsTrigger value="stock">Stock por almacén</TabsTrigger>
              <TabsTrigger value="canales">Canales</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <FichaGeneralTab key={product.id} product={product} simpleVariant={isSimple ? live[0] ?? null : null} categoryTree={categories.tree} canEdit />
            </TabsContent>
            {!isSimple ? (
              <TabsContent value="variantes">
                <FichaVariantsTab productId={product.id} productImage={product.imageUrl} variants={variants} canEdit />
              </TabsContent>
            ) : null}
            <TabsContent value="stock">
              {stockQuery.error || warehouses.error ? <p role="alert">No se pudo leer el stock. <Button variant="outline" size="sm" onClick={() => void stockQuery.refetch()}>Reintentar</Button></p>
                : stockQuery.isPending ? <p role="status">Cargando stock...</p>
                : <FichaStockTab view={stockView} showVariant={!isSimple} />}
            </TabsContent>
            <TabsContent value="canales">
              <FichaChannelsTab product={product} variants={variants} />
            </TabsContent>
            <TabsContent value="historial">
              {activeTab === "historial" ? (
                stockQuery.isPending ? <p role="status">Cargando historial...</p>
                  : itemIds.length === 0 ? <p className="text-sm text-muted-foreground">Este producto todavía no tiene movimientos de stock.</p>
                  : <MovementHistoryTable companyId={companyId} scope={scope} inventories={warehouses.inventories} scopeReady={warehouses.isSuccess} inventoryItemIds={itemIds} title="Historial (kardex)" description="Movimientos de stock de las variantes de este producto." />
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
