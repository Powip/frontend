"use client";

import { useRef, useState } from "react";
import { ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { VariantSearchPicker, searchResultLabel } from "@/components/variant-search/VariantSearchPicker";
import { createOrderExchange, type OrderExchange } from "@/services/orderExchangeService";
import { classifyExchangeError, newExchangeKey, type ExchangeableLine } from "@/lib/orderExchange";
import { variantLabel } from "@/lib/packs/packMath";

const MAX_REASON = 255;

/**
 * FEAT-24 H12 (H12-D2) — «Cambiar producto»: la línea, el producto nuevo, cuántas unidades y el motivo.
 * Cada intento lleva una clave de idempotencia: si no hubo respuesta (o quedó pendiente) se reintenta con
 * la misma clave y los datos quedan fijos; si el servidor lo rechazó (409 y otros 4xx), se muestra su
 * mensaje y el próximo intento usa una clave nueva.
 */
export function ExchangeProductDialog({
  orderId,
  orderNumber,
  lines,
  onClose,
  onDone,
  onOpenOrder,
}: {
  orderId: string;
  orderNumber: string;
  lines: ExchangeableLine[];
  onClose: () => void;
  onDone: (exchange: OrderExchange) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const [itemId, setItemId] = useState(lines.length === 1 ? lines[0].itemId : "");
  const [newVariant, setNewVariant] = useState<{ id: string; label: string } | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<OrderExchange | null>(null);
  const keyRef = useRef(newExchangeKey());
  const line = lines.find((candidate) => candidate.itemId === itemId);
  const locked = uncertain || saving;

  const submit = async () => {
    const qty = Number(quantity);
    if (!line) return setError("Elige el producto que se cambia.");
    if (!newVariant) return setError("Elige el producto nuevo.");
    if (!Number.isInteger(qty) || qty < 1 || qty > line.remaining) return setError(`La cantidad va de 1 a ${line.remaining}.`);
    setError("");
    setSaving(true);
    try {
      const exchange = await createOrderExchange(
        orderId,
        { lines: [{ itemId: line.itemId, newVariantId: newVariant.id, quantity: qty }], ...(reason.trim() ? { reason: reason.trim() } : {}) },
        keyRef.current,
      );
      setUncertain(false);
      setResult(exchange);
      onDone(exchange);
    } catch (cause) {
      const failure = classifyExchangeError(cause);
      setError(failure.message);
      if (failure.kind === "rejected") {
        keyRef.current = newExchangeKey();
        setUncertain(false);
      } else {
        setUncertain(true);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cambiar producto · {orderNumber}</DialogTitle>
          <DialogDescription>
            Lo que el cliente devuelve queda por recibir en Recepciones y se crea un pedido de cambio con el producto nuevo. Si el nuevo cuesta más, ese pedido cobra la diferencia.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div role="status" className="space-y-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {result.status === "aplicado" ? "Cambio registrado" : "Cambio registrado: se está terminando con inventario"}
            </p>
            {result.childOrderId ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenOrder(result.childOrderId as string)}>
                Ver pedido de cambio{result.childOrderNumber ? ` ${result.childOrderNumber}` : ""}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <fieldset className="space-y-2" disabled={locked}>
              <legend className="text-sm font-medium">Producto que se cambia</legend>
              {lines.map((candidate) => (
                <label key={candidate.itemId} className={cn("flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm", itemId === candidate.itemId && "border-primary bg-primary/5")}>
                  <input
                    type="radio"
                    name="exchange-line"
                    className="mt-1"
                    checked={itemId === candidate.itemId}
                    onChange={() => { setItemId(candidate.itemId); setQuantity("1"); setNewVariant(null); }}
                  />
                  <span>
                    <span className="block font-medium">{variantLabel(candidate.productName, candidate.attributes)}</span>
                    <span className="block text-xs text-muted-foreground">{candidate.sku} · se pueden cambiar {candidate.remaining}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {line ? (
              <>
                <div className="space-y-1">
                  {newVariant ? <p className="flex items-center gap-1.5 text-sm"><ArrowRightLeft className="h-4 w-4" aria-hidden="true" />Producto nuevo: <b>{newVariant.label}</b></p> : null}
                  <VariantSearchPicker
                    label="Producto nuevo"
                    excludeIds={[line.variantId]}
                    disabled={locked}
                    onSelect={(picked) => setNewVariant({ id: picked.variant_id, label: searchResultLabel(picked) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exchange-qty">Unidades</Label>
                  <Input id="exchange-qty" type="number" min={1} max={line.remaining} value={quantity} disabled={locked} onChange={(event) => setQuantity(event.target.value)} className="w-28" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exchange-reason">Motivo <span className="text-muted-foreground">(opcional)</span></Label>
                  <Textarea id="exchange-reason" value={reason} maxLength={MAX_REASON} disabled={locked} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: talla equivocada" rows={2} />
                </div>
              </>
            ) : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        <DialogFooter>
          {result ? (
            <Button type="button" onClick={onClose}>Cerrar</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button type="button" onClick={() => void submit()} disabled={saving || !line}>
                {saving ? "Registrando…" : uncertain ? "Reintentar" : "Registrar cambio"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
