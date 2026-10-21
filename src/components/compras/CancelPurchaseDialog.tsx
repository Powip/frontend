"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { trackingError } from "@/services/inventoryTrackingService";

/** FEAT-24 H0 — anular una compra recibida exige motivo; si el backend la rechaza, el diálogo queda abierto con el motivo. */
export default function CancelPurchaseDialog({ open, purchaseNumber, onConfirm, onClose }: {
  open: boolean;
  purchaseNumber: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const trimmed = reason.trim();
  const valid = trimmed.length >= 5 && trimmed.length <= 500;

  const close = () => {
    if (saving) return;
    setReason("");
    setError("");
    onClose();
  };

  const confirm = async () => {
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      await onConfirm(trimmed);
      setReason("");
    } catch (failure) {
      setError(trackingError(failure, "No se pudo anular la compra."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anular compra {purchaseNumber}</DialogTitle>
          <DialogDescription>
            Se registran las salidas inversas y la compra queda anulada con su motivo. Si alguna variante ya no tiene stock suficiente, no se anula.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-purchase-reason">Motivo de la anulación</Label>
          <Textarea id="cancel-purchase-reason" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Por ejemplo: se cargó dos veces" />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>Cancelar</Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={!valid || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Anular compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
