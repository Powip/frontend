"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStockByVariants } from "@/services/inventoryItems.service";
import { trackingError } from "@/services/inventoryTrackingService";
import { setVariantActive } from "@/services/variantStatusService";

export interface VariantStatus {
  id: string;
  isActive: boolean;
  mergedInto?: string | null;
  mergedIntoSku?: string | null;
  linkedSources?: string[];
}

const SOURCE_LABELS: Record<string, string> = { shopify: "Shopify", yavendio: "YaVendió", aliclik: "Aliclik" };

/**
 * FEAT-24 H0 — reemplaza "Eliminar" en variantes guardadas. Una unificada
 * (FEAT-17) no se reactiva; antes de desactivar se avisa del stock y de los
 * canales vinculados, porque sus ventas nuevas quedan por vincular.
 */
export default function VariantStatusControl({ variant, onChanged }: { variant: VariantStatus; onChanged: (isActive: boolean) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [stock, setStock] = useState<{ quantity: number; reserved: number } | null>(null);
  const [saving, setSaving] = useState(false);

  if (variant.mergedInto) {
    return <span className="text-xs text-muted-foreground">Unificada con {variant.mergedIntoSku ?? "otra variante"}</span>;
  }

  const change = async (isActive: boolean) => {
    setSaving(true);
    try {
      await setVariantActive(variant.id, isActive);
      setConfirming(false);
      onChanged(isActive);
    } catch (error) {
      toast.error(trackingError(error, "No se pudo cambiar el estado de la variante."));
    } finally {
      setSaving(false);
    }
  };

  if (!variant.isActive) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">Inactiva</span>
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => void change(true)}>
          Activar
        </Button>
      </div>
    );
  }

  const openConfirm = async () => {
    setConfirming(true);
    try {
      const [row] = await getStockByVariants([variant.id]);
      setStock(row ? { quantity: row.quantity, reserved: row.reserved_quantity } : { quantity: 0, reserved: 0 });
    } catch {
      setStock(null);
    }
  };

  const sources = (variant.linkedSources ?? []).map((source) => SOURCE_LABELS[source] ?? source);

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant="ghost" size="sm" className="text-amber-700" onClick={() => void openConfirm()}>
        Desactivar
      </Button>
      {confirming ? (
        <div role="dialog" aria-label="Desactivar variante" className="w-72 rounded-md border bg-background p-3 text-left text-xs shadow">
          <p className="font-medium">La variante deja de ofrecerse al vender y al comprar. Su historial se conserva.</p>
          {stock && (stock.quantity !== 0 || stock.reserved !== 0) ? (
            <p className="mt-2">
              Tiene {stock.quantity} unidades en stock y {stock.reserved} {stock.reserved === 1 ? "reservada" : "reservadas"}.
            </p>
          ) : null}
          {sources.map((source) => (
            <p key={source} className="mt-2">
              Las ventas nuevas de esta variante en {source} quedarán por vincular.
            </p>
          ))}
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void change(false)}>
              Desactivar variante
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
