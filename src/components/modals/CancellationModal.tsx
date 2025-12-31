"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

export type CancellationReason =
  | "CLIENT_REJECTED"
  | "NO_STOCK"
  | "DELIVERY_ISSUE"
  | "PAYMENT_ISSUE"
  | "OTHER";

const CANCELLATION_REASONS: { value: CancellationReason; label: string }[] = [
  { value: "CLIENT_REJECTED", label: "Cliente rechazó el pedido" },
  { value: "NO_STOCK", label: "Sin stock disponible" },
  { value: "DELIVERY_ISSUE", label: "Problema de entrega" },
  { value: "PAYMENT_ISSUE", label: "Problema de pago" },
  { value: "OTHER", label: "Otro motivo" },
];

interface CancellationModalProps {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  onConfirm: (reason: CancellationReason, notes?: string) => void;
  isLoading?: boolean;
}

export default function CancellationModal({
  open,
  onClose,
  orderNumber,
  onConfirm,
  isLoading = false,
}: CancellationModalProps) {
  const [selectedReason, setSelectedReason] = useState<CancellationReason | "">("");
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    if (!selectedReason) return;
    onConfirm(selectedReason, notes || undefined);
  };

  const handleClose = () => {
    setSelectedReason("");
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Anular Venta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
            <p className="font-medium">¿Está seguro de anular la venta #{orderNumber}?</p>
            <p className="mt-1 text-muted-foreground">
              Esta acción no se puede deshacer. Seleccione el motivo de la cancelación.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo de cancelación *</Label>
            <select
              id="reason"
              className="w-full h-10 border rounded-md px-3 bg-background text-foreground"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value as CancellationReason)}
            >
              <option value="">Seleccione un motivo...</option>
              {CANCELLATION_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observaciones (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agregue detalles adicionales..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason || isLoading}
          >
            {isLoading ? "Procesando..." : "Confirmar Anulación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
