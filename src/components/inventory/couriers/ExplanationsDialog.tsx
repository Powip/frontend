"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EXPLANATION_LABEL, MANUAL_EXPLANATION_TYPES, signed } from "@/lib/courier";
import { lineLabel, opsErrorMessage, parseQuantity } from "@/lib/warehouseOps";
import {
  setLineExplanations,
  type CourierReconciliation,
  type ManualExplanationType,
  type ReconciliationLine,
} from "@/services/sharedCourierService";
import { ErrorBox, SELECT_CLASS } from "../../warehouse-ops/OpsBits";

// FEAT-24 H8-D3 — explicaciones manuales de una línea de la conciliación: lo
// que el courier despachó sin pedido en POWIP y las mermas que reportó. Las
// dos explican que el courier tenga MENOS. Guardar REEMPLAZA las manuales.

interface Row {
  type: ManualExplanationType;
  quantity: string;
  reference: string;
  note: string;
}

const MAX_ROWS = 20;

export default function ExplanationsDialog({
  reconciliation,
  line,
  onClose,
  onSaved,
}: {
  reconciliation: CourierReconciliation;
  line: ReconciliationLine;
  onClose: () => void;
  onSaved: (saved: CourierReconciliation) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    line.explanations
      .filter((explanation) => explanation.source === "manual")
      .map((explanation) => ({
        type: (MANUAL_EXPLANATION_TYPES as readonly string[]).includes(explanation.type) ? (explanation.type as ManualExplanationType) : "despacho_sin_pedido",
        quantity: String(Math.abs(explanation.quantity)),
        reference: explanation.reference ?? "",
        note: explanation.note ?? "",
      })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = rows.some((row) => parseQuantity(row.quantity, 1, 10_000) === null) ? "Cada explicación lleva una cantidad entre 1 y 10.000." : null;

  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const save = async () => {
    if (problem || busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await setLineExplanations(
        reconciliation.id,
        line.id,
        rows.map((row) => ({
          type: row.type,
          quantity: Number(row.quantity),
          ...(row.reference.trim() ? { reference: row.reference.trim() } : {}),
          ...(row.note.trim() ? { note: row.note.trim() } : {}),
        })),
      );
      onSaved(saved);
    } catch (failure) {
      setError(opsErrorMessage(failure, "No se pudieron guardar las explicaciones."));
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Explicar la diferencia</DialogTitle>
          <DialogDescription>
            {lineLabel(line)}
            {line.sku ? ` (${line.sku})` : ""}: POWIP {line.powip}, courier {line.courier}, diferencia {signed(line.difference)}.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Despachos que hizo el courier sin pedido en POWIP o mermas que reportó: explican que el courier tenga menos. Lo que no se explica se puede reclamar.
        </p>
        {rows.length === 0 ? <p className="rounded-md border border-dashed py-3 text-center text-sm text-muted-foreground">Sin explicaciones manuales.</p> : null}
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={index} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1.3fr_0.6fr_1fr_1.4fr_auto]">
              <select aria-label={`Tipo ${index + 1}`} className={SELECT_CLASS} value={row.type} disabled={busy} onChange={(event) => update(index, { type: event.target.value as ManualExplanationType })}>
                {MANUAL_EXPLANATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EXPLANATION_LABEL[type][0].toUpperCase() + EXPLANATION_LABEL[type].slice(1)}
                  </option>
                ))}
              </select>
              <Input aria-label={`Cantidad ${index + 1}`} inputMode="numeric" value={row.quantity} disabled={busy} onChange={(event) => update(index, { quantity: event.target.value })} />
              <Input aria-label={`Referencia ${index + 1}`} placeholder="Guía o pedido" maxLength={100} value={row.reference} disabled={busy} onChange={(event) => update(index, { reference: event.target.value })} />
              <Input aria-label={`Nota ${index + 1}`} placeholder="Nota (opcional)" maxLength={300} value={row.note} disabled={busy} onChange={(event) => update(index, { note: event.target.value })} />
              <Button type="button" size="icon" variant="ghost" aria-label={`Quitar explicación ${index + 1}`} disabled={busy} onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={busy || rows.length >= MAX_ROWS}
          onClick={() => setRows((current) => [...current, { type: "despacho_sin_pedido", quantity: String(line.unexplained < 0 ? -line.unexplained : 1), reference: "", note: "" }])}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Agregar explicación
        </Button>
        <ErrorBox>{problem ?? error}</ErrorBox>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Volver
          </Button>
          <Button type="button" disabled={!!problem || busy} onClick={() => void save()}>
            {busy ? "Guardando…" : "Guardar explicaciones"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
