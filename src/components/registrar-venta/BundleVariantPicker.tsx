"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { BundleProductRef } from "@/interfaces/IPack";
import type { InventoryItemForSale } from "@/interfaces/IProduct";

const variantLabel = (variant: InventoryItemForSale) =>
  Object.values(variant.attributes ?? {}).filter(Boolean).join(" / ") || "Única";

/**
 * FEAT-32 M6a (spec §6.18) — un bundle anterior armado por producto (sin variante) ya no elige solo la variante
 * de más stock: el vendedor elige la variante (SKU) del almacén de salida. Sin elegir, no se agrega y el bundle
 * no se aplica.
 */
export default function BundleVariantPicker({
  item,
  inventoryId,
  loadVariants,
  onPick,
  onClose,
}: {
  /** Producto del bundle que falta (`null` = cerrado). */
  item: BundleProductRef | null;
  inventoryId: string | null | undefined;
  loadVariants: (productKey: string) => Promise<InventoryItemForSale[]>;
  onPick: (variant: InventoryItemForSale) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const productKey = item && !("variantId" in item) ? item.productKey : null;
  const variants = useQuery({
    queryKey: ["bundle-variant-pick", inventoryId ?? null, productKey],
    queryFn: () => loadVariants(productKey as string),
    enabled: !!productKey && !!inventoryId,
    retry: false,
  });
  const rows = variants.data ?? [];
  const picked = rows.find((variant) => variant.variantId === chosen) ?? null;

  const close = () => {
    setChosen(null);
    onClose();
  };

  return (
    <Dialog open={!!productKey} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Elige la variante de cada producto del bundle</DialogTitle>
          <DialogDescription>
            {item?.productName ?? productKey}: el pedido guarda el SKU elegido.
          </DialogDescription>
        </DialogHeader>
        {variants.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando variantes…</p>
        ) : variants.isError ? (
          <p role="alert" className="text-sm text-destructive">No se pudieron cargar las variantes.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este producto no tiene variantes en el almacén de salida.</p>
        ) : (
          <div role="radiogroup" aria-label="Variante" className="max-h-72 space-y-1.5 overflow-y-auto">
            {rows.map((variant) => {
              const noStock = variant.availableStock <= 0;
              const selected = variant.variantId === chosen;
              return (
                <button
                  key={variant.variantId}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setChosen(variant.variantId)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    selected ? "border-primary bg-primary/5 dark:bg-primary/10" : "hover:border-primary/60",
                  )}
                >
                  <span className="min-w-0">
                    <span className="font-medium">{variantLabel(variant)}</span>
                    <span className="ml-1.5 font-mono text-xs text-muted-foreground">{variant.sku}</span>
                  </span>
                  <span className={cn("shrink-0 text-xs", noStock ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                    {noStock ? "sin stock en este almacén" : `${variant.availableStock} disp.`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              onPick(picked);
              close();
            }}
          >
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
