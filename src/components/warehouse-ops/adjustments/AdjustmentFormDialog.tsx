"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
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
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { formatMoney, newOperationId } from "@/lib/purchaseOrders";
import {
  ADJUSTMENT_REASON_LABEL,
  ADJUSTMENT_REASONS,
  ADJUSTMENT_STATUS_LABEL,
  ADJUSTMENT_TYPE_LABEL,
  addDraftLines,
  adjustmentFormProblem,
  buildAdjustmentBody,
  emptyAdjustmentForm,
  opsErrorMessage,
  parseQuantity,
  type AdjustmentForm,
  type AdjustmentType,
} from "@/lib/warehouseOps";
import { getVariantCosts } from "@/services/purchasesService";
import { createAdjustment, type AdjustmentReasonCode, type StockAdjustmentDoc } from "@/services/warehouseOpsService";
import { ErrorBox, SELECT_CLASS } from "../OpsBits";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import VariantLinePicker from "../VariantLinePicker";

// FEAT-24 H5-C (H5-D4) — pedir un ajuste o una merma (mockup mAjuste): almacén
// (solo los que el usuario opera), tipo, motivo del catálogo de H5 y las líneas.
// Bajo el umbral de la empresa se aplica al guardar; sobre el umbral queda
// pendiente y el stock no se mueve hasta que el Administrador lo apruebe. Cada
// apertura tiene su `operationId`: reintentar no lo duplica.

const TYPES: AdjustmentType[] = ["merma", "negativo", "positivo"];

interface Props {
  companyId: string;
  canSeeCosts: boolean;
  onClose: () => void;
  onSaved: (adjustment: StockAdjustmentDoc) => void;
}

export default function AdjustmentFormDialog({ companyId, canSeeCosts, onClose, onSaved }: Props) {
  const scope = useMyWarehouses();
  const { warehouses, query: warehousesQuery } = useCompanyWarehouses();
  const [form, setForm] = useState<AdjustmentForm>(() => emptyAdjustmentForm());
  const [operationId] = useState(() => newOperationId());
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const options = useMemo(() => scope.operable(warehouses.filter((warehouse) => warehouse.status)), [scope, warehouses]);
  const variantIds = useMemo(() => [...new Set(form.lines.map((line) => line.variantId))].sort(), [form.lines]);
  const costsQuery = useQuery({
    queryKey: ["adjustment-costs", companyId, variantIds],
    queryFn: () => getVariantCosts(variantIds),
    enabled: canSeeCosts && variantIds.length > 0,
    staleTime: 60_000,
    retry: false,
  });
  const value = useMemo(() => {
    if (!canSeeCosts || !costsQuery.data) return null;
    const cost = new Map(costsQuery.data.map((row) => [row.variantId, row.averageCost]));
    return form.lines.reduce((sum, line) => sum + (parseQuantity(line.quantity, 0) ?? 0) * (cost.get(line.variantId) ?? 0), 0);
  }, [canSeeCosts, costsQuery.data, form.lines]);

  const problem = adjustmentFormProblem(form);
  const change = (patch: Partial<AdjustmentForm>) => {
    setServerError(null);
    setForm((current) => ({ ...current, ...patch }));
  };

  const save = useMutation({
    mutationFn: () => createAdjustment(buildAdjustmentBody(form, operationId)),
    onSuccess: ({ adjustment, duplicate }) => {
      if (duplicate) toast.info(`${adjustment.number} ya estaba registrado.`);
      else if (adjustment.status === "pendiente_aprobacion")
        toast.info(`${adjustment.number} enviado a aprobación`, { description: "El stock no se mueve hasta que el Administrador lo apruebe." });
      else toast.success(`${adjustment.number} · ${ADJUSTMENT_STATUS_LABEL[adjustment.status] ?? adjustment.status}`);
      onSaved(adjustment);
    },
    onError: (error) => setServerError(opsErrorMessage(error, "No se pudo registrar el ajuste. Inténtalo de nuevo.")),
  });
  const busy = save.isPending;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ajuste de stock o merma</DialogTitle>
          <DialogDescription>Siempre con motivo. Queda registrado con tu usuario.</DialogDescription>
        </DialogHeader>

        {warehousesQuery.isError ? <ErrorBox>{opsErrorMessage(warehousesQuery.error, "No se pudieron cargar los almacenes.")}</ErrorBox> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="aj-warehouse">Almacén</Label>
            <select id="aj-warehouse" className={SELECT_CLASS} value={form.inventoryId} disabled={busy} onChange={(event) => change({ inventoryId: event.target.value })}>
              <option value="">{warehousesQuery.isLoading || scope.isLoading ? "Cargando…" : "Elige el almacén"}</option>
              {options.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="aj-type">Tipo</Label>
            <select id="aj-type" className={SELECT_CLASS} value={form.type} disabled={busy} onChange={(event) => change({ type: event.target.value as AdjustmentType })}>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {ADJUSTMENT_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="aj-reason">Motivo</Label>
            <select
              id="aj-reason"
              className={SELECT_CLASS}
              value={form.reason}
              disabled={busy}
              onChange={(event) => change({ reason: event.target.value as AdjustmentReasonCode | "" })}
            >
              <option value="">Elige el motivo</option>
              {ADJUSTMENT_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {ADJUSTMENT_REASON_LABEL[reason]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 md:col-span-3">
            <Label htmlFor="aj-note">Nota {form.reason === "otro" ? "(obligatoria)" : "(opcional)"}</Label>
            <Textarea
              id="aj-note"
              rows={2}
              maxLength={300}
              placeholder="Ej. Envase roto al desempacar"
              value={form.note}
              disabled={busy}
              onChange={(event) => change({ note: event.target.value })}
            />
          </div>
        </div>

        <VariantLinePicker
          companyId={companyId}
          idPrefix="aj"
          initialQuantity="1"
          disabled={busy}
          onAdd={(lines) => {
            const next = addDraftLines(form.lines, lines);
            change({ lines: next.lines });
            return next.added;
          }}
        />

        {form.lines.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {form.lines.map((line) => (
              <li key={line.variantId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{line.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                </div>
                <Input
                  aria-label={`Cantidad: ${line.label}`}
                  className="w-24 text-right"
                  inputMode="numeric"
                  value={line.quantity}
                  disabled={busy}
                  onChange={(event) =>
                    change({ lines: form.lines.map((candidate) => (candidate.variantId === line.variantId ? { ...candidate, quantity: event.target.value } : candidate)) })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar ${line.label}`}
                  disabled={busy}
                  onClick={() => change({ lines: form.lines.filter((candidate) => candidate.variantId !== line.variantId) })}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Valor al costo</span>
          <span className="font-semibold tabular-nums">{canSeeCosts ? (value === null ? "—" : formatMoney(value)) : "••••"}</span>
        </div>

        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Si supera el umbral de aprobación de tu empresa, queda <b>pendiente de aprobación</b> y el stock no se mueve hasta que el Administrador lo apruebe.
            Una salida nunca deja el físico en negativo.
          </span>
        </div>

        {touched && problem ? <ErrorBox>{problem}</ErrorBox> : null}
        <ErrorBox>{serverError}</ErrorBox>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setTouched(true);
              if (problem) return;
              save.mutate();
            }}
          >
            {busy ? "Registrando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
