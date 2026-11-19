"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { categoryPath, type CatalogCategoryNode } from "@/lib/catalog/categoryTree";
import { hasSkuConflict, liveVariants, productKind, visibleProductSku } from "@/lib/catalog/catalogProducts";
import type { BusinessProduct } from "@/services/businessProductsService";
import { ChannelBadge, KindBadge, ProductThumb, SkuConflictBadge, StatusBadge } from "./CatalogBadges";

export const productFichaHref = (productId: string) => `/productos/${encodeURIComponent(productId)}`;

/**
 * FEAT-24 H4 (H4-D11) — tabla del catálogo (mockup `vCatProductos`): foto, nombre y SKU base, marca,
 * categoría propia, tipo, canal, variantes, disponible, precio en soles y estado. Sin almacén ni «$».
 * `leadingHead`/`leadingCell` dejan una columna al inicio para quien la necesite (p. ej. selección).
 */
export default function CatalogProductTable({
  products,
  brandNames,
  categoryTree,
  availableByProduct,
  leadingHead,
  leadingCell,
}: {
  products: BusinessProduct[];
  brandNames: Map<string, string>;
  categoryTree: CatalogCategoryNode[];
  availableByProduct: Map<string, number>;
  leadingHead?: ReactNode;
  leadingCell?: (product: BusinessProduct) => ReactNode;
}) {
  const columns = 10 + (leadingHead ? 1 : 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {leadingHead ? <TableHead className="w-10">{leadingHead}</TableHead> : null}
          <TableHead>Producto · SKU base</TableHead>
          <TableHead>Marca</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead className="text-right">Variantes</TableHead>
          <TableHead className="text-right">Disponible</TableHead>
          <TableHead className="text-right">Precio</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const available = availableByProduct.get(product.id) ?? 0;
          const category = product.categoryId || product.category?.id ? categoryPath(categoryTree, product.categoryId ?? product.category?.id) ?? product.category?.name ?? null : null;
          const brand = product.brandId ? brandNames.get(product.brandId) : undefined;
          return (
            <TableRow key={product.id}>
              {leadingCell ? <TableCell>{leadingCell(product)}</TableCell> : null}
              <TableCell>
                <Link href={productFichaHref(product.id)} className="flex items-center gap-3 hover:underline">
                  <ProductThumb src={product.imageUrl} name={product.name} />
                  <span className="min-w-0">
                    <span className="block font-medium">{product.name}</span>
                    <span className="flex flex-wrap items-center gap-1 font-mono text-xs text-muted-foreground">{visibleProductSku(product)}{hasSkuConflict(product) ? <SkuConflictBadge /> : null}</span>
                  </span>
                </Link>
              </TableCell>
              <TableCell>{brand ?? <span className="text-muted-foreground">Sin marca</span>}</TableCell>
              <TableCell>{category ?? <span className="text-muted-foreground">Sin categoría</span>}</TableCell>
              <TableCell><KindBadge kind={productKind(product)} /></TableCell>
              <TableCell><ChannelBadge source={product.externalSource} /></TableCell>
              <TableCell className="text-right tabular-nums">{liveVariants(product.variants).length}</TableCell>
              <TableCell className={`text-right tabular-nums font-medium ${available <= 0 ? "text-red-600" : ""}`}>{available}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(product.priceVta)}</TableCell>
              <TableCell><StatusBadge active={product.status !== false} /></TableCell>
              <TableCell className="text-right"><Link href={productFichaHref(product.id)} className="text-sm font-medium text-primary hover:underline">Ver ficha</Link></TableCell>
            </TableRow>
          );
        })}
        {products.length === 0 ? <TableRow><TableCell colSpan={columns} className="py-8 text-center text-muted-foreground">Sin productos con estos filtros.</TableCell></TableRow> : null}
      </TableBody>
    </Table>
  );
}
