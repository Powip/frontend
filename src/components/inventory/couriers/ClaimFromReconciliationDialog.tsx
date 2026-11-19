"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OperationKeys } from "@/hooks/useOperationKeys";
import { claimableUnits } from "@/lib/courier";
import { lineLabel, opsErrorMessage, parseQuantity } from "@/lib/warehouseOps";
import { claimReconciliation, type ClaimReconciliationResult, type CourierReconciliation, type ReconciliationLine } from "@/services/sharedCourierService";
import { ErrorBox } from "../../warehouse-ops/OpsBits";

// FEAT-24 H8-D4 — reclamar al courier lo que la conciliación no explica (una
// línea o todo el faltante). Baja el físico con un ajuste negativo y crea el
// reclamo RCL. La clave de la acción es estable: si el envío queda sin
// respuesta y se reintenta, el servidor devuelve el mismo reclamo.

interface Props {
  reconciliation: CourierReconciliation;
  /** Sin línea: todo el faltante sin explicar de la conciliación. */
  line: ReconciliationLine | null;
  warehouseName: string;
  keys: OperationKeys;
  onClose: () => void;
  onClaimed: (result: ClaimReconciliationResult) => void;
}

export default function ClaimFromReconciliationDialog({ reconciliation, line, warehouseName, keys, onClose, onClaimed }: Props) {
  const max = line ? claimableUnits(line) : reconciliation.summary.shortageUnits;
  const [quantity, setQuantity] = useState(String(max));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = line ? parseQuantity(quantity, 1, max) : max;
  const invalid = parsed === null || parsed < 1;

  const confirm = async () => {
    if (invalid || busy) return;
    // La misma acción (misma línea y cantidad) reusa su clave hasta que se aplique.
    const scope = `claim:${reconciliation.id}:${line?.id ?? "todo"}:${parsed}`;
    setBusy(true);
    setError(null);
    try {
      const result = await claimReconciliation(reconciliation.id, {
        ...(line ? { lines: [{ lineId: line.id, quantity: parsed }] } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        operationId: keys.get(scope),
      });
      keys.release(scope);
      onClaimed(result);
    } catch (failure) {
      setError(opsErrorMessage(failure, "No se pudo crear el reclamo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{line ? "Reclamar al courier" : "Reclamar todo lo sin explicar"}</DialogTitle>
          <DialogDescription>
            {line ? `${lineLabel(line)}${line.sku ? ` (${line.sku})` : ""}: faltan ${max} und sin explicar.` : `${reconciliation.number}: faltan ${max} und sin explicar en total.`}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Se registra un ajuste negativo en {warehouseName} y un reclamo al courier por el costo promedio. Se cobra en la liquidación del courier.
        </p>
        {line ? (
          <div className="space-y-1">
            <Label htmlFor="claim-quantity">Unidades a reclamar</Label>
            <Input id="claim-quantity" inputMode="numeric" className="w-32" value={quantity} disabled={busy} onChange={(event) => setQuantity(event.target.value)} />
            {invalid ? <p className="text-xs text-destructive">Entre 1 y {max}.</p> : null}
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="claim-notes">Notas (opcional)</Label>
          <Textarea id="claim-notes" value={notes} maxLength={2000} disabled={busy} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <ErrorBox>{error}</ErrorBox>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Volver
          </Button>
          <Button type="button" variant="destructive" disabled={invalid || busy} onClick={() => void confirm()}>
            {busy ? "Guardando…" : "Crear reclamo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
