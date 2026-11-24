"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStockByVariants } from "@/services/inventoryItems.service";
import type { PackChoiceComponentView, PackView } from "@/services/packsService";
import {
  availableInWarehouse,
  choiceSlots,
  chosenPack,
  emptyPicks,
  offeredVariants,
  pickUnit,
  variantAttributesLabel,
  type ChosenPack,
  type OfferedVariant,
  type UnitPicks,
} from "@/lib/packs/choosePack";

const unitLabel = (component: PackChoiceComponentView, unit: number) =>
  component.quantity > 1 ? `${component.productName} (unidad ${unit + 1} de ${component.quantity})` : component.productName;

const stockText = (variant: OfferedVariant) =>
  variant.available === null ? "stock sin confirmar" : variant.available > 0 ? `${variant.available} disp.` : "sin stock libre";

const optionLabel = (variant: OfferedVariant) =>
  [variantAttributesLabel(variant.attributeValues) || "Única", variant.sku ?? "Sin SKU", stockText(variant)].join(" · ");

/**
 * FEAT-32 M6b (spec §6.14, §7.17) — «Elige talla y color» de un pack «a elegir»: por cada componente, un selector
 * por unidad (arrancan iguales) con las variantes permitidas activas que tienen stock en el almacén de salida (las
 * sin stock no se ofrecen; sin dato de stock se ofrecen con «stock sin confirmar»). Sin ninguna con stock en un
 * componente no se puede agregar. Se monta al abrir.
 */
export default function ChoosePackPicker({
  pack,
  inventoryId,
  initialPicks,
  keepVariantIds,
  confirmLabel = "Agregar al pedido",
  onConfirm,
  onClose,
}: {
  pack: PackView;
  inventoryId: string | null | undefined;
  /** «Cambiar variantes»: la elección actual de la línea. */
  initialPicks?: UnitPicks | null;
  /** Variantes de la elección actual (se ofrecen aunque ya no tengan stock libre). */
  keepVariantIds?: ReadonlySet<string>;
  confirmLabel?: string;
  onConfirm: (chosen: ChosenPack) => void;
  onClose: () => void;
}) {
  const [picks, setPicks] = useState<UnitPicks>(() => initialPicks ?? emptyPicks(pack));
  const slots = useMemo(() => choiceSlots(pack), [pack]);
  const variantIds = useMemo(
    () => [...new Set(slots.flatMap((component) => component.variants.filter((variant) => variant.active !== false).map((variant) => variant.variantId)))].sort(),
    [slots],
  );

  const stock = useQuery({
    queryKey: ["choose-pack-stock", inventoryId ?? null, variantIds],
    queryFn: async () => availableInWarehouse(await getStockByVariants(variantIds), inventoryId as string),
    enabled: !!inventoryId && variantIds.length > 0,
    retry: false,
    staleTime: 15_000,
  });
  const loading = !!inventoryId && variantIds.length > 0 && stock.isPending;
  // Sin respuesta de logística (o sin almacén): stock sin confirmar.
  const stockMap = stock.isSuccess ? stock.data : null;

  const offered = useMemo(
    () => new Map(slots.map((component) => [component.slot, offeredVariants(component, stockMap, keepVariantIds)])),
    [slots, stockMap, keepVariantIds],
  );
  // Una elección que ya no se ofrece cuenta como sin elegir.
  const validPicks = useMemo<UnitPicks>(
    () =>
      Object.fromEntries(
        slots.map((component) => {
          const options = offered.get(component.slot) ?? [];
          return [component.slot, (picks[component.slot] ?? []).map((id) => (id && options.some((variant) => variant.variantId === id) ? id : null))];
        }),
      ),
    [slots, offered, picks],
  );
  const chosen = loading ? null : chosenPack(pack, validPicks);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Elige talla y color</DialogTitle>
          <DialogDescription>{pack.name}: elige la variante de cada unidad. El pedido guarda esos SKU para el almacén.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando el stock del almacén…</p>
        ) : slots.length === 0 ? (
          <p role="alert" className="text-sm text-destructive">Este pack no tiene productos para elegir.</p>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {!stockMap ? (
              <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                No se pudo confirmar el stock del almacén: las variantes se muestran con «stock sin confirmar».
              </p>
            ) : null}
            {slots.map((component) => {
              const options = offered.get(component.slot) ?? [];
              return (
                <fieldset key={component.slot} className="space-y-1.5">
                  <legend className="text-sm font-medium">
                    {component.productName}
                    <span className="ml-1.5 font-normal text-muted-foreground">· {component.quantity} u.</span>
                  </legend>
                  {options.length === 0 ? (
                    <p role="alert" className="text-sm text-destructive">
                      Sin stock de {component.productName} en este almacén
                    </p>
                  ) : (
                    (validPicks[component.slot] ?? []).map((value, unit) => (
                      <label key={unit} className="flex items-center gap-2 text-xs">
                        {component.quantity > 1 ? <span className="w-16 shrink-0 text-muted-foreground">Unidad {unit + 1}</span> : null}
                        <select
                          aria-label={unitLabel(component, unit)}
                          className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
                          value={value ?? ""}
                          onChange={(event) => setPicks(pickUnit(validPicks, component.slot, unit, event.target.value || null))}
                        >
                          <option value="">Elige variante…</option>
                          {options.map((variant) => (
                            <option key={variant.variantId} value={variant.variantId}>
                              {optionLabel(variant)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))
                  )}
                </fieldset>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              onConfirm(chosen);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
