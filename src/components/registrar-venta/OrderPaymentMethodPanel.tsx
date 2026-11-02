"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  correctOrderPaymentMethod,
  getOrderPaymentMethods,
  orderMethodLabel,
  type CorrectOrderPaymentMethodInput,
  type OrderPaymentMethod,
} from "@/services/orderPaymentMethodService";

export function OrderPaymentMethodPanel({ orderId }: { orderId: string }) {
  const { auth } = useAuth();
  const scope = `${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}:${orderId}`;
  return <ScopedPanel key={scope} orderId={orderId} scope={scope} />;
}
function ScopedPanel({ orderId, scope }: { orderId: string; scope: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        Corregir método o ver historial
      </Button>
      {expanded && <PaymentMethods orderId={orderId} scope={scope} />}
    </div>
  );
}

function PaymentMethods({ orderId, scope }: { orderId: string; scope: string }) {
  const query = useQuery({
    queryKey: ["order-payment-methods", scope],
    queryFn: ({ signal }) => getOrderPaymentMethods(orderId, signal),
    retry: false,
  });
  const [editing, setEditing] = useState<OrderPaymentMethod | null>(null);

  return (
    <section
      className="space-y-3 rounded-xl border p-4"
      aria-label="Métodos de pago en este pedido"
    >
      <h3 className="font-semibold">Métodos de pago en este pedido</h3>
      <p className="text-xs text-muted-foreground">
        Una corrección se guarda en este pedido con su motivo. El método del recaudo y los importes
        registrados se conservan.
      </p>
      {query.isPending ? (
        <p role="status">Cargando métodos…</p>
      ) : query.isError ? (
        <div role="alert" className="text-sm">
          No se pudieron cargar los métodos.{" "}
          <Button type="button" variant="link" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {query.data.payments.length === 0 && (
            <p className="text-sm text-muted-foreground">Este pedido no tiene pagos registrados.</p>
          )}
          {query.data.payments.map((payment, index) => (
            <div key={payment.paymentId} className="space-y-2 border-t pt-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    Pago {index + 1} · {orderMethodLabel(payment.effectiveOrderMethod)}
                  </p>
                  <p>
                    {payment.currency} {Number(payment.amount).toFixed(2)} ·{" "}
                    {payment.status === "PAID"
                      ? "Aprobado"
                      : payment.status === "PENDING"
                        ? "Pendiente"
                        : payment.status}{" "}
                    · {new Date(payment.paymentDate).toLocaleDateString("es-PE")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Método registrado en recaudo: {orderMethodLabel(payment.recordedLedgerMethod)}
                  </p>
                </div>
                {query.data.canCorrect && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(payment)}
                  >
                    Corregir método del pago {index + 1}
                  </Button>
                )}
              </div>
              {payment.history.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs">
                    Historial de correcciones ({payment.history.length})
                  </summary>
                  <ol className="mt-2 space-y-2">
                    {payment.history.map((entry) => (
                      <li key={entry.id} className="rounded bg-muted/40 p-2 text-xs">
                        <p>
                          {orderMethodLabel(entry.previousMethod)} →{" "}
                          {orderMethodLabel(entry.newMethod)}
                        </p>
                        <p>{entry.reason}</p>
                        <p className="text-muted-foreground">
                          {entry.actorEmail ?? entry.actorId} ·{" "}
                          {new Date(entry.createdAt).toLocaleString("es-PE")}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          ))}
          {editing && (
            <CorrectionDialog
              key={`${editing.paymentId}:${editing.version}`}
              orderId={orderId}
              payment={editing}
              methods={query.data.allowedMethods}
              onClose={() => setEditing(null)}
              onSaved={() => query.refetch()}
            />
          )}
        </>
      )}
    </section>
  );
}

function CorrectionDialog({
  orderId,
  payment,
  methods,
  onClose,
  onSaved,
}: {
  orderId: string;
  payment: OrderPaymentMethod;
  methods: string[];
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const [method, setMethod] = useState(payment.effectiveOrderMethod);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const pending = useRef<CorrectOrderPaymentMethodInput | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const options = methods.filter(
    (item) => item !== "CONTRAENTREGA" || payment.effectiveOrderMethod === item,
  );
  const valid =
    methods.includes(method) &&
    method !== payment.effectiveOrderMethod &&
    reason.trim().length >= 3 &&
    reason.trim().length <= 500;

  async function submit() {
    if (!valid || busy || conflict) return;
    if (
      !pending.current ||
      pending.current.newMethod !== method ||
      pending.current.reason !== reason.trim()
    ) {
      pending.current = {
        newMethod: method,
        reason: reason.trim(),
        expectedVersion: payment.version,
        requestId: crypto.randomUUID(),
      };
    }
    setBusy(true);
    setError("");
    try {
      await correctOrderPaymentMethod(orderId, payment.paymentId, pending.current);
      if (!active.current) return;
      await onSaved();
      if (active.current) onClose();
    } catch (cause) {
      if (!active.current) return;
      if (axios.isAxiosError(cause) && cause.response?.status === 409) {
        setConflict(true);
        setError("Este pago cambió. Actualiza los métodos antes de volver a corregirlo.");
      } else setError("No se pudo guardar la corrección. Puedes reintentar sin duplicarla.");
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corregir método en este pedido</DialogTitle>
          <DialogDescription>
            Solo cambia el método mostrado en este pedido. El recaudo conserva{" "}
            {orderMethodLabel(payment.recordedLedgerMethod)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="correct-order-method">Método correcto</Label>
          <select
            id="correct-order-method"
            className="w-full rounded-md border bg-background p-2"
            value={method}
            disabled={busy || conflict}
            onChange={(e) => setMethod(e.target.value)}
          >
            {options.map((item) => (
              <option key={item} value={item}>
                {orderMethodLabel(item)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="correct-order-reason">Motivo de la corrección</Label>
          <Textarea
            id="correct-order-reason"
            value={reason}
            maxLength={500}
            disabled={busy || conflict}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          {conflict ? (
            <Button
              type="button"
              onClick={async () => {
                await onSaved();
                onClose();
              }}
            >
              Actualizar métodos
            </Button>
          ) : (
            <Button type="button" disabled={!valid || busy} onClick={() => void submit()}>
              {busy ? "Guardando…" : "Guardar corrección"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
