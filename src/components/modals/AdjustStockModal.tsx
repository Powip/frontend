"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import type { InventoryItemForSale } from "@/interfaces/IProduct";
import { formatVariantLabel } from "@/lib/variantAttributes";
import { MAX_ITEM_UNITS, MAX_ITEM_UNITS_MESSAGE, largeQuantityConfirmText, needsQuantityConfirmation } from "@/lib/stockLimits";
import { trackingError } from "@/services/inventoryTrackingService";
import { ADJUSTMENT_REASON_LABELS, adjustStock, type AdjustmentReason } from "@/services/stockAdjustmentService";

interface Props {
  open: boolean;
  item: InventoryItemForSale | null;
  onClose: () => void;
  onSuccess?: () => void;
}

/** FEAT-24 H0 — ajuste de stock en más o en menos, con motivo obligatorio. No muestra el costo. */
export default function AdjustStockModal({ open, item, onClose, onSuccess }: Props) {
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<AdjustmentReason | "">("");
  const [note, setNote] = useState("");
  const [confirmingLarge, setConfirmingLarge] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!item) return null;

  const amount = Number(quantity);
  const validAmount = Number.isInteger(amount) && amount >= 1;
  const reserved = item.reservedStock ?? 0;
  const next = validAmount ? (direction === "IN" ? item.physicalStock + amount : item.physicalStock - amount) : item.physicalStock;
  const goesNegative = validAmount && direction === "OUT" && next < 0;
  const exceedsMax = validAmount && direction === "IN" && next > MAX_ITEM_UNITS;
  const reservedWithoutStock = validAmount && !goesNegative ? Math.max(0, reserved - next) : 0;
  const trimmedNote = note.trim();
  const noteMissing = reason === "otro" && !trimmedNote;
  const canSubmit = validAmount && reason !== "" && !goesNegative && !exceedsMax && !noteMissing && !isSubmitting;
  const variantLabel = formatVariantLabel(item.attributes);

  const reset = () => {
    setDirection("IN");
    setQuantity("");
    setReason("");
    setNote("");
    setConfirmingLarge(false);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!canSubmit || reason === "") return;
    setIsSubmitting(true);
    try {
      await adjustStock({
        inventoryItemId: item.inventoryItemId,
        direction,
        quantity: amount,
        reason,
        ...(trimmedNote ? { note: trimmedNote } : {}),
      });
      toast.success(`Stock de "${item.productName}" ajustado`);
      onSuccess?.();
      handleClose();
    } catch (error) {
      toast.error(trackingError(error, "No se pudo ajustar el stock."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = () => {
    if (needsQuantityConfirmation(amount) && !confirmingLarge) {
      setConfirmingLarge(true);
      return;
    }
    void submit();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-teal-600" />
            Ajustar stock
          </DialogTitle>
          <DialogDescription>
            {item.productName} · SKU {item.sku}
            {variantLabel ? ` · ${variantLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Físico actual</p>
              <p className="text-xl font-bold">{item.physicalStock}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Reservado</p>
              <p className="text-xl font-bold">{reserved}</p>
            </div>
          </div>

          <div className="flex gap-2" role="group" aria-label="Tipo de ajuste">
            {(["IN", "OUT"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={direction === value ? "default" : "outline"}
                aria-pressed={direction === value}
                className="flex-1"
                onClick={() => {
                  setDirection(value);
                  setConfirmingLarge(false);
                }}
              >
                {value === "IN" ? "Entrada" : "Salida"}
              </Button>
            ))}
          </div>

          <div className="space-y-1">
            <Label htmlFor="adjust-quantity">Cantidad</Label>
            <Input
              id="adjust-quantity"
              type="number"
              min={1}
              max={MAX_ITEM_UNITS}
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                setConfirmingLarge(false);
              }}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="adjust-reason">Motivo</Label>
            <select
              id="adjust-reason"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value as AdjustmentReason | "")}
            >
              <option value="">Elige un motivo</option>
              {(Object.keys(ADJUSTMENT_REASON_LABELS) as AdjustmentReason[]).map((key) => (
                <option key={key} value={key}>
                  {ADJUSTMENT_REASON_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="adjust-note">Nota {reason === "otro" ? "(obligatoria)" : "(opcional)"}</Label>
            <Textarea id="adjust-note" maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>

          {validAmount && !goesNegative && !exceedsMax ? (
            <p className="text-sm font-medium">El físico queda en {next}</p>
          ) : null}
          {goesNegative ? <p className="text-sm text-destructive">La salida deja el físico en negativo.</p> : null}
          {exceedsMax ? <p className="text-sm text-destructive">{MAX_ITEM_UNITS_MESSAGE}</p> : null}
          {reservedWithoutStock > 0 ? (
            <p className="text-sm text-amber-600">{reservedWithoutStock} unidades reservadas quedan sin stock</p>
          ) : null}
          {confirmingLarge ? (
            <div className="rounded-md border border-amber-300 p-3 text-sm">
              <p>{largeQuantityConfirmText(amount)}</p>
              <Button type="button" size="sm" className="mt-2" onClick={() => void submit()} disabled={isSubmitting}>
                Sí, confirmar
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
