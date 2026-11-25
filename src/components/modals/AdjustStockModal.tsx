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
import {
  STRICT_NEGATIVE_MESSAGE,
  formatSignedStock,
  isNegativeStockConfirmError,
  negativeConfirmLabel,
  negativeStockConfirmMessage,
} from "@/lib/stockControl";
import { useStockControl } from "@/hooks/useStockControl";
import { trackingError } from "@/services/inventoryTrackingService";
import { ADJUSTMENT_REASON_LABELS, adjustStock, type AdjustmentReason } from "@/services/stockAdjustmentService";
import NegativeStockConfirm from "@/components/inventory/NegativeStockConfirm";

interface Props {
  open: boolean;
  item: InventoryItemForSale | null;
  onClose: () => void;
  onSuccess?: () => void;
}

/** «Entrada», «Salida» o «Fijar en» (FEAT-24 C-D6: se escribe la cantidad real y el modal calcula el movimiento). */
type AdjustMode = "IN" | "OUT" | "SET";

const MODE_LABEL: Record<AdjustMode, string> = { IN: "Entrada", OUT: "Salida", SET: "Fijar en" };

/**
 * FEAT-24 H0 — ajuste de stock en más o en menos, con motivo obligatorio. No muestra el costo.
 * FEAT-24 C-D3/C-D6 — suma «Fijar en» y, con control de stock flexible, una salida puede dejar el físico en negativo
 * si se confirma con la casilla (se manda `allowNegative`); en estricto, se bloquea como antes.
 */
export default function AdjustStockModal({ open, item, onClose, onSuccess }: Props) {
  const stockControl = useStockControl();
  const [mode, setMode] = useState<AdjustMode>("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<AdjustmentReason | "">("");
  const [note, setNote] = useState("");
  const [confirmingLarge, setConfirmingLarge] = useState(false);
  const [negativeConfirmed, setNegativeConfirmed] = useState(false);
  // Mensaje del 409 `STOCK_NEGATIVO_CONFIRMAR`: el servidor pide la confirmación aunque la pantalla no lo previera.
  const [serverConfirm, setServerConfirm] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!item) return null;

  const physical = item.physicalStock;
  const reserved = item.reservedStock ?? 0;
  const typed = Number(quantity);
  const isInteger = quantity.trim() !== "" && Number.isInteger(typed);
  // «Fijar en»: la cantidad real (0..10.000) define el sentido y la cantidad del movimiento.
  const target = mode === "SET" && isInteger && typed >= 0 ? typed : null;
  const targetTooBig = target !== null && target > MAX_ITEM_UNITS;
  const unchanged = target !== null && target === physical;
  const targetInvalid = mode === "SET" && quantity.trim() !== "" && target === null;
  const direction: "IN" | "OUT" = mode === "SET" ? (target !== null && target < physical ? "OUT" : "IN") : mode;
  const amount = mode === "SET" ? (target !== null ? Math.abs(target - physical) : 0) : typed;
  const validAmount = mode === "SET" ? target !== null && !targetTooBig && !unchanged : isInteger && typed >= 1;
  const next = validAmount ? (direction === "IN" ? physical + amount : physical - amount) : physical;
  const goesNegative = validAmount && direction === "OUT" && next < 0;
  const strictBlocked = goesNegative && stockControl === "estricto" && !serverConfirm;
  const needsNegativeConfirm = (goesNegative && !strictBlocked) || serverConfirm !== null;
  const exceedsMax = targetTooBig || (validAmount && direction === "IN" && next > MAX_ITEM_UNITS);
  const reservedWithoutStock = validAmount && !strictBlocked ? Math.max(0, reserved - Math.max(next, 0)) : 0;
  const trimmedNote = note.trim();
  const noteMissing = reason === "otro" && !trimmedNote;
  const canSubmit =
    validAmount &&
    reason !== "" &&
    !strictBlocked &&
    !(needsNegativeConfirm && !negativeConfirmed) &&
    !exceedsMax &&
    !noteMissing &&
    !isSubmitting;
  const variantLabel = formatVariantLabel(item.attributes);

  // Cambiar el sentido o la cantidad cambia lo que se confirma: se vuelve a pedir.
  const resetConfirmations = () => {
    setConfirmingLarge(false);
    setNegativeConfirmed(false);
    setServerConfirm(null);
  };
  const reset = () => {
    setMode("IN");
    setQuantity("");
    setReason("");
    setNote("");
    resetConfirmations();
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await adjustStock({
        inventoryItemId: item.inventoryItemId,
        direction,
        quantity: amount,
        reason,
        ...(trimmedNote ? { note: trimmedNote } : {}),
        ...(needsNegativeConfirm && negativeConfirmed ? { allowNegative: true as const } : {}),
      });
      toast.success(`Stock de "${item.productName}" ajustado`);
      onSuccess?.();
      handleClose();
    } catch (error) {
      if (isNegativeStockConfirmError(error)) {
        setConfirmingLarge(false);
        setNegativeConfirmed(false);
        setServerConfirm(negativeStockConfirmMessage(error));
      } else {
        toast.error(trackingError(error, "No se pudo ajustar el stock."));
      }
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
              <p className="text-xl font-bold">{physical}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Reservado</p>
              <p className="text-xl font-bold">{reserved}</p>
            </div>
          </div>

          <div className="flex gap-2" role="group" aria-label="Tipo de ajuste">
            {(["IN", "OUT", "SET"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={mode === value ? "default" : "outline"}
                aria-pressed={mode === value}
                className="flex-1"
                onClick={() => {
                  setMode(value);
                  resetConfirmations();
                }}
              >
                {MODE_LABEL[value]}
              </Button>
            ))}
          </div>

          <div className="space-y-1">
            <Label htmlFor="adjust-quantity">{mode === "SET" ? "Cantidad real" : "Cantidad"}</Label>
            <Input
              id="adjust-quantity"
              type="number"
              min={mode === "SET" ? 0 : 1}
              max={MAX_ITEM_UNITS}
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                resetConfirmations();
              }}
            />
            {mode === "SET" ? (
              <p className="text-xs text-muted-foreground">Escribe cuántas unidades hay de verdad (de 0 a 10,000): se registra la diferencia.</p>
            ) : null}
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

          {mode === "SET" && validAmount ? (
            <p className="text-sm font-medium">{direction === "IN" ? `Entrada de ${amount}` : `Salida de ${amount}`}</p>
          ) : null}
          {targetInvalid ? <p className="text-sm text-destructive">Escribe un número entero de 0 a 10,000.</p> : null}
          {unchanged ? (
            <p className="text-sm text-muted-foreground">El físico ya está en {physical}: no hay nada que ajustar.</p>
          ) : null}
          {validAmount && !strictBlocked && !exceedsMax ? (
            <p className={`text-sm font-medium ${next < 0 ? "text-destructive" : ""}`}>El físico queda en {formatSignedStock(next)}</p>
          ) : null}
          {strictBlocked ? <p className="text-sm text-destructive">{STRICT_NEGATIVE_MESSAGE}</p> : null}
          {exceedsMax ? <p className="text-sm text-destructive">{MAX_ITEM_UNITS_MESSAGE}</p> : null}
          {reservedWithoutStock > 0 ? (
            <p className="text-sm text-amber-600">{reservedWithoutStock} unidades reservadas quedan sin stock</p>
          ) : null}
          {needsNegativeConfirm && validAmount ? (
            <NegativeStockConfirm
              id="adjust-allow-negative"
              message={serverConfirm ?? "La salida deja el físico en negativo."}
              label={negativeConfirmLabel(goesNegative ? next : null)}
              checked={negativeConfirmed}
              disabled={isSubmitting}
              onCheckedChange={setNegativeConfirmed}
            />
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
