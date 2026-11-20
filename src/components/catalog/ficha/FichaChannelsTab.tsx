"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChannelBadge } from "@/components/catalog/CatalogBadges";
import { CHANNEL_LABEL, productChannel } from "@/lib/catalog/catalogProducts";
import { formatVariantLabel } from "@/lib/variantAttributes";
import type { CatalogProductDetail, CatalogVariantDetail } from "@/services/catalogProductService";

/**
 * FEAT-24 H4 (H4-D5) — Canales: de dónde viene el producto (Shopify, YaVendió, Aliclik o alta manual) y
 * con qué canal está unida cada variante (`product_external_ref`).
 */
export default function FichaChannelsTab({ product, variants }: { product: CatalogProductDetail; variants: CatalogVariantDetail[] }) {
  const origin = productChannel(product.externalSource);
  const live = variants.filter((variant) => !variant.mergedInto);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Origen del producto:</span>
        <ChannelBadge source={product.externalSource} />
        <span className="text-muted-foreground">
          {origin === "manual" ? "Creado en POWIP (alta manual o Excel)." : `Importado desde ${CHANNEL_LABEL[origin]}${product.externalId ? ` (ID ${product.externalId})` : ""}.`}
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variante</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Canales unidos</TableHead>
              <TableHead>SKU en Shopify</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {live.map((variant) => {
              const sources = [...new Set((variant.linkedSources ?? []).map((source) => source.toLowerCase()))];
              return (
                <TableRow key={variant.id}>
                  <TableCell className="font-medium">{formatVariantLabel(variant.attributeValues) || "Única"}</TableCell>
                  <TableCell className="font-mono text-xs">{variant.companySku || variant.sku}</TableCell>
                  <TableCell>
                    {sources.length ? <div className="flex flex-wrap gap-1">{sources.map((source) => <ChannelBadge key={source} source={source} />)}</div> : <span className="text-muted-foreground">Sin canal (solo POWIP)</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{variant.shopifySku || "—"}</TableCell>
                </TableRow>
              );
            })}
            {live.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin variantes.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
