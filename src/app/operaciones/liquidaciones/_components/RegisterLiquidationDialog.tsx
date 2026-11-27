"use client";

import { useRef, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  confirmCourierCollection,
  createCourierSettlement,
  positiveMoney,
  settlementMethodLabels,
  settlementMoney,
  uploadSettlementProof,
  validateSettlementProof,
  type ConfirmCollectionInput,
  type CourierCollection,
  type CreateSettlementInput,
  type SettlementDetail,
  type SettlementMethod,
} from "@/services/courierSettlementsService";
import { allocateDeposit, collectionDate, fromCents, type PendingCollection } from "./pendingCollections";
import { ProofInput, settlementError, today, useActive } from "./SettlementCreateDialogs";

const selectClass = "w-full rounded-md border bg-background p-2 text-sm";
const centsOf = (value: string) => {
  const amount = positiveMoney(value);
  return amount === null ? null : Math.round(amount * 100);
};
const isClientError = (cause: unknown) =>
  axios.isAxiosError(cause) && !!cause.response && cause.response.status < 500;

/**
 * Liquidación en un paso desde «Por liquidar»: confirma el cobro de cada
 * pedido, registra el depósito (pendiente de revisión de Finanzas) y sube el
 * comprobante. Cada paso guardado queda guardado: si algo falla, reintentar
 * sigue desde ahí con los mismos requestId (ms-courier es idempotente).
 */
export function RegisterLiquidationDialog({
  companyId,
  rows: initialRows,
  onClose,
  onPersisted,
  onComplete,
}: {
  companyId: string;
  rows: PendingCollection[];
  onClose: () => void;
  onPersisted: () => Promise<unknown>;
  onComplete: (settlement: SettlementDetail) => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const first = rows[0] ?? initialRows[0];
  const currency = first?.currency ?? "";
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRows.map((row) => [row.orderId, String(fromCents(row.pendingCents))])),
  );
  const [deposit, setDeposit] = useState(() =>
    String(fromCents(initialRows.reduce((sum, row) => sum + row.pendingCents, 0))),
  );
  const [method, setMethod] = useState<SettlementMethod>("transferencia");
  const [date, setDate] = useState(today);
  const [operation, setOperation] = useState("");
  const [verification, setVerification] = useState(
    () => `Cobro informado por ${initialRows[0]?.courierLabel ?? "el courier"} en su liquidación`,
  );
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Record<string, CourierCollection>>({});
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [settlement, setSettlement] = useState<SettlementDetail | null>(null);
  const [settlementLocked, setSettlementLocked] = useState(false);
  const collectionRequests = useRef(new Map<string, ConfirmCollectionInput>());
  const settlementRequest = useRef<CreateSettlementInput | null>(null);
  const submitting = useRef(false);
  const active = useActive();

  const collectedCents = rows.map((row) =>
    saved[row.orderId] ? Math.round(saved[row.orderId].amount * 100) : centsOf(amounts[row.orderId] ?? ""),
  );
  const totalCollected = collectedCents.reduce<number>((sum, cents) => sum + (cents ?? 0), 0);
  const depositCents = centsOf(deposit);
  const allocations = allocateDeposit(
    collectedCents.map((cents) => cents ?? 0),
    depositCents ?? 0,
  );
  const allocatedCents = allocations.reduce((sum, cents) => sum + cents, 0);
  const differenceCents = depositCents === null ? null : depositCents - totalCollected;
  const rowErrors = rows.map((row, index) => {
    const cents = collectedCents[index];
    if (cents === null) return "Importe no válido";
    if (!saved[row.orderId] && cents > row.pendingCents)
      return `Máximo ${settlementMoney(fromCents(row.pendingCents), currency)}`;
    return "";
  });
  const valid =
    rows.length > 0 &&
    rows.length <= 100 &&
    rowErrors.every((message) => !message) &&
    depositCents !== null &&
    allocatedCents > 0 &&
    verification.trim().length >= 5 &&
    !!date;
  const anySaved = Object.keys(saved).length > 0;

  async function submit() {
    if (submitting.current || (!settlement && !valid)) return;
    try {
      if (file) validateSettlementProof(file);
    } catch (cause) {
      setError(settlementError(cause));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    let current = settlement;
    const done: Record<string, CourierCollection> = { ...saved };
    try {
      if (!current) {
        for (const [index, row] of rows.entries()) {
          if (done[row.orderId]) continue;
          setProgress(`Confirmando cobros ${index + 1} de ${rows.length}…`);
          let input = collectionRequests.current.get(row.orderId);
          if (!input) {
            input = {
              requestId: crypto.randomUUID(),
              orderId: row.orderId,
              courierId: row.courierId!,
              amount: fromCents(collectedCents[index]!),
              collectedAt: collectionDate(row.updatedAt, today()),
              notes: verification.trim(),
            };
            collectionRequests.current.set(row.orderId, input);
            setLocked((value) => new Set(value).add(row.orderId));
          }
          try {
            done[row.orderId] = await confirmCourierCollection(companyId, input);
          } catch (cause) {
            if (isClientError(cause)) {
              collectionRequests.current.delete(row.orderId);
              if (active.current)
                setLocked((value) => {
                  const next = new Set(value);
                  next.delete(row.orderId);
                  return next;
                });
            }
            throw Object.assign(new Error(`${row.orderNumber}: ${settlementError(cause)}`), { cause });
          }
          if (!active.current) return;
          setSaved({ ...done });
        }
        await onPersisted();
        if (!active.current) return;
        setProgress("Registrando el depósito…");
        if (!settlementRequest.current) {
          settlementRequest.current = {
            requestId: crypto.randomUUID(),
            courierId: first.courierId!,
            allocations: rows.flatMap((row, index) =>
              allocations[index] > 0
                ? [{ collectionId: done[row.orderId].id, amount: fromCents(allocations[index]) }]
                : [],
            ),
            amountDeposited: fromCents(depositCents!),
            method,
            date,
            operationNumber: operation.trim() || undefined,
            notes: notes.trim() || undefined,
          };
          setSettlementLocked(true);
        }
        try {
          current = await createCourierSettlement(companyId, settlementRequest.current);
        } catch (cause) {
          if (isClientError(cause)) {
            settlementRequest.current = null;
            if (active.current) setSettlementLocked(false);
          }
          throw Object.assign(
            new Error(`Los cobros quedaron confirmados, pero no se pudo registrar el depósito: ${settlementError(cause)}`),
            { cause },
          );
        }
        if (!active.current) return;
        setSettlement(current);
        await onPersisted();
      }
      if (file) {
        setProgress("Guardando el comprobante…");
        try {
          await uploadSettlementProof(companyId, "settlements", current.id, file);
        } catch (cause) {
          throw Object.assign(
            new Error(
              `La liquidación está guardada y pendiente de revisión. No se pudo guardar el comprobante: ${settlementError(cause)}`,
            ),
            { cause },
          );
        }
      }
      if (active.current) onComplete(current);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : settlementError(cause));
    } finally {
      submitting.current = false;
      if (active.current) {
        setBusy(false);
        setProgress("");
      }
    }
  }

  const depositFrozen = busy || settlementLocked || !!settlement;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar liquidación · {first?.courierLabel}</DialogTitle>
          <DialogDescription>
            Confirma lo que cobró el courier en cada pedido y registra su depósito. El depósito queda
            pendiente de revisión de Finanzas; no modifica los pagos del cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2">Pedido</th>
                <th className="p-2">Cobrado por el courier</th>
                <th className="p-2 text-right">Se liquida</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.orderId} className="border-t align-top">
                  <td className="p-2">
                    <p className="font-medium">{row.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.customerName} · pendiente {settlementMoney(fromCents(row.pendingCents), currency)}
                    </p>
                  </td>
                  <td className="p-2">
                    <Label htmlFor={`liquidation-amount-${row.orderId}`} className="sr-only">
                      Cobrado en {row.orderNumber}
                    </Label>
                    <Input
                      id={`liquidation-amount-${row.orderId}`}
                      inputMode="decimal"
                      className="max-w-36"
                      value={saved[row.orderId] ? String(saved[row.orderId].amount) : amounts[row.orderId]}
                      disabled={busy || !!saved[row.orderId] || locked.has(row.orderId)}
                      onChange={(event) =>
                        setAmounts((value) => ({ ...value, [row.orderId]: event.target.value }))
                      }
                    />
                    {saved[row.orderId] ? (
                      <p className="text-xs text-emerald-700">Cobro confirmado</p>
                    ) : (
                      rowErrors[index] && <p className="text-xs text-red-600">{rowErrors[index]}</p>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {settlementMoney(fromCents(allocations[index] ?? 0), currency)}
                  </td>
                  <td className="p-2">
                    {!saved[row.orderId] && !locked.has(row.orderId) && rows.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy || !!settlement}
                        aria-label={`Quitar ${row.orderNumber}`}
                        onClick={() => setRows((value) => value.filter((item) => item.orderId !== row.orderId))}
                      >
                        Quitar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1">
          <Label htmlFor="liquidation-verification">Cómo se verificó el cobro</Label>
          <Textarea
            id="liquidation-verification"
            maxLength={1000}
            value={verification}
            disabled={busy || anySaved}
            onChange={(event) => setVerification(event.target.value)}
          />
          {verification.trim().length < 5 && (
            <p className="text-xs text-red-600">Mínimo 5 caracteres.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="liquidation-deposit">Importe depositado {currency}</Label>
            <Input
              id="liquidation-deposit"
              inputMode="decimal"
              value={deposit}
              disabled={depositFrozen}
              onChange={(event) => setDeposit(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="liquidation-date">Fecha del depósito</Label>
            <Input
              id="liquidation-date"
              type="date"
              value={date}
              max={today()}
              disabled={depositFrozen}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="liquidation-method">Método del depósito</Label>
            <select
              id="liquidation-method"
              className={selectClass}
              value={method}
              disabled={depositFrozen}
              onChange={(event) => setMethod(event.target.value as SettlementMethod)}
            >
              {Object.entries(settlementMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="liquidation-operation">N.º de operación</Label>
            <Input
              id="liquidation-operation"
              maxLength={100}
              value={operation}
              disabled={depositFrozen}
              onChange={(event) => setOperation(event.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="liquidation-notes">Observaciones del depósito</Label>
          <Textarea
            id="liquidation-notes"
            maxLength={1000}
            value={notes}
            disabled={depositFrozen}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-sm" aria-live="polite">
          <p>
            Cobrado: {settlementMoney(fromCents(totalCollected), currency)} · Depositado:{" "}
            {depositCents === null ? "Por indicar" : settlementMoney(fromCents(depositCents), currency)} · Diferencia:{" "}
            {differenceCents === null ? "—" : settlementMoney(fromCents(differenceCents), currency)}
          </p>
          {differenceCents !== null && differenceCents < 0 && (
            <p className="mt-1 text-amber-700">
              Depósito parcial: se liquida en orden hasta agotar lo depositado; el resto queda por liquidar.
            </p>
          )}
          {differenceCents !== null && differenceCents > 0 && (
            <p className="mt-1 text-amber-700">
              El depósito supera lo cobrado: el exceso queda registrado como diferencia sin asignar.
            </p>
          )}
        </div>

        <ProofInput id="liquidation-proof" file={file} disabled={busy} onChange={setFile} />
        {method !== "efectivo" && !file && (
          <p className="text-xs text-muted-foreground">
            Finanzas necesita el comprobante para aceptar el depósito. Puedes adjuntarlo ahora o después
            desde el historial.
          </p>
        )}
        {progress && (
          <p role="status" className="text-sm">
            {progress}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {settlement ? "Cerrar; liquidación guardada" : anySaved ? "Cerrar; cobros guardados" : "Cancelar"}
          </Button>
          <Button type="button" disabled={busy || (!settlement && !valid)} onClick={() => void submit()}>
            {busy
              ? "Guardando…"
              : settlement
                ? "Reintentar comprobante"
                : anySaved || error
                  ? "Reintentar"
                  : "Guardar liquidación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
