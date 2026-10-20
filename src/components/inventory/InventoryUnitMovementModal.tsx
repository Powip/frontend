"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { trackingError, type InventoryUnit } from "@/services/inventoryTrackingService";
import {
  getInventoryUnitOperation,
  inventoryUnitMovementKey,
  readInventoryUnitMovement,
  saveInventoryUnitMovement,
  submitInventoryUnitMovement,
  validateInventoryMovementReceipt,
  type InventoryUnitMovementAction,
  type InventoryUnitMovementDraft,
  type InventoryUnitMovementReceipt,
  type InventoryUnitMovementRequest,
  type InventoryUnitMovementSource,
  type PendingInventoryUnitMovement,
} from "@/services/inventoryUnitMovementService";
import InventoryUnitMovementForm from "./InventoryUnitMovementForm";
import AvailableInventoryUnitPicker from "./AvailableInventoryUnitPicker";

interface Props {
  source: InventoryUnitMovementSource;
  action: InventoryUnitMovementAction;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}
export default function InventoryUnitMovementModal(props: Props) {
  const { auth } = useAuth();
  const userId = auth?.user?.id ?? "";
  const authorized = Boolean(userId && props.companyId && auth?.company?.id === props.companyId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {props.action === "transfer"
              ? "Transferir IMEI / series"
              : "Registrar merma de IMEI / series"}
          </DialogTitle>
          <DialogDescription>
            Selecciona las unidades disponibles y confirma el movimiento completo.
          </DialogDescription>
        </DialogHeader>
        {authorized ? (
          <MovementEditor
            key={`${props.companyId}:${userId}:${props.source.inventoryItemId}:${props.action}`}
            {...props}
            userId={userId}
          />
        ) : (
          <p role="alert">La sesión no permite operar sobre este inventario.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
function MovementEditor({
  source,
  action,
  companyId,
  userId,
  onClose,
  onSaved,
}: Props & { userId: string }) {
  const key = inventoryUnitMovementKey(companyId, userId, source.inventoryItemId);
  const [pending, setPending] = useState(() =>
    readInventoryUnitMovement(key, source.inventoryItemId),
  );
  const [receipt, setReceipt] = useState<InventoryUnitMovementReceipt | null>(null);
  const [selected, setSelected] = useState<InventoryUnit[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const warehouses = useBusinessInventories();
  const alive = useRef(true);
  const working = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const accept = (result: InventoryUnitMovementReceipt, expected: PendingInventoryUnitMovement) => {
    validateInventoryMovementReceipt(result, expected, companyId, source);
    if (!alive.current) return;
    setReceipt(result);
    if (result.status === "COMPLETED") {
      saveInventoryUnitMovement(key, null);
      setPending(null);
      onSaved();
    }
  };
  const run = async (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (reason) {
      if (alive.current)
        setError(
          trackingError(
            reason,
            "No se pudo comprobar el resultado. Conservamos la misma solicitud para consultarla o reintentar.",
          ),
        );
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const submit = (draft: InventoryUnitMovementDraft) =>
    run(async () => {
      if (pending) return;
      const operationId = crypto.randomUUID();
      let request: InventoryUnitMovementRequest;
      if (action === "transfer") {
        if (!draft.destinationInventoryId) throw new Error("Selecciona el almacén de destino.");
        request = {
          operationId,
          sourceInventoryItemId: source.inventoryItemId,
          destinationInventoryId: draft.destinationInventoryId,
          quantity: draft.quantity,
          unitIds: draft.unitIds,
          reason: draft.reason,
        };
      } else {
        if (!draft.shrinkageType || typeof draft.unitCost !== "number")
          throw new Error("Completa el tipo y los importes de la merma.");
        request = {
          operationId,
          inventoryItemId: source.inventoryItemId,
          quantity: draft.quantity,
          unitIds: draft.unitIds,
          reason: draft.reason,
          shrinkageType: draft.shrinkageType,
          unitCost: draft.unitCost,
          recoveredAmount: draft.recoveredAmount ?? 0,
        };
      }
      const value = { action, operationId, request };
      saveInventoryUnitMovement(key, value);
      setPending(value);
      accept(await submitInventoryUnitMovement(action, request), value);
    });
  const recover = () =>
    run(async () => {
      if (!pending) return;
      let result: InventoryUnitMovementReceipt;
      try {
        result = await getInventoryUnitOperation(pending.operationId);
      } catch (reason) {
        if ((reason as { response?: { status?: number } }).response?.status !== 404) throw reason;
        if (!alive.current) return;
        result = await submitInventoryUnitMovement(pending.action, pending.request);
      }
      accept(result, pending);
    });
  const correct = () =>
    run(async () => {
      if (!pending) return;
      const result = await getInventoryUnitOperation(pending.operationId);
      accept(result, pending);
      if (alive.current && result.status === "REJECTED") {
        saveInventoryUnitMovement(key, null);
        setPending(null);
        setReceipt(null);
        setSelected([]);
        setRevision((value) => value + 1);
      }
    });
  if (receipt?.status === "COMPLETED")
    return (
      <div role="status" className="space-y-3">
        <p>
          {receipt.kind === "TRANSFER"
            ? "Transferencia registrada"
            : "Merma y baja de inventario registradas"}
          : {receipt.quantity} unidades.
        </p>
        <p className="text-sm">
          Este recibo confirma el movimiento solicitado. El inventario se actualiza para mostrar el
          estado actual de las unidades.
        </p>
        <ul aria-label="Códigos del movimiento confirmado">
          {receipt.units?.map((unit) => (
            <li key={unit.id}>
              <code>{unit.code}</code>
            </li>
          ))}
        </ul>
        {receipt.shrinkageId && <p className="text-xs">Registro de merma: {receipt.shrinkageId}</p>}
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    );
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {pending ? (
        <section
          aria-label="Movimiento pendiente de resolver"
          className="space-y-3 rounded border p-3"
        >
          <p className="font-medium">
            {pending.action === "transfer" ? "Transferencia" : "Merma"}:{" "}
            {receipt?.status === "REJECTED" ? "solicitud rechazada" : "resultado sin confirmar"}
          </p>
          <p className="text-sm">
            Conservamos la solicitud y su identificador. No inicies otro movimiento hasta comprobar
            este resultado.
          </p>
          {receipt?.error && <p role="alert">{receipt.error.message}</p>}
          <Button disabled={busy} onClick={recover}>
            Consultar o reintentar la misma operación
          </Button>
          {receipt?.status === "REJECTED" && (
            <Button variant="outline" disabled={busy} onClick={correct}>
              Corregir movimiento rechazado
            </Button>
          )}
        </section>
      ) : action === "transfer" &&
        (warehouses.isPending || warehouses.error || !warehouses.isSuccess) ? (
        <div>
          <p role={warehouses.error ? "alert" : "status"}>
            {warehouses.error
              ? "No se pudieron validar los almacenes de esta empresa."
              : "Cargando almacenes de destino…"}
          </p>
          {warehouses.error && (
            <Button onClick={() => warehouses.refetch()}>Reintentar almacenes</Button>
          )}
        </div>
      ) : (
        <InventoryUnitMovementForm
          key={revision}
          action={action}
          companyId={companyId}
          source={source}
          destinations={warehouses.inventories}
          selectedUnits={selected}
          disabled={busy}
          onConfirm={submit}
          onRemoveUnit={(id) => setSelected((units) => units.filter((unit) => unit.id !== id))}
          selection={
            <AvailableInventoryUnitPicker
              key={revision}
              companyId={companyId}
              source={source}
              selected={selected}
              onChange={setSelected}
              disabled={busy}
            />
          }
        />
      )}
    </div>
  );
}
