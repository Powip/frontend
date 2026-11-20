"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/orderStock";
import { markCourierReturn } from "@/services/orderStockService";

// FEAT-24 H2-F — «Devuelto por courier» reemplaza a «Reingresar a stock» y
// «Marcar merma»: el pedido se anula y la devolución queda por recibir en
// Inventario › Recepciones, donde se decide qué vuelve a stock y qué es merma.

export const RECEPTIONS_ROUTE = "/inventario/recepciones";

interface Props {
  order: { id: string; orderNumber: string } | null;
  onClose: () => void;
  onDone: () => void;
}

export function CourierReturnDialog({ order, onClose, onDone }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    setNote("");
    onClose();
  };

  const submit = async () => {
    if (!order) return;
    setSaving(true);
    try {
      await markCourierReturn(order.id, note);
      toast.success(`Pedido ${order.orderNumber} devuelto por courier`, {
        description: "La devolución queda por recibir en Inventario › Recepciones.",
        action: { label: "Ir a Recepciones", onClick: () => router.push(RECEPTIONS_ROUTE) },
      });
      setNote("");
      onDone();
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error, "No se pudo registrar la devolución."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devuelto por courier: {order?.orderNumber}</DialogTitle>
          <DialogDescription>
            El pedido se anula y la devolución queda <strong>por recibir</strong> en Inventario › Recepciones. Ahí se
            decide, producto por producto, qué vuelve a stock y qué es merma.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="courier-return-note">Nota (opcional)</Label>
          <Textarea
            id="courier-return-note"
            maxLength={500}
            value={note}
            placeholder="Ej.: el cliente no estaba, caja dañada"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={close}>
            Volver
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving ? "Registrando…" : "Registrar devolución"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
