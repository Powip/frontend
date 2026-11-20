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
import { Textarea } from "@/components/ui/textarea";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { lineLabel, returnableQuantity } from "@/lib/purchaseOrders";
import { createSupplierReturn, type PurchaseOrder, type SupplierReturn } from "@/services/purchasesService";

// FEAT-24 H3-E — devolución a proveedor desde una compra recibida (mockup
// mDevProv): por línea, cuántas unidades vuelven (hasta lo recibido sin
// devolver) y el motivo. Queda en borrador: el stock sale recién al enviarla.

interface Props {
  order: PurchaseOrder;
  onClose: () => void;
  onCreated: (created: SupplierReturn) => void;
}

export default function SupplierReturnFormDialog({ order, onClose, onCreated }: Props) {
  const lines = order.lines.filter((line) => returnableQuantity(line) > 0);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = lines.map((line) => {
    const raw = (quantities[line.id] ?? "").trim();
    const max = returnableQuantity(line);
    const quantity = raw === "" ? 0 : /^\d+$/.test(raw) ? Number(raw) : NaN;
    const problem = Number.isNaN(quantity)
      ? "Escribe un número entero."
      : quantity > max
        ? `Puedes devolver hasta ${max}.`
        : null;
    return { line, quantity: Number.isNaN(quantity) ? 0 : quantity, max, problem };
  });
  const chosen = parsed.filter((item) => item.quantity > 0);
  const valid = chosen.length > 0 && parsed.every((item) => !item.problem) && reason.trim().length <= 500;

  const save = useMutation({
    mutationFn: () =>
      createSupplierReturn({
        purchaseOrderId: order.id,
        reason: reason.trim() || null,
        lines: chosen.map((item) => ({ itemId: item.line.id, quantity: item.quantity })),
      }),
    onSuccess: (created) => {
      toast.success(`${created.number} creada como borrador`, { description: "El stock sale cuando la marques como enviada." });
      onCreated(created);
    },
    onError: (failure) => setError(warehouseErrorMessage(failure, "No se pudo crear la devolución. Inténtalo de nuevo.")),
  });
  const busy = save.isPending;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Devolver al proveedor · {order.number}</DialogTitle>
          <DialogDescription>
            {order.supplierName ?? "Proveedor"}: elige qué vuelve. Queda en borrador hasta enviarla; luego espera la nota de crédito.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2" aria-label="Productos a devolver">
          {parsed.map(({ line, max, problem }) => (
            <li key={line.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{lineLabel(line)}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{line.sku}</span> · recibido {line.receivedQuantity} · ya devuelto {line.returnedQuantity}
                </p>
                {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
              </div>
              <Input
                aria-label={`Devolver: ${lineLabel(line)}`}
                className="w-24 text-right"
                inputMode="numeric"
                placeholder={`0–${max}`}
                value={quantities[line.id] ?? ""}
                disabled={busy}
                onChange={(e) => {
                  setError(null);
                  setQuantities((current) => ({ ...current, [line.id]: e.target.value }));
                }}
              />
            </li>
          ))}
        </ul>

        <div className="space-y-1">
          <Label htmlFor="supplier-return-reason">Motivo</Label>
          <Textarea
            id="supplier-return-reason"
            maxLength={500}
            placeholder="Por ejemplo: costuras abiertas"
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={!valid || busy} onClick={() => save.mutate()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Crear devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
