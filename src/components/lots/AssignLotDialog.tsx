"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/components/compras/PurchaseBits";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { LOT_COMMENT_MAX, LOT_NUMBER_MAX, lotLabel, lotWriteErrorMessage, newLotProblem } from "@/lib/lots";
import { newOperationId } from "@/lib/purchaseOrders";
import { assignLot, type LotList } from "@/services/lotsService";

// FEAT-24 H5-L — «Registrar lote» (mockup `mLote`): para el stock que ya está en
// el almacén sin lote (lo nuevo se registra al recibir la compra). Pasa unidades
// de «sin lote» a un lote nuevo o a uno que ya existe, sin cambiar el físico.
// Cada apertura tiene su `operationId`: reintentar no lo duplica.

export interface AssignLotDefaults {
  variantId: string;
  inventoryId?: string;
}

interface Props {
  variants: Array<{ id: string; label: string }>;
  defaults: AssignLotDefaults;
  /** Lotes y «sin lote» ya leídos de cada variante (la pestaña Lotes). */
  lotsOf: (variantId: string) => LotList | undefined;
  onClose: () => void;
  onSaved: () => void;
}

export default function AssignLotDialog({ variants, defaults, lotsOf, onClose, onSaved }: Props) {
  const scope = useMyWarehouses();
  const { warehouses } = useCompanyWarehouses();
  const options = useMemo(() => scope.operable(warehouses.filter((warehouse) => warehouse.status)), [scope, warehouses]);
  const [variantId, setVariantId] = useState(defaults.variantId);
  const [inventoryId, setInventoryId] = useState(defaults.inventoryId ?? "");
  const [mode, setMode] = useState<"nuevo" | "existente">("nuevo");
  const [lotNumber, setLotNumber] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [comment, setComment] = useState("");
  const [lotId, setLotId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [operationId] = useState(() => newOperationId());
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = lotsOf(variantId);
  const unlotted = inventoryId ? list?.unlotted.find((row) => row.variantId === variantId && row.inventoryId === inventoryId)?.quantity ?? 0 : null;
  const existing = useMemo(() => {
    const seen = new Map<string, { lotId: string; number: string; expiresAt: string | null; kind: string }>();
    for (const lot of list?.items ?? []) if (lot.kind !== "devolucion" && !seen.has(lot.lotId)) seen.set(lot.lotId, lot);
    return [...seen.values()];
  }, [list]);

  const units = /^\d+$/.test(quantity.trim()) ? Number(quantity.trim()) : null;
  const problem = !inventoryId
    ? "Elige el almacén."
    : mode === "nuevo"
      ? newLotProblem({ lotNumber, expiresAt, comment })
      : !lotId
        ? "Elige el lote."
        : null;
  const quantityProblem =
    units === null || units < 1 || units > 10_000
      ? "Escribe las unidades: un entero entre 1 y 10.000."
      : unlotted !== null && units > unlotted
        ? `Solo hay ${Math.max(0, unlotted)} ${unlotted === 1 ? "unidad" : "unidades"} sin lote en ese almacén.`
        : null;
  const blocking = problem ?? quantityProblem;

  const save = useMutation({
    mutationFn: () =>
      assignLot({
        inventoryId,
        variantId,
        quantity: units ?? 0,
        ...(mode === "existente"
          ? { lotId }
          : { lotNumber: lotNumber.trim(), expiresAt, ...(comment.trim() ? { comment: comment.trim() } : {}) }),
        operationId,
      }),
    onSuccess: (result) => {
      if (result.duplicate) toast.info("Ese registro de lote ya estaba hecho.");
      else toast.success(`Lote ${result.lot?.number ?? lotNumber.trim()} registrado: ${units} ${units === 1 ? "unidad" : "unidades"}.`);
      onSaved();
    },
    onError: (failure) => setError(lotWriteErrorMessage(failure, "No se pudo registrar el lote. Inténtalo de nuevo.")),
  });
  const busy = save.isPending;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar lote</DialogTitle>
          <DialogDescription>Para stock que ya está en el almacén sin lote. Lo nuevo se registra al recibir la compra.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {variants.length > 1 ? (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="assign-lot-variant">Variante</Label>
              <select id="assign-lot-variant" className={SELECT_CLASS} value={variantId} disabled={busy} onChange={(event) => { setVariantId(event.target.value); setLotId(""); }}>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="assign-lot-warehouse">Almacén</Label>
            <select id="assign-lot-warehouse" className={SELECT_CLASS} value={inventoryId} disabled={busy} onChange={(event) => setInventoryId(event.target.value)}>
              <option value="">Elige el almacén</option>
              {options.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            {unlotted !== null ? (
              <p className="text-xs text-muted-foreground">
                Sin lote en este almacén: <b>{Math.max(0, unlotted)}</b> {unlotted === 1 ? "unidad" : "unidades"}.
              </p>
            ) : null}
          </div>

          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Lote</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="assign-lot-mode" checked={mode === "nuevo"} disabled={busy} onChange={() => setMode("nuevo")} />
                Lote nuevo
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="assign-lot-mode" checked={mode === "existente"} disabled={busy || existing.length === 0} onChange={() => setMode("existente")} />
                Lote que ya existe
              </label>
            </div>
          </fieldset>

          {mode === "nuevo" ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="assign-lot-number">Número de lote</Label>
                <Input id="assign-lot-number" className="font-mono" placeholder="Ej. L2410" maxLength={LOT_NUMBER_MAX} value={lotNumber} disabled={busy} onChange={(event) => setLotNumber(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="assign-lot-expires">Fecha de vencimiento</Label>
                <Input id="assign-lot-expires" type="date" value={expiresAt} disabled={busy} onChange={(event) => setExpiresAt(event.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="assign-lot-existing">Lote</Label>
              <select id="assign-lot-existing" className={SELECT_CLASS} value={lotId} disabled={busy} onChange={(event) => setLotId(event.target.value)}>
                <option value="">Elige el lote</option>
                {existing.map((lot) => (
                  <option key={lot.lotId} value={lot.lotId}>
                    {lotLabel(lot)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="assign-lot-quantity">Unidades</Label>
            <Input id="assign-lot-quantity" inputMode="numeric" value={quantity} disabled={busy} onChange={(event) => setQuantity(event.target.value)} />
          </div>
          {mode === "nuevo" ? (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="assign-lot-comment">Comentario (opcional)</Label>
              <Input id="assign-lot-comment" maxLength={LOT_COMMENT_MAX} placeholder="Ej. Lote con caja dañada, vender primero" value={comment} disabled={busy} onChange={(event) => setComment(event.target.value)} />
            </div>
          ) : null}
        </div>

        {(touched && blocking) || error ? (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-2 text-sm text-destructive">
            {error ?? blocking}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setTouched(true);
              setError(null);
              if (blocking) return;
              save.mutate();
            }}
          >
            {busy ? "Guardando…" : "Guardar lote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
