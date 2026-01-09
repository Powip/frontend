"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PackagePlus, Loader2 } from "lucide-react";

interface CreateGuideModalProps {
  open: boolean;
  onClose: () => void;
  selectedOrders: {
    id: string;
    orderNumber: string;
    clientName: string;
    address: string;
    district: string;
    total: number;
    pendingPayment: number;
  }[];
  storeId: string;
  onConfirm: (guideData: CreateGuideData) => Promise<void>;
  isLoading?: boolean;
}

export interface CreateGuideData {
  storeId: string;
  orderIds: string[];
  deliveryZone?: string;
  scheduledDate?: string;
  chargeType?: "PREPAGADO" | "CONTRA_ENTREGA" | "CORTESIA";
  amountToCollect?: number;
  notes?: string;
}

const CHARGE_TYPE_OPTIONS = [
  { value: "PREPAGADO", label: "Prepagado (ya pagó)" },
  { value: "CONTRA_ENTREGA", label: "Contra entrega" },
  { value: "CORTESIA", label: "Cortesía" },
];

export default function CreateGuideModal({
  open,
  onClose,
  selectedOrders,
  storeId,
  onConfirm,
  isLoading = false,
}: CreateGuideModalProps) {
  const [deliveryZone, setDeliveryZone] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [chargeType, setChargeType] = useState<"PREPAGADO" | "CONTRA_ENTREGA" | "CORTESIA">("CONTRA_ENTREGA");
  const [notes, setNotes] = useState("");

  // Calcular monto total a cobrar
  const totalToCollect = selectedOrders.reduce(
    (acc, order) => acc + order.pendingPayment,
    0
  );

  const handleSubmit = async () => {
    const guideData: CreateGuideData = {
      storeId,
      orderIds: selectedOrders.map((o) => o.id),
      deliveryZone: deliveryZone || undefined,
      scheduledDate: scheduledDate || undefined,
      chargeType,
      amountToCollect: chargeType === "CONTRA_ENTREGA" ? totalToCollect : undefined,
      notes: notes || undefined,
    };

    await onConfirm(guideData);
  };

  const handleClose = () => {
    setDeliveryZone("");
    setScheduledDate("");
    setChargeType("CONTRA_ENTREGA");
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Generar Guía de Envío
          </DialogTitle>
          <DialogDescription>
            Se creará una guía con {selectedOrders.length} pedido(s) seleccionado(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumen de pedidos */}
          <div className="border rounded-lg p-3 bg-muted/30">
            <h4 className="font-medium mb-2">Pedidos incluidos:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex justify-between items-center text-sm border-b pb-1 last:border-0"
                >
                  <div>
                    <span className="font-medium">{order.orderNumber}</span>
                    <span className="text-muted-foreground ml-2">
                      {order.clientName}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground text-xs">
                      {order.district}
                    </span>
                    {order.pendingPayment > 0 && (
                      <span className="ml-2 text-red-600">
                        S/{order.pendingPayment.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalToCollect > 0 && (
              <div className="mt-2 pt-2 border-t flex justify-between font-medium">
                <span>Total a cobrar:</span>
                <span className="text-red-600">S/{totalToCollect.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Zona de reparto */}
          <div className="space-y-2">
            <Label htmlFor="deliveryZone">Zona de reparto</Label>
            <Input
              id="deliveryZone"
              placeholder="Ej: Zona Norte, Miraflores, etc."
              value={deliveryZone}
              onChange={(e) => setDeliveryZone(e.target.value)}
            />
          </div>

          {/* Fecha programada */}
          <div className="space-y-2">
            <Label htmlFor="scheduledDate">Fecha de envío programada</Label>
            <Input
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          {/* Tipo de cobro */}
          <div className="space-y-2">
            <Label htmlFor="chargeType">Tipo de cobro</Label>
            <select
              id="chargeType"
              className="w-full border rounded-md px-3 py-2 bg-background text-foreground"
              value={chargeType}
              onChange={(e) =>
                setChargeType(e.target.value as typeof chargeType)
              }
            >
              {CHARGE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas adicionales</Label>
            <Textarea
              id="notes"
              placeholder="Instrucciones especiales, referencias, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || selectedOrders.length === 0}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <PackagePlus className="h-4 w-4 mr-2" />
                Generar Guía
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
