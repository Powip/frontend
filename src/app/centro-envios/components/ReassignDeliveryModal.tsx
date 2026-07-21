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
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Repeat,
  CalendarClock,
  Ban,
  ArrowRight,
  Package,
} from "lucide-react";
import { OrderHeader } from "@/interfaces/IOrder";
import type { CancellationReason } from "@/components/modals/CancellationModal";
import { cn } from "@/lib/utils";

const CANCELLATION_REASONS: { value: CancellationReason; label: string }[] = [
  { value: "CLIENT_REJECTED", label: "Cliente rechazó el pedido" },
  { value: "DELIVERY_ISSUE", label: "Cliente no recogió / entrega fallida" },
  { value: "NO_STOCK", label: "Sin stock disponible" },
  { value: "PAYMENT_ISSUE", label: "Problema de pago" },
  { value: "OTHER", label: "Otro motivo" },
];

type Step = "choose" | "reprogram" | "cancel" | "candidates";

// "Reasignar a otro cliente" no tiene un endpoint dedicado en el backend:
// hoy se simula con 2 PATCH de orden + comentarios, sin transacción ni
// auditoría real. Se oculta de la UI hasta que exista soporte real.
// Reprogramar y Anular sí usan flujos ya soportados (callStatus/callbackAt
// y cancellationReason, iguales a los de /operaciones).
const REASSIGN_TO_CUSTOMER_ENABLED = false;

interface ReassignDeliveryModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderHeader | null;
  candidates: OrderHeader[];
  isLoading?: boolean;
  onReprogram: (orderId: string, callbackAt: Date) => Promise<void> | void;
  onCancelOrder: (
    orderId: string,
    reason: CancellationReason,
    notes?: string,
  ) => Promise<void> | void;
  onReassign: (
    failedOrder: OrderHeader,
    candidate: OrderHeader,
  ) => Promise<void> | void;
}

function defaultCallbackDatetimeLocal(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReassignDeliveryModal({
  open,
  onClose,
  order,
  candidates,
  isLoading = false,
  onReprogram,
  onCancelOrder,
  onReassign,
}: ReassignDeliveryModalProps) {
  const [step, setStep] = useState<Step>("choose");
  const [callbackValue, setCallbackValue] = useState(
    defaultCallbackDatetimeLocal(),
  );
  const [reason, setReason] = useState<CancellationReason | "">("");
  const [notes, setNotes] = useState("");

  const handleClose = () => {
    setStep("choose");
    setCallbackValue(defaultCallbackDatetimeLocal());
    setReason("");
    setNotes("");
    onClose();
  };

  if (!order) return null;

  const pendingPayment = Math.max(
    Number(order.grandTotal) -
      order.payments
        .filter((p) => p.status === "PAID")
        .reduce((acc, p) => acc + Number(p.amount || 0), 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Pedido fallido · {order.orderNumber}
          </DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600 flex-shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <b>{order.customer.fullName}</b> no recogió / no recibió el
                pedido en {order.customer.district}. Elige cómo continuar.
              </div>
            </div>
            <div
              className={cn(
                "grid grid-cols-1 gap-3",
                REASSIGN_TO_CUSTOMER_ENABLED ? "sm:grid-cols-3" : "sm:grid-cols-2",
              )}
            >
              {REASSIGN_TO_CUSTOMER_ENABLED && (
                <button
                  type="button"
                  onClick={() => setStep("candidates")}
                  className="flex flex-col items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 p-4 text-center hover:bg-primary/10 transition-colors"
                >
                  <Repeat className="h-6 w-6 text-primary" />
                  <span className="text-sm font-semibold">Reasignar</span>
                  <span className="text-xs text-muted-foreground">
                    a otro cliente, misma zona/producto
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep("reprogram")}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center hover:border-primary/50 hover:bg-muted transition-colors"
              >
                <CalendarClock className="h-6 w-6" />
                <span className="text-sm font-semibold">Reprogramar</span>
                <span className="text-xs text-muted-foreground">
                  nuevo intento de entrega
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStep("cancel")}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              >
                <Ban className="h-6 w-6 text-red-600" />
                <span className="text-sm font-semibold">Anular</span>
                <span className="text-xs text-muted-foreground">
                  devuelve stock al almacén
                </span>
              </button>
            </div>
          </div>
        )}

        {step === "reprogram" && (
          <div className="space-y-3.5">
            <Label htmlFor="callback-at" className="text-sm">
              Fecha y hora del nuevo intento
            </Label>
            <Input
              id="callback-at"
              type="datetime-local"
              value={callbackValue}
              onChange={(e) => setCallbackValue(e.target.value)}
              className="h-10 text-sm"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("choose")}>
                Volver
              </Button>
              <Button
                disabled={isLoading}
                onClick={async () => {
                  await onReprogram(order.id, new Date(callbackValue));
                  handleClose();
                }}
              >
                Reprogramar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "cancel" && (
          <div className="space-y-3.5">
            <Label className="text-sm">Motivo de anulación</Label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as CancellationReason)}
              className="w-full border rounded-md px-3 py-2.5 text-sm bg-background"
            >
              <option value="">Selecciona un motivo</option>
              {CANCELLATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <Textarea
              placeholder="Notas adicionales (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("choose")}>
                Volver
              </Button>
              <Button
                variant="destructive"
                disabled={!reason || isLoading}
                onClick={async () => {
                  if (!reason) return;
                  await onCancelOrder(order.id, reason, notes || undefined);
                  handleClose();
                }}
              >
                Anular pedido
              </Button>
            </DialogFooter>
          </div>
        )}

        {REASSIGN_TO_CUSTOMER_ENABLED && step === "candidates" && (
          <div className="space-y-3.5">
            <p className="text-sm text-muted-foreground">
              Pedidos preparados con producto en común en{" "}
              <b>{order.customer.district}</b>:
            </p>
            {candidates.length === 0 ? (
              <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
                No hay candidatos preparados en la misma zona con productos en
                común.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {candidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {c.customer.fullName} · {c.orderNumber}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.customer.district} ·{" "}
                        {c.items[0]?.productName ?? "—"}
                        {c.items.length > 1 ? ` +${c.items.length - 1}` : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={isLoading}
                      onClick={async () => {
                        await onReassign(order, c);
                        handleClose();
                      }}
                    >
                      Reasignar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {order.guideNumber && (
              <div className="text-xs rounded-md bg-muted p-2.5">
                Se reutiliza la guía <b>{order.guideNumber}</b>
                {order.courier ? ` (${order.courier})` : ""} y el saldo
                pendiente por cobrar es{" "}
                <b>S/{pendingPayment.toFixed(2)}</b>.
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("choose")}>
                Volver
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
