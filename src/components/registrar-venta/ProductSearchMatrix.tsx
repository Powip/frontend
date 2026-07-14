"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, PackagePlus, PackageSearch } from "lucide-react";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import { Pack } from "@/interfaces/IPack";
import {
  groupProductsByModel,
  initials,
  isMatrixGroup,
  uniqueAttrValues,
  ProductGroup,
} from "@/utils/productGrouping";

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;

interface ProductSearchMatrixProps {
  products: InventoryItemForSale[];
  query: string;
  loading: boolean;
  onAddVariant: (item: InventoryItemForSale) => void;
  qtyInCartByVariant: (variantId: string) => number;
  modelQtyInCart: (productKey: string) => number;
  activePacksForProduct: (productKey: string) => Pack[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export default function ProductSearchMatrix({
  products,
  query,
  loading,
  onAddVariant,
  qtyInCartByVariant,
  modelQtyInCart,
  activePacksForProduct,
  onLoadMore,
  hasMore,
}: ProductSearchMatrixProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const groups = groupProductsByModel(products);

  if (loading && groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground animate-pulse py-4">
        Buscando productos...
      </p>
    );
  }

  if (!loading && groups.length === 0) {
    return (
      <div className="rounded-xl border-[1.5px] border-dashed bg-muted/20 py-9 px-5 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
          <PackageSearch className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold">
          {query ? `Sin resultados para "${query}"` : "No hay productos en este almacén"}
        </p>
        <span className="text-xs text-muted-foreground">
          Prueba con otro almacén o crea un producto nuevo
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <ModelCard
          key={group.key}
          group={group}
          open={openKey === group.key}
          onToggle={() => setOpenKey((prev) => (prev === group.key ? null : group.key))}
          onAddVariant={onAddVariant}
          qtyInCartByVariant={qtyInCartByVariant}
          modelQty={modelQtyInCart(group.key)}
          packs={activePacksForProduct(group.key)}
        />
      ))}
      {hasMore && (
        <div className="pt-2 text-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
            {loading ? "Cargando..." : "Cargar más"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ModelCard({
  group,
  open,
  onToggle,
  onAddVariant,
  qtyInCartByVariant,
  modelQty,
  packs,
}: {
  group: ProductGroup;
  open: boolean;
  onToggle: () => void;
  onAddVariant: (item: InventoryItemForSale) => void;
  qtyInCartByVariant: (variantId: string) => number;
  modelQty: number;
  packs: Pack[];
}) {
  const priceLabel =
    group.minPrice === group.maxPrice
      ? fmt(group.minPrice)
      : `${fmt(group.minPrice)} – ${fmt(group.maxPrice)}`;
  const low = group.totalStock > 0 && group.totalStock < 10;

  return (
    <div
      className={cn(
        "border rounded-2xl overflow-hidden bg-card transition-all",
        open && "border-violet-500 shadow-md shadow-violet-600/10",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40"
      >
        <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
          {initials(group.productName) || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{group.productName}</span>
            {packs.length > 0 && (
              <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-300 gap-1">
                <PackagePlus className="h-3 w-3" /> con pack
              </Badge>
            )}
            {modelQty > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300">
                {modelQty} en venta
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>
              {group.items.length} variante{group.items.length !== 1 ? "s" : ""}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] h-4 px-1.5",
                low
                  ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300"
                  : "text-muted-foreground",
              )}
            >
              {group.totalStock.toLocaleString()} u.
            </Badge>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold text-sm text-violet-700 dark:text-violet-300">{priceLabel}</div>
          <div className="text-[10px] text-muted-foreground">PVP</div>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180 text-violet-600")}
        />
      </button>

      {open && (
        <div className="border-t border-dashed p-3 bg-muted/20">
          {isMatrixGroup(group) ? (
            <MatrixGrid
              group={group}
              onAddVariant={onAddVariant}
              qtyInCartByVariant={qtyInCartByVariant}
            />
          ) : (
            <VariantList
              group={group}
              onAddVariant={onAddVariant}
              qtyInCartByVariant={qtyInCartByVariant}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MatrixGrid({
  group,
  onAddVariant,
  qtyInCartByVariant,
}: {
  group: ProductGroup;
  onAddVariant: (item: InventoryItemForSale) => void;
  qtyInCartByVariant: (variantId: string) => number;
}) {
  const [rowKey, colKey] = group.commonAttributeKeys;
  const rowValues = uniqueAttrValues(group.items, rowKey);
  const colValues = uniqueAttrValues(group.items, colKey);

  const findItem = (rowVal: string, colVal: string) =>
    group.items.find(
      (i) => i.attributes?.[rowKey] === rowVal && i.attributes?.[colKey] === colVal,
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 4 }}>
        <thead>
          <tr>
            <th className="text-left text-[11px] font-medium text-muted-foreground capitalize pl-1">
              {rowKey} \ {colKey}
            </th>
            {colValues.map((c) => (
              <th key={c} className="text-[11px] font-medium text-muted-foreground capitalize">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowValues.map((r) => (
            <tr key={r}>
              <td className="text-xs font-semibold capitalize pl-1 whitespace-nowrap">{r}</td>
              {colValues.map((c) => {
                const item = findItem(r, c);
                if (!item) return <td key={c} />;
                const inCart = qtyInCartByVariant(item.variantId);
                const stock = item.availableStock;
                const oos = stock <= 0;
                return (
                  <td key={c}>
                    <button
                      type="button"
                      disabled={oos}
                      onClick={() => onAddVariant(item)}
                      className={cn(
                        "relative w-16 h-11 rounded-lg border flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors",
                        oos
                          ? "bg-muted border-dashed text-muted-foreground/60 cursor-not-allowed"
                          : inCart
                            ? "bg-violet-600 border-violet-600 text-white"
                            : "bg-background hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10",
                        !oos && stock < 10 && !inCart && "border-amber-300",
                      )}
                    >
                      {inCart > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                          {inCart}
                        </span>
                      )}
                      <span className="font-bold text-[12px]">
                        {oos ? "—" : inCart || "+"}
                      </span>
                      <span className="opacity-80">{oos ? "sin stock" : `${stock} u.`}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VariantList({
  group,
  onAddVariant,
  qtyInCartByVariant,
}: {
  group: ProductGroup;
  onAddVariant: (item: InventoryItemForSale) => void;
  qtyInCartByVariant: (variantId: string) => number;
}) {
  return (
    <div className="space-y-1.5">
      {group.items.map((item) => {
        const inCart = qtyInCartByVariant(item.variantId);
        const oos = item.availableStock <= 0;
        const attrLabel = item.attributes
          ? Object.entries(item.attributes)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")
          : item.sku;
        return (
          <button
            key={item.variantId}
            type="button"
            disabled={oos}
            onClick={() => onAddVariant(item)}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
              oos
                ? "bg-muted border-dashed opacity-70 cursor-not-allowed"
                : inCart
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                  : "hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10",
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{attrLabel}</div>
              <div className="text-[11px] text-muted-foreground">{item.sku}</div>
            </div>
            <Badge
              variant="outline"
              className={cn("text-[10px]", oos && "border-destructive text-destructive")}
            >
              {oos ? "Sin stock" : `${item.availableStock} u.`}
            </Badge>
            <span className="font-semibold text-sm text-violet-700 dark:text-violet-300 min-w-[64px] text-right">
              {fmt(item.price)}
            </span>
            {inCart > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300">
                ×{inCart}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
