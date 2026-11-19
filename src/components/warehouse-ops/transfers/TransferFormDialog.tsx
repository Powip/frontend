"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Truck, X } from "lucide-react";
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
import { useLotTrackedVariants } from "@/hooks/useLotTrackedVariants";
import { newOperationId } from "@/lib/purchaseOrders";
import LotSelect from "@/components/lots/LotSelect";
import {
  addDraftLines,
  buildTransferBody,
  clearDraftLots,
  emptyTransferForm,
  opsErrorMessage,
  parseQuantity,
  transferFormFrom,
  transferFormProblem,
  type TransferForm,
} from "@/lib/warehouseOps";
import { getStockByVariants } from "@/services/inventoryItems.service";
import { createTransfer, dispatchTransfer, updateTransfer, type Transfer } from "@/services/warehouseOpsService";
import { ErrorBox, SELECT_CLASS } from "../OpsBits";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import VariantLinePicker from "../VariantLinePicker";

// FEAT-24 H5-C — nuevo traslado o edición de un borrador (mockup mTraslado):
// origen (solo los almacenes que el usuario opera), destino, flete (gasto
// logístico, no va al costo), guía de remisión y la grilla de variantes con el
// disponible en el origen y el saldo que queda. «Despachar ahora» guarda y
// despacha: el stock sale del origen y queda «en camino».

/** Se guardó el borrador pero no se pudo despachar: el reintento usa el mismo borrador y la misma clave. */
class NotDispatchedError extends Error {
  constructor(
    readonly transfer: Transfer,
    readonly failure: unknown,
  ) {
    super("No se pudo despachar el traslado");
  }
}

interface Props {
  companyId: string;
  transfer?: Transfer | null;
  defaultOriginId?: string;
  onClose: () => void;
  onSaved: (transfer: Transfer, dispatched: boolean) => void;
}

export default function TransferFormDialog({ companyId, transfer, defaultOriginId, onClose, onSaved }: Props) {
  const scope = useMyWarehouses();
  const { warehouses, query: warehousesQuery } = useCompanyWarehouses();
  const [form, setForm] = useState<TransferForm>(() => (transfer ? transferFormFrom(transfer) : emptyTransferForm(defaultOriginId ?? "")));
  const [savedId, setSavedId] = useState<string | null>(transfer?.id ?? null);
  const [dispatchKey] = useState(() => newOperationId());
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const active = useMemo(() => warehouses.filter((warehouse) => warehouse.status || warehouse.id === transfer?.originInventoryId), [warehouses, transfer]);
  const origins = useMemo(() => scope.operable(active), [scope, active]);
  // Destino: cualquier almacén activo de la empresa (se envía a él; recibirlo lo hace quien lo opera).
  const destinations = useMemo(() => active.filter((warehouse) => warehouse.id !== form.originInventoryId), [active, form.originInventoryId]);

  const variantIds = useMemo(() => [...new Set(form.lines.map((line) => line.variantId))].sort(), [form.lines]);
  const stockQuery = useQuery({
    queryKey: ["transfer-form-stock", companyId, variantIds],
    queryFn: () => getStockByVariants(variantIds),
    enabled: variantIds.length > 0,
    staleTime: 15_000,
    retry: false,
  });
  // FEAT-24 H5-L: en productos con lotes, cada línea puede elegir el lote (si no, sale el que vence antes).
  const lotTracking = useLotTrackedVariants(variantIds, companyId);
  const tracksLots = (variantId: string) => lotTracking.status === "ready" && lotTracking.variantIds.has(variantId);
  const stockAt = useMemo(() => {
    const map = new Map<string, { physical: number; reserved: number }>();
    for (const row of stockQuery.data ?? [])
      for (const inv of row.inventories ?? []) map.set(`${row.variant_id}|${inv.inventory_id}`, { physical: inv.quantity, reserved: inv.reserved_quantity });
    return map;
  }, [stockQuery.data]);
  const availableInOrigin = useMemo(() => {
    if (!stockQuery.data || !form.originInventoryId) return undefined;
    const map = new Map<string, number>();
    for (const line of form.lines) {
      const cell = stockAt.get(`${line.variantId}|${form.originInventoryId}`);
      map.set(line.variantId, cell ? cell.physical - cell.reserved : 0);
    }
    return map;
  }, [stockQuery.data, stockAt, form.lines, form.originInventoryId]);

  const problem = transferFormProblem(form, availableInOrigin);
  const totalUnits = form.lines.reduce((sum, line) => sum + (parseQuantity(line.quantity, 1) ?? 0), 0);

  const change = (patch: Partial<TransferForm>) => {
    setServerError(null);
    setForm((current) => ({ ...current, ...patch }));
  };

  const save = useMutation({
    mutationFn: async (dispatch: boolean) => {
      const body = buildTransferBody(form);
      const saved = savedId ? await updateTransfer(savedId, body) : await createTransfer(body);
      setSavedId(saved.id);
      if (!dispatch) return { transfer: saved, dispatched: false };
      try {
        const result = await dispatchTransfer(saved.id, { operationId: dispatchKey });
        return { transfer: result.transfer, dispatched: true };
      } catch (cause) {
        throw new NotDispatchedError(saved, cause);
      }
    },
    onSuccess: ({ transfer: saved, dispatched }) => {
      toast.success(dispatched ? `${saved.number} en camino` : `${saved.number} guardado como borrador`, {
        description: dispatched ? "El stock salió del origen y queda «en camino» hasta que el destino lo reciba." : undefined,
      });
      onSaved(saved, dispatched);
    },
    onError: (error) => {
      if (error instanceof NotDispatchedError) {
        setServerError(`${error.transfer.number} quedó guardado como borrador, pero no se pudo despachar: ${opsErrorMessage(error.failure, "inténtalo de nuevo.")}`);
        return;
      }
      setServerError(opsErrorMessage(error, "No se pudo guardar el traslado. Inténtalo de nuevo."));
    },
  });
  const busy = save.isPending;
  const submit = (dispatch: boolean) => {
    setTouched(true);
    if (problem) return;
    save.mutate(dispatch);
  };

  const originName = warehouses.find((warehouse) => warehouse.id === form.originInventoryId)?.name ?? "el origen";
  const destinationName = warehouses.find((warehouse) => warehouse.id === form.destinationInventoryId)?.name ?? "el destino";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{transfer ? `Editar ${transfer.number}` : "Nuevo traslado"}</DialogTitle>
          <DialogDescription>Elige el producto: aparecen todas sus variantes con el disponible y el saldo que queda.</DialogDescription>
        </DialogHeader>

        {warehousesQuery.isError ? <ErrorBox>{opsErrorMessage(warehousesQuery.error, "No se pudieron cargar los almacenes.")}</ErrorBox> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="tr-origin">Origen</Label>
            <select
              id="tr-origin"
              className={SELECT_CLASS}
              value={form.originInventoryId}
              disabled={busy}
              onChange={(event) => change({ originInventoryId: event.target.value, lines: clearDraftLots(form.lines) })}
            >
              <option value="">{warehousesQuery.isLoading || scope.isLoading ? "Cargando…" : "Elige el origen"}</option>
              {origins.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            {!warehousesQuery.isLoading && origins.length === 0 ? (
              <p className="text-xs text-muted-foreground">No operas ningún almacén: pide al Administrador que te asigne uno.</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="tr-destination">Destino</Label>
            <select
              id="tr-destination"
              className={SELECT_CLASS}
              value={form.destinationInventoryId}
              disabled={busy}
              onChange={(event) => change({ destinationInventoryId: event.target.value })}
            >
              <option value="">Elige el destino</option>
              {destinations.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tr-freight">Flete (gasto logístico, opcional)</Label>
            <Input
              id="tr-freight"
              inputMode="decimal"
              placeholder="0.00"
              value={form.freight}
              disabled={busy}
              onChange={(event) => change({ freight: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">No suma al costo de los productos.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tr-guide">Guía de remisión (opcional)</Label>
            <Input
              id="tr-guide"
              className="font-mono"
              maxLength={50}
              placeholder="T001-00000"
              value={form.remissionGuide}
              disabled={busy}
              onChange={(event) => change({ remissionGuide: event.target.value })}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="tr-notes">Referencia o nota (opcional)</Label>
            <Textarea id="tr-notes" maxLength={2000} rows={2} value={form.notes} disabled={busy} onChange={(event) => change({ notes: event.target.value })} />
          </div>
        </div>

        <VariantLinePicker
          companyId={companyId}
          idPrefix="tr"
          disabled={busy}
          onAdd={(lines) => {
            const next = addDraftLines(form.lines, lines);
            change({ lines: next.lines });
            return next.added;
          }}
        />

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Variante</th>
                <th className="px-3 py-2 text-right font-medium">Disponible en origen</th>
                <th className="px-3 py-2 text-right font-medium">Trasladar</th>
                <th className="px-3 py-2 text-right font-medium">Queda en origen</th>
                <th className="px-3 py-2 text-right font-medium">Hoy en destino</th>
                <th className="px-3 py-2 text-right font-medium">Nuevo saldo destino</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {form.lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    Agrega un producto.
                  </td>
                </tr>
              ) : (
                form.lines.map((line) => {
                  const origin = form.originInventoryId ? stockAt.get(`${line.variantId}|${form.originInventoryId}`) : undefined;
                  const destination = form.destinationInventoryId ? stockAt.get(`${line.variantId}|${form.destinationInventoryId}`) : undefined;
                  const available = stockQuery.data && form.originInventoryId ? (origin ? origin.physical - origin.reserved : 0) : null;
                  const quantity = parseQuantity(line.quantity, 0) ?? 0;
                  const over = available !== null && quantity > available;
                  const today = stockQuery.data && form.destinationInventoryId ? (destination?.physical ?? 0) : null;
                  return (
                    <tr key={line.variantId} className="border-t" data-testid={`tr-line-${line.variantId}`}>
                      <td className="px-3 py-2">
                        <p>{line.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                        {tracksLots(line.variantId) ? (
                          <LotSelect
                            variantId={line.variantId}
                            inventoryId={form.originInventoryId}
                            direction="OUT"
                            label={`Lote: ${line.label}`}
                            value={line.lotId ?? ""}
                            disabled={busy}
                            onChange={(lotId) =>
                              change({ lines: form.lines.map((candidate) => (candidate.variantId === line.variantId ? { ...candidate, lotId } : candidate)) })
                            }
                          />
                        ) : null}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${available !== null && available <= 0 ? "text-destructive" : ""}`}>{available ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          aria-label={`Trasladar: ${line.label}`}
                          className="ml-auto w-24 text-right"
                          inputMode="numeric"
                          placeholder="0"
                          value={line.quantity}
                          disabled={busy}
                          aria-invalid={over || undefined}
                          onChange={(event) =>
                            change({ lines: form.lines.map((candidate) => (candidate.variantId === line.variantId ? { ...candidate, quantity: event.target.value } : candidate)) })
                          }
                        />
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${over ? "text-destructive" : ""}`}>{available !== null ? available - quantity : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{today ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{today !== null ? today + quantity : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {over ? <span className="mr-2 text-xs text-destructive">Supera el disponible</span> : null}
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {form.originInventoryId && form.originInventoryId === form.destinationInventoryId
              ? "El origen y el destino deben ser distintos."
              : `Al despachar saldrán ${totalUnits} unidades de ${originName} y quedarán en camino hasta que ${destinationName} las reciba. Las variantes con IMEI o serie se trasladan con «Transferir unidades».`}
          </span>
        </div>

        {touched && problem ? <ErrorBox>{problem}</ErrorBox> : null}
        <ErrorBox>{serverError}</ErrorBox>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => submit(false)}>
            Guardar borrador
          </Button>
          <Button type="button" disabled={busy} onClick={() => submit(true)}>
            {busy ? "Guardando…" : "Despachar ahora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
