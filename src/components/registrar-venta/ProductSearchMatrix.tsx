"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, PackagePlus, PackageSearch } from "lucide-react";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import { Pack, VolumePack } from "@/interfaces/IPack";
import { packNetUnit } from "@/hooks/usePacksEngine";
import {
  groupProductsByModel,
  initials,
  isMatrixGroup,
  uniqueAttrValues,
  ProductGroup,
} from "@/utils/productGrouping";

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;
const normalize = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface QueryMatch {
  /** true si hay una búsqueda activa y algún token matchea un valor de fila/columna específico */
  rowValues: Set<string> | null;
  colValues: Set<string> | null;
}

/** Determina, para un grupo y una búsqueda, qué valores de fila/columna matchean —
 *  usado para atenuar las celdas que no corresponden (igual que el mockup original). */
function matchQuery(group: ProductGroup, query: string): QueryMatch {
  if (!query.trim() || group.commonAttributeKeys.length !== 2) {
    return { rowValues: null, colValues: null };
  }
  const [rowKey, colKey] = group.commonAttributeKeys;
  const rowOptions = uniqueAttrValues(group.items, rowKey);
  const colOptions = uniqueAttrValues(group.items, colKey);
  const tokens = normalize(query).split(/\s+/).filter(Boolean);

  const rowHit = new Set<string>();
  const colHit = new Set<string>();
  tokens.forEach((tk) => {
    rowOptions.forEach((v) => normalize(v).includes(tk) && rowHit.add(v));
    colOptions.forEach((v) => normalize(v).includes(tk) && colHit.add(v));
  });

  return {
    rowValues: rowHit.size ? rowHit : null,
    colValues: colHit.size ? colHit : null,
  };
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.some((tk) => normalize(text).includes(tk))) return text;
  const re = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    tokens.some((tk) => normalize(part) === tk) ? (
      <mark key={i} className="bg-amber-200/70 dark:bg-amber-500/40 rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

interface ProductSearchMatrixProps {
  products: InventoryItemForSale[];
  query: string;
  loading: boolean;
  isAdmin: boolean;
  onAddVariant: (item: InventoryItemForSale) => void;
  qtyInCartByVariant: (variantId: string) => number;
  modelQtyInCart: (productKey: string) => number;
  activePacksForProduct: (productKey: string) => Pack[];
  /** Contador local de "agregados al carrito" por producto — usado para
   *  mostrar los más frecuentes primero mientras no exista un endpoint
   *  real de más vendidos. */
  frequencies?: Record<string, number>;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export default function ProductSearchMatrix({
  products,
  query,
  loading,
  isAdmin,
  onAddVariant,
  qtyInCartByVariant,
  modelQtyInCart,
  activePacksForProduct,
  frequencies,
  onLoadMore,
  hasMore,
}: ProductSearchMatrixProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const groups = [...groupProductsByModel(products)].sort(
    (a, b) => (frequencies?.[b.key] ?? 0) - (frequencies?.[a.key] ?? 0),
  );

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
    <div
      className={cn(
        "space-y-2 transition-opacity duration-150",
        loading && "opacity-50 pointer-events-none",
      )}
    >
      {groups.map((group) => (
        <ModelCard
          key={group.key}
          group={group}
          query={query}
          open={openKey === group.key}
          onToggle={() => setOpenKey((prev) => (prev === group.key ? null : group.key))}
          onAddVariant={onAddVariant}
          qtyInCartByVariant={qtyInCartByVariant}
          modelQty={modelQtyInCart(group.key)}
          packs={activePacksForProduct(group.key)}
          isAdmin={isAdmin}
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

function Thumb({
  imageUrl,
  name,
  size = 40,
  className,
}: {
  imageUrl?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-xl object-cover shrink-0 border", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold shrink-0",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(name) || "?"}
    </div>
  );
}

function ModelCard({
  group,
  query,
  open,
  onToggle,
  onAddVariant,
  qtyInCartByVariant,
  modelQty,
  packs,
  isAdmin,
}: {
  group: ProductGroup;
  query: string;
  open: boolean;
  onToggle: () => void;
  onAddVariant: (item: InventoryItemForSale) => void;
  qtyInCartByVariant: (variantId: string) => number;
  modelQty: number;
  packs: Pack[];
  isAdmin: boolean;
}) {
  const priceLabel =
    group.minPrice === group.maxPrice
      ? fmt(group.minPrice)
      : `${fmt(group.minPrice)} – ${fmt(group.maxPrice)}`;
  const low = group.totalStock > 0 && group.totalStock < 10;
  const baseSku = group.items[0]?.sku;
  const match = matchQuery(group, query);

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
        <Thumb imageUrl={group.imageUrl} name={group.productName} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">
              {highlight(group.productName, query)}
            </span>
            {baseSku && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                {highlight(baseSku, query)}
              </span>
            )}
            {/* brand/category/subcategory: no llegan del backend todavía
                (ver gaps pedidos), pero quedan listas para cuando existan */}
            {group.brand && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                {highlight(group.brand, query)}
              </span>
            )}
            {group.category && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                {highlight(
                  group.subcategory
                    ? `${group.category} · ${group.subcategory}`
                    : group.category,
                  query,
                )}
              </span>
            )}
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
        <div className="border-t border-dashed p-3 bg-muted/20 space-y-3">
          {isMatrixGroup(group) ? (
            <MatrixGrid
              group={group}
              query={query}
              match={match}
              onAddVariant={onAddVariant}
              qtyInCartByVariant={qtyInCartByVariant}
            />
          ) : (
            <VariantList
              group={group}
              query={query}
              onAddVariant={onAddVariant}
              qtyInCartByVariant={qtyInCartByVariant}
            />
          )}
          <MatrixFoot group={group} packs={packs} isAdmin={isAdmin} baseSku={baseSku} />
        </div>
      )}
    </div>
  );
}

function MatrixFoot({
  group,
  packs,
  isAdmin,
  baseSku,
}: {
  group: ProductGroup;
  packs: Pack[];
  isAdmin: boolean;
  baseSku?: string;
}) {
  const volumePack = packs.find((p): p is VolumePack => p.type === "VOLUME");
  return (
    <div className="flex items-center justify-between flex-wrap gap-1 text-[11px] text-muted-foreground border-t pt-2">
      <span>
        {volumePack ? (
          <>
            🎁 <b className="text-foreground">{volumePack.name}</b>: arma {volumePack.minQty} u. y
            baja a {fmt(packNetUnit(volumePack))}
            {isAdmin ? " c/u neto" : ""}
          </>
        ) : (
          <>SKU base: {baseSku ?? "—"}</>
        )}
      </span>
      {volumePack && <span>{baseSku}</span>}
    </div>
  );
}

function MatrixGrid({
  group,
  query,
  match,
  onAddVariant,
  qtyInCartByVariant,
}: {
  group: ProductGroup;
  query: string;
  match: QueryMatch;
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
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <span className="text-[11px] text-muted-foreground">
          Toca una celda para agregar la variante · <b>stock por {rowKey} y {colKey}</b>
        </span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <i className="inline-block w-2.5 h-2.5 rounded-sm border bg-background" /> Disp.
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block w-2.5 h-2.5 rounded-sm border border-amber-300" /> Bajo
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block w-2.5 h-2.5 rounded-sm border border-dashed bg-muted" /> Sin
            stock
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-600" /> En venta
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: 4 }}>
          <thead>
            <tr>
              <th className="text-left text-[11px] font-medium text-muted-foreground capitalize pl-1">
                {rowKey} \ {colKey}
              </th>
              {colValues.map((c) => (
                <th
                  key={c}
                  className={cn(
                    "text-[11px] font-medium capitalize transition-opacity",
                    match.colValues && !match.colValues.has(c)
                      ? "opacity-30 text-muted-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {highlight(c, query)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowValues.map((r) => {
              const rowDim = match.rowValues ? !match.rowValues.has(r) : false;
              return (
                <tr key={r}>
                  <td
                    className={cn(
                      "text-xs font-semibold capitalize pl-1 whitespace-nowrap transition-opacity",
                      rowDim && "opacity-30",
                    )}
                  >
                    {highlight(r, query)}
                  </td>
                  {colValues.map((c) => {
                    const item = findItem(r, c);
                    if (!item) return <td key={c} />;
                    const inCart = qtyInCartByVariant(item.variantId);
                    const stock = item.availableStock;
                    const oos = stock <= 0;
                    const colDim = match.colValues ? !match.colValues.has(c) : false;
                    const dim = (rowDim || colDim) && !inCart;
                    return (
                      <td key={c}>
                        <button
                          type="button"
                          disabled={oos}
                          onClick={() => onAddVariant(item)}
                          className={cn(
                            "relative w-16 h-11 rounded-lg border flex flex-col items-center justify-center gap-0.5 text-[10px] transition-all",
                            oos
                              ? "bg-muted border-dashed text-muted-foreground/60 cursor-not-allowed"
                              : inCart
                                ? "bg-violet-600 border-violet-600 text-white"
                                : "bg-background hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10",
                            !oos && stock < 10 && !inCart && "border-amber-300",
                            dim && "opacity-30 grayscale",
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VariantList({
  group,
  query,
  onAddVariant,
  qtyInCartByVariant,
}: {
  group: ProductGroup;
  query: string;
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
            <Thumb imageUrl={item.imageUrl ?? group.imageUrl} name={group.productName} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{highlight(attrLabel, query)}</div>
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
