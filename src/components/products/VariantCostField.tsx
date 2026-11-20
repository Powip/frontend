"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { formatMoney, newOperationId, parseAmount } from "@/lib/purchaseOrders";
import { setVariantCosts } from "@/services/purchasesService";

// FEAT-24 H3-E (H3-D17) — costo promedio de una variante en la ficha del
// producto. Lo ven Administrador y Operaciones; solo el Administrador lo carga
// a mano (para las variantes sin costo inicial), de a una, con PUT
// /variant-costs. Las compras siguientes promedian desde ese costo.

interface Props {
  variantId: string;
  /** `undefined` = cargando; `null` = sin costo. */
  cost: number | null | undefined;
  canEdit: boolean;
  onSaved: (cost: number) => void;
}

export default function VariantCostField({ variantId, cost, canEdit, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Un operationId por envío; reintentar el mismo valor reusa el suyo (no duplica). */
  const [operation, setOperation] = useState<{ id: string; value: number } | null>(null);
  const parsed = parseAmount(value, 4);
  const inputId = `variant-cost-${variantId}`;

  const save = async () => {
    if (parsed === null) return;
    const operationId = operation && operation.value === parsed ? operation.id : newOperationId();
    setOperation({ id: operationId, value: parsed });
    setSaving(true);
    setError(null);
    try {
      const result = await setVariantCosts({ items: [{ variantId, averageCost: parsed }], reason: "Carga manual desde la ficha", operationId });
      onSaved(result.items[0]?.averageCost ?? parsed);
      toast.success("Costo promedio guardado");
      setEditing(false);
      setOperation(null);
    } catch (failure) {
      setError(warehouseErrorMessage(failure, "No se pudo guardar el costo. Inténtalo de nuevo."));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-1 rounded-md border bg-background p-2">
        <Label htmlFor={inputId} className="text-xs">
          Costo promedio sin IGV
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={inputId}
            inputMode="decimal"
            className="w-32"
            placeholder="0.00"
            value={value}
            disabled={saving}
            aria-invalid={value !== "" && parsed === null ? true : undefined}
            onChange={(e) => {
              setError(null);
              setValue(e.target.value);
            }}
          />
          <Button type="button" size="sm" disabled={parsed === null || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar costo
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
        {value !== "" && parsed === null ? <p className="text-xs text-destructive">Un número de 0 en adelante, con hasta 4 decimales.</p> : null}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid={`variant-cost-${variantId}`}>
      <span className="text-muted-foreground">Costo promedio:</span>
      <span className="font-medium tabular-nums">
        {cost === undefined ? "…" : cost === null ? "Sin costo" : formatMoney(cost, 4)}
      </span>
      {canEdit ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          aria-label="Cargar costo promedio"
          onClick={() => {
            setValue(cost !== null && cost !== undefined ? String(cost) : "");
            setEditing(true);
          }}
        >
          <Pencil className="mr-1 h-3 w-3" />
          {cost === null ? "Cargar costo" : "Cambiar"}
        </Button>
      ) : null}
    </div>
  );
}
