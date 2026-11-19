"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { paymentText, todayInLima } from "@/lib/purchaseOrders";
import { setPurchaseOrderPayment, type PurchaseOrder } from "@/services/purchasesService";

// FEAT-24 H3-E — pago de la OC (solo Administrador): pagada con su fecha, o de
// vuelta a pendiente. «Por pagar» del proveedor sale de aquí.

interface Props {
  order: PurchaseOrder;
  onClose: () => void;
  onSaved: (order: PurchaseOrder) => void;
}

export default function PurchasePaymentDialog({ order, onClose, onSaved }: Props) {
  const paid = order.paymentStatus === "pagada";
  const [paidAt, setPaidAt] = useState(() => todayInLima());
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => setPurchaseOrderPayment(order.id, paid ? "pendiente" : "pagada", paid ? undefined : paidAt),
    onSuccess: (saved) => {
      toast.success(paid ? `${order.number} vuelve a pendiente de pago` : `${order.number} marcada como pagada`);
      onSaved(saved);
    },
    onError: (failure) => setError(warehouseErrorMessage(failure, "No se pudo guardar el pago. Inténtalo de nuevo.")),
  });
  const busy = save.isPending;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pago de {order.number}</DialogTitle>
          <DialogDescription>
            {order.supplierName ?? "Proveedor"} · {paymentText(order)}
          </DialogDescription>
        </DialogHeader>
        {paid ? (
          <p className="text-sm">¿La marcas otra vez como pendiente de pago? Vuelve a sumar en «Por pagar» del proveedor.</p>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="purchase-paid-at">Fecha de pago</Label>
            <Input id="purchase-paid-at" type="date" value={paidAt} disabled={busy} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy || (!paid && !paidAt)} onClick={() => save.mutate()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {paid ? "Marcar pendiente" : "Marcar pagada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
