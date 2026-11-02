"use client";

import { useEffect, useRef, useState } from "react";
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
import type { OrderHeader } from "@/interfaces/IOrder";
import type { Courier } from "@/services/courierService";
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
import { CourierEvidenceSelector } from "./CourierEvidenceSelector";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const selectClass = "w-full rounded-md border bg-background p-2 text-sm";
export function settlementError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string") return message;
    if (error.response?.status === 409)
      return "Los importes o la revisión cambiaron. Actualiza la lista antes de continuar.";
  }
  return error instanceof Error && !axios.isAxiosError(error)
    ? error.message
    : "No se pudo completar la operación. Puedes reintentar.";
}
function useActive() {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return active;
}
function ProofInput({
  file,
  disabled,
  onChange,
}: {
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="new-settlement-proof">Comprobante</Label>
      <Input
        id="new-settlement-proof"
        type="file"
        disabled={disabled}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <p className="text-xs text-muted-foreground">
        JPG, PNG, WebP o PDF · máximo 10 MB. Se guarda de forma privada.
        {file ? ` ${file.name}` : " Puedes adjuntarlo también desde el historial."}
      </p>
    </div>
  );
}

export function ConfirmCollectionDialog({
  companyId,
  orders,
  couriers,
  linkedEvidenceIds = [],
  onClose,
  onPersisted,
  onComplete,
}: {
  companyId: string;
  orders: OrderHeader[];
  couriers: Courier[];
  linkedEvidenceIds?: string[];
  onClose: () => void;
  onPersisted: () => Promise<unknown>;
  onComplete: (collection: CourierCollection) => void;
}) {
  const [search, setSearch] = useState("");
  const [orderId, setOrderId] = useState("");
  const [courierId, setCourierId] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [providerEvidenceId, setProviderEvidenceId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<CourierCollection | null>(null);
  const request = useRef<ConfirmCollectionInput | null>(null);
  const submitting = useRef(false);
  const active = useActive();
  const selected = orders.find((order) => order.id === orderId);
  const candidates = orders.filter(
    (order) =>
      order.status === "ENTREGADO" &&
      (order.courierId || order.courier) &&
      `${order.orderNumber} ${order.customer?.fullName ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const valid =
    !!selected &&
    !!courierId &&
    !!selected.currency &&
    positiveMoney(amount) !== null &&
    notes.trim().length >= 5 &&
    !!date;
  const frozen = busy || !!saved || !!request.current;

  function chooseOrder(id: string) {
    setOrderId(id);
    setShowEvidence(false);
    setProviderEvidenceId("");
    const order = orders.find((item) => item.id === id);
    const matches = couriers.filter(
      (courier) => courier.name.trim().toLowerCase() === order?.courier?.trim().toLowerCase(),
    );
    setCourierId(order?.courierId ?? (matches.length === 1 ? matches[0].id : ""));
  }
  async function submit() {
    if (submitting.current || (!saved && !valid)) return;
    try {
      if (file) validateSettlementProof(file);
    } catch (cause) {
      setError(settlementError(cause));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    let record = saved;
    try {
      if (!record) {
        if (!request.current)
          request.current = {
            requestId: crypto.randomUUID(),
            orderId,
            courierId,
            amount: positiveMoney(amount)!,
            collectedAt: date,
            notes: notes.trim(),
            ...(providerEvidenceId ? { providerEvidenceId } : {}),
          };
        record = await confirmCourierCollection(companyId, request.current);
        if (!active.current) return;
        setSaved(record);
        await onPersisted();
      }
      if (file) await uploadSettlementProof(companyId, "collections", record.id, file);
      if (active.current) onComplete(record);
    } catch (cause) {
      if (!active.current) return;
      if (!record && axios.isAxiosError(cause) && cause.response && cause.response.status < 500)
        request.current = null;
      setError(
        record
          ? `El cobro está guardado. No se pudo guardar el comprobante: ${settlementError(cause)}`
          : settlementError(cause),
      );
    } finally {
      submitting.current = false;
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar cobro del courier</DialogTitle>
          <DialogDescription>
            Confirma el importe que recibió el courier. La entrega y el saldo del cliente no prueban
            este cobro. Esta declaración no aprueba el pago del cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="collection-search">Buscar pedido entregado</Label>
          <Input
            id="collection-search"
            value={search}
            disabled={frozen}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Label htmlFor="collection-order">Pedido</Label>
          <select
            id="collection-order"
            className={selectClass}
            value={orderId}
            disabled={frozen}
            onChange={(e) => chooseOrder(e.target.value)}
          >
            <option value="">Selecciona un pedido</option>
            {candidates.map((order) => (
              <option key={order.id} value={order.id}>
                {order.orderNumber} · {order.customer?.fullName} · {order.courier}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="collection-courier">Courier que cobró</Label>
          <select
            id="collection-courier"
            className={selectClass}
            value={courierId}
            disabled={frozen || !!selected?.courierId}
            onChange={(e) => setCourierId(e.target.value)}
          >
            <option value="">Selecciona courier</option>
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.name}
              </option>
            ))}
          </select>
        </div>
        {orderId && !showEvidence && (
          <Button
            type="button"
            variant="outline"
            disabled={frozen}
            onClick={() => setShowEvidence(true)}
          >
            Consultar reportes de courier
          </Button>
        )}
        {orderId && showEvidence && (
          <CourierEvidenceSelector
            key={orderId}
            companyId={companyId}
            orderId={orderId}
            linkedIds={linkedEvidenceIds}
            selectedId={providerEvidenceId}
            disabled={frozen}
            onSelect={setProviderEvidenceId}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="collection-amount">Importe cobrado {selected?.currency ?? ""}</Label>
            <Input
              id="collection-amount"
              inputMode="decimal"
              value={amount}
              disabled={frozen}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="collection-date">Fecha de cobro</Label>
            <Input
              id="collection-date"
              type="date"
              value={date}
              disabled={frozen}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        {selected && !selected.currency && (
          <p role="alert" className="text-sm text-amber-700">
            El pedido no tiene moneda. Corrígela antes de confirmar el cobro.
          </p>
        )}
        <div className="space-y-1">
          <Label htmlFor="collection-notes">Cómo se verificó el cobro</Label>
          <Textarea
            id="collection-notes"
            value={notes}
            disabled={frozen}
            maxLength={1000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe la evidencia o confirmación recibida (mínimo 5 caracteres)."
          />
        </div>
        <ProofInput file={file} disabled={busy} onChange={setFile} />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {saved ? "Cerrar; cobro guardado" : "Cancelar"}
          </Button>
          <Button type="button" disabled={busy || (!saved && !valid)} onClick={() => void submit()}>
            {busy
              ? "Guardando…"
              : saved
                ? "Reintentar comprobante"
                : request.current
                  ? "Reintentar confirmación"
                  : "Confirmar cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateSettlementDialog({
  companyId,
  collections,
  onClose,
  onPersisted,
  onComplete,
}: {
  companyId: string;
  collections: CourierCollection[];
  onClose: () => void;
  onPersisted: () => Promise<unknown>;
  onComplete: (settlement: SettlementDetail) => void;
}) {
  const [allocations, setAllocations] = useState<Record<string, string>>(() =>
    Object.fromEntries(collections.map((item) => [item.id, String(item.availableAmount)])),
  );
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState<SettlementMethod>("transferencia");
  const [date, setDate] = useState(today);
  const [operation, setOperation] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SettlementDetail | null>(null);
  const request = useRef<CreateSettlementInput | null>(null);
  const submitting = useRef(false);
  const active = useActive();
  const first = collections[0];
  const expected = collections.reduce((sum, item) => sum + item.availableAmount, 0);
  const allocated = collections.reduce(
    (sum, item) => sum + (positiveMoney(allocations[item.id]) ?? 0),
    0,
  );
  const deposited = positiveMoney(deposit);
  const valid =
    collections.length > 0 &&
    collections.length <= 100 &&
    !!date &&
    !!deposited &&
    Math.round(allocated * 100) <= Math.round(deposited * 100) &&
    collections.every((item) => {
      const value = positiveMoney(allocations[item.id]);
      return (
        item.courierId === first.courierId &&
        item.currency === first.currency &&
        value !== null &&
        Math.round(value * 100) <= Math.round(item.availableAmount * 100)
      );
    });
  const frozen = busy || !!saved || !!request.current;
  async function submit() {
    if (submitting.current || (!saved && !valid)) return;
    try {
      if (file) validateSettlementProof(file);
    } catch (cause) {
      setError(settlementError(cause));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    let record = saved;
    try {
      if (!record) {
        if (!request.current)
          request.current = {
            requestId: crypto.randomUUID(),
            courierId: first.courierId,
            allocations: collections.map((item) => ({
              collectionId: item.id,
              amount: positiveMoney(allocations[item.id])!,
            })),
            amountDeposited: deposited!,
            method,
            date,
            operationNumber: operation.trim() || undefined,
            notes: notes.trim() || undefined,
          };
        record = await createCourierSettlement(companyId, request.current);
        if (!active.current) return;
        setSaved(record);
        await onPersisted();
      }
      if (file) await uploadSettlementProof(companyId, "settlements", record.id, file);
      if (active.current) onComplete(record);
    } catch (cause) {
      if (!active.current) return;
      if (!record && axios.isAxiosError(cause) && cause.response && cause.response.status < 500)
        request.current = null;
      setError(
        record
          ? `El depósito está guardado y pendiente de revisión. No se pudo guardar el comprobante: ${settlementError(cause)}`
          : settlementError(cause),
      );
    } finally {
      submitting.current = false;
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar depósito · {first?.courierName}</DialogTitle>
          <DialogDescription>
            Asigna el depósito recibido a los cobros seleccionados. Quedará pendiente de revisión de
            Finanzas; los remanentes siguen por liquidar.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          Disponible seleccionado: {settlementMoney(expected, first?.currency ?? "")}
        </p>
        <div className="space-y-3">
          {collections.map((item) => (
            <div key={item.id} className="grid grid-cols-2 items-center gap-2 rounded border p-2">
              <div className="text-sm">
                {item.orderNumber} · {item.customerName}
                <p className="text-xs text-muted-foreground">
                  Disponible {settlementMoney(item.availableAmount, item.currency)}
                </p>
              </div>
              <div>
                <Label htmlFor={`allocation-${item.id}`}>Asignar a {item.orderNumber}</Label>
                <Input
                  id={`allocation-${item.id}`}
                  inputMode="decimal"
                  value={allocations[item.id]}
                  disabled={frozen}
                  onChange={(e) =>
                    setAllocations((value) => ({ ...value, [item.id]: e.target.value }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="settlement-deposit">Importe real depositado {first?.currency}</Label>
            <Input
              id="settlement-deposit"
              inputMode="decimal"
              value={deposit}
              disabled={frozen}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="settlement-date">Fecha del depósito</Label>
            <Input
              id="settlement-date"
              type="date"
              value={date}
              disabled={frozen}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <p className="text-sm">
          Asignado: {settlementMoney(allocated, first?.currency ?? "")} · Diferencia contra
          disponible:{" "}
          {deposited === null
            ? "Por indicar"
            : settlementMoney(deposited - expected, first?.currency ?? "")}
          .
        </p>
        {deposited !== null && allocated > deposited && (
          <p role="alert" className="text-sm text-amber-700">
            La suma asignada no puede superar el depósito. Ajusta las asignaciones para un depósito
            parcial.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="settlement-method">Método del depósito</Label>
            <select
              id="settlement-method"
              className={selectClass}
              value={method}
              disabled={frozen}
              onChange={(e) => setMethod(e.target.value as SettlementMethod)}
            >
              {Object.entries(settlementMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="settlement-operation">N.º de operación</Label>
            <Input
              id="settlement-operation"
              maxLength={100}
              value={operation}
              disabled={frozen}
              onChange={(e) => setOperation(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="settlement-notes">Observaciones</Label>
          <Textarea
            id="settlement-notes"
            maxLength={1000}
            value={notes}
            disabled={frozen}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <ProofInput file={file} disabled={busy} onChange={setFile} />
        {method !== "efectivo" && !file && (
          <p className="text-xs text-muted-foreground">
            Se requiere comprobante antes de aceptar este depósito. Puedes guardarlo pendiente y
            adjuntarlo luego.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {saved ? "Cerrar; depósito guardado" : "Cancelar"}
          </Button>
          <Button type="button" disabled={busy || (!saved && !valid)} onClick={() => void submit()}>
            {busy
              ? "Guardando…"
              : saved
                ? "Reintentar comprobante"
                : request.current
                  ? "Reintentar depósito"
                  : "Guardar depósito pendiente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
