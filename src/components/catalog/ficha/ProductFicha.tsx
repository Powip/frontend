"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { useCompanyBrands } from "@/hooks/useCompanyBrands";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { getCatalogProduct, getProductVariants } from "@/services/catalogProductService";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
import { getVariantCosts } from "@/services/purchasesService";
import { canSeeProductCosts } from "@/config/permissions.config";
import { isCompanyAdminRole } from "@/lib/purchaseOrders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MovementHistoryTable } from "@/components/inventory/MovementHistoryTable";
import { PrintLabelsDialog } from "@/components/labels/PrintLabelsDialog";
// FEAT-24 H13-D4: precio de compra por proveedor de cada variante.
import FichaSupplierPrices from "@/components/compras/supplier-prices/FichaSupplierPrices";
import { ChannelBadge, KindBadge, ProductThumb, SkuConflictBadge, StatusBadge } from "@/components/catalog/CatalogBadges";
import { liveVariants, productKind } from "@/lib/catalog/catalogProducts";
import { categoryPath } from "@/lib/catalog/categoryTree";
import { buildFichaStock } from "@/lib/catalog/fichaStock";
import { formatVariantLabel } from "@/lib/variantAttributes";
import FichaGeneralTab, { type FichaCosts } from "./FichaGeneralTab";
import FichaVariantsTab from "./FichaVariantsTab";
import FichaStockTab from "./FichaStockTab";
import FichaChannelsTab from "./FichaChannelsTab";
import PackFichaTab from "@/components/packs/PackFichaTab";

export type FichaTab = "general" | "pack" | "variantes" | "stock" | "canales" | "historial";

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
  // FEAT-24 H7: etiquetas de las variantes del producto.
  const [printingLabels, setPrintingLabels] = useState(false);
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
  // FEAT-24 H9: un pack tiene su pestaña con componentes, margen y disponible calculado.
  const isPack = kind === "pack";
  const stockView = useMemo(() => buildFichaStock(stockQuery.data ?? [], productId, variants), [stockQuery.data, productId, variants]);
  // FEAT-24 H10: el historial es el kardex de la fachada, que se lee por variante (todas, también las inactivas).
  // FEAT-24 H10: costo promedio por variante (Administrador y Operaciones lo ven; solo el Administrador lo carga).
  const canSeeCosts = canSeeProductCosts(auth?.user);
  const variantIds = useMemo(() => variants.filter((variant) => !variant.mergedInto).map((variant) => variant.id).sort(), [variants]);
  const costsQuery = useQuery({
    queryKey: ["variant-costs", companyId, variantIds],
    queryFn: async () => new Map((await getVariantCosts(variantIds)).map((cost) => [cost.variantId, cost.averageCost] as const)),
    enabled: canSeeCosts && variantIds.length > 0,
    retry: false,
  });
  const queryClient = useQueryClient();
  const costs: FichaCosts | undefined = canSeeCosts
    ? {
        byVariant: costsQuery.error ? "error" : costsQuery.data,
        canEdit: isCompanyAdminRole(auth?.user?.role),
        onSaved: (variantId, cost) =>
          queryClient.setQueryData<Map<string, number | null>>(["variant-costs", companyId, variantIds], (current) => new Map(current ?? []).set(variantId, cost)),
      }
    : undefined;
  const kardexVariants = useMemo(
    () => variants.map((variant) => {
      const attributes = formatVariantLabel(variant.attributeValues);
      const sku = variant.companySku || variant.sku;
      return { id: variant.id, label: `${attributes || "Única"}${sku ? ` (${sku})` : ""}${variant.isActive === false ? " · inactiva" : ""}` };
    }),
    [variants],
  );

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
  const activeTab: FichaTab = (isSimple && tab === "variantes") || (!isPack && tab === "pack") ? "general" : tab;

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
            {live.length > 0 ? (
              <Button variant="outline" onClick={() => setPrintingLabels(true)}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir etiquetas
              </Button>
            ) : null}
            {editHref ? <Button variant="outline" asChild><Link href={editHref}>Editar opciones y precios</Link></Button> : null}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(next) => setTab(next as FichaTab)}>
            <TabsList className="mb-4 h-auto flex-wrap">
              <TabsTrigger value="general">General</TabsTrigger>
              {isPack ? <TabsTrigger value="pack">Pack</TabsTrigger> : null}
              {!isSimple ? <TabsTrigger value="variantes">Variantes ({live.length})</TabsTrigger> : null}
              <TabsTrigger value="stock">Stock por almacén</TabsTrigger>
              <TabsTrigger value="canales">Canales</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <FichaGeneralTab key={product.id} product={product} simpleVariant={isSimple ? live[0] ?? null : null} categoryTree={categories.tree} canEdit costs={costs} />
            </TabsContent>
            {isPack ? (
              <TabsContent value="pack">
                <PackFichaTab productId={product.id} />
              </TabsContent>
            ) : null}
            {!isSimple ? (
              <TabsContent value="variantes">
                <FichaVariantsTab productId={product.id} productImage={product.imageUrl} variants={variants} canEdit costs={costs} />
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
                kardexVariants.length === 0 ? <p className="text-sm text-muted-foreground">Este producto todavía no tiene variantes.</p>
                  : <MovementHistoryTable companyId={companyId} scope={scope} inventories={warehouses.inventories} scopeReady={warehouses.isSuccess} variants={kardexVariants} title="Historial (kardex)" description="Movimientos de stock de la variante elegida, con su saldo." />
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <FichaSupplierPrices
        variants={variants
          .filter((variant) => !variant.mergedInto)
          .map((variant) => ({ id: variant.id, label: kardexVariants.find((candidate) => candidate.id === variant.id)?.label ?? variant.id }))}
        linkOrders={canSeeCosts}
      />
      {printingLabels ? (
        <PrintLabelsDialog open source={{ kind: "products", productIds: [product.id], title: product.name }} onOpenChange={setPrintingLabels} />
      ) : null}
    </div>
  );
}
