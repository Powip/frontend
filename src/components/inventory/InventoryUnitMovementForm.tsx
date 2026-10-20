"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InventoryUnit } from "@/services/inventoryTrackingService";

import {
  SHRINKAGE_TYPES,
  type UnitShrinkageType,
  type InventoryUnitMovementAction,
  type InventoryUnitMovementDraft,
  type InventoryUnitMovementSource,
} from "@/services/inventoryUnitMovementService";

export function unitMovementSelectionError(
  quantity: number,
  units: InventoryUnit[],
): string | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000)
    return "La cantidad debe ser un entero entre 1 y 10000.";
  if (units.length !== quantity)
    return `Selecciona exactamente ${quantity} IMEI/series (${units.length} seleccionados).`;
  if (units.some((unit) => !unit.id || !unit.code || unit.status !== "AVAILABLE"))
    return "Sólo puedes mover o dar de baja unidades disponibles. Actualiza la selección.";
  if (new Set(units.map((unit) => unit.id.toLowerCase())).size !== units.length)
    return "Una unidad está seleccionada más de una vez.";
  return null;
}
interface Props {
  action: InventoryUnitMovementAction;
  companyId: string;
  source: InventoryUnitMovementSource;
  destinations: { id: string; name: string; storeName?: string }[];
  selectedUnits: InventoryUnit[];
  selection: ReactNode;
  disabled?: boolean;
  onRemoveUnit?: (id: string) => void;
  onConfirm: (draft: InventoryUnitMovementDraft) => void;
}
export default function InventoryUnitMovementForm({
  action,
  companyId,
  source,
  destinations,
  selectedUnits,
  selection,
  disabled,
  onConfirm,
  onRemoveUnit,
}: Props) {
  const scope = `${companyId}:${source.inventoryItemId}:${action}`;
  const [form, setForm] = useState({
    scope,
    quantity: 1,
    destination: "",
    reason: "",
    accepted: false,
    shrinkageType: "otro" as UnitShrinkageType,
    unitCost: "0",
    recoveredAmount: "0",
  });
  useEffect(
    () =>
      setForm({
        scope,
        quantity: 1,
        destination: "",
        reason: "",
        accepted: false,
        shrinkageType: "otro" as UnitShrinkageType,
        unitCost: "0",
        recoveredAmount: "0",
      }),
    [scope],
  );
  const current =
    form.scope === scope
      ? form
      : {
          scope,
          quantity: 1,
          destination: "",
          reason: "",
          accepted: false,
          shrinkageType: "otro" as UnitShrinkageType,
          unitCost: "0",
          recoveredAmount: "0",
        };
  const selectionError = unitMovementSelectionError(current.quantity, selectedUnits);
  const allowedDestinations = destinations.filter(
    (destination) => destination.id !== source.inventoryId,
  );
  const destinationValid =
    action !== "transfer" ||
    allowedDestinations.some((destination) => destination.id === current.destination);
  const moneyValid = [current.unitCost, current.recoveredAmount].every(
    (value) =>
      /^\d+(?:\.\d{1,2})?$/.test(value) &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
      Number(value) <= 9999999999.99,
  );
  const financeValid =
    action === "transfer" || (moneyValid && current.shrinkageType in SHRINKAGE_TYPES);
  const confirm = () => {
    if (
      disabled ||
      selectionError ||
      !destinationValid ||
      !financeValid ||
      !current.accepted ||
      !current.reason.trim()
    )
      return;
    onConfirm({
      quantity: current.quantity,
      unitIds: selectedUnits.map((unit) => unit.id),
      reason: current.reason.trim(),
      ...(action === "transfer"
        ? { destinationInventoryId: current.destination }
        : {
            shrinkageType: current.shrinkageType,
            unitCost: Number(current.unitCost),
            recoveredAmount: Number(current.recoveredAmount),
          }),
    });
  };
  return (
    <section
      aria-label={action === "transfer" ? "Transferencia de unidades" : "Merma de unidades"}
      className="space-y-4"
    >
      <div className="rounded border p-3 text-sm">
        <p className="font-medium">
          {source.sku} · {source.productName}
        </p>
        <p>{Object.values(source.attributes ?? {}).join(" · ")}</p>
        <p>Almacén de origen: {source.inventoryName}</p>
      </div>
      <p className="text-sm">
        {action === "transfer"
          ? "Las mismas unidades cambiarán de almacén. El stock total de la empresa se conserva."
          : "Las unidades seleccionadas se darán de baja del inventario y se registrará la merma con los importes indicados."}
      </p>
      {action === "transfer" && (
        <div className="space-y-1">
          <label htmlFor={`unit-destination-${source.inventoryItemId}`} className="text-sm">
            Almacén de destino
          </label>
          <select
            id={`unit-destination-${source.inventoryItemId}`}
            className="w-full rounded border bg-background p-2"
            disabled={disabled}
            value={current.destination}
            onChange={(event) =>
              setForm({ ...current, destination: event.target.value, accepted: false })
            }
          >
            <option value="">Selecciona un almacén de la empresa</option>
            {allowedDestinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name}
                {destination.storeName ? ` · ${destination.storeName}` : ""}
              </option>
            ))}
          </select>
          {!allowedDestinations.length && (
            <p role="alert">No hay otro almacén disponible en esta empresa.</p>
          )}
        </div>
      )}
      <div className="space-y-1">
        <label htmlFor={`unit-quantity-${source.inventoryItemId}`} className="text-sm">
          Cantidad de unidades
        </label>
        <Input
          id={`unit-quantity-${source.inventoryItemId}`}
          type="number"
          min={1}
          step={1}
          disabled={disabled}
          value={current.quantity}
          onChange={(event) =>
            setForm({ ...current, quantity: Number(event.target.value), accepted: false })
          }
        />
      </div>
      {selection}
      <ul
        aria-label="Unidades seleccionadas"
        className="max-h-36 overflow-auto rounded border p-3 text-sm"
      >
        {selectedUnits.map((unit) => (
          <li key={unit.id}>
            <code>{unit.code}</code> ·{" "}
            {unit.status === "AVAILABLE" ? "Disponible" : "No disponible"}
            {onRemoveUnit && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                aria-label={`Quitar ${unit.code}`}
                onClick={() => onRemoveUnit(unit.id)}
              >
                Quitar
              </Button>
            )}
          </li>
        ))}
        {!selectedUnits.length && <li>No hay unidades seleccionadas.</li>}
      </ul>
      {selectionError && (
        <p role="alert" className="text-sm text-destructive">
          {selectionError}
        </p>
      )}
      {action === "write-off" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-sm" htmlFor={`unit-shrinkage-type-${source.inventoryItemId}`}>
              Tipo de merma
            </label>
            <select
              id={`unit-shrinkage-type-${source.inventoryItemId}`}
              className="w-full rounded border bg-background p-2"
              disabled={disabled}
              value={current.shrinkageType}
              onChange={(event) =>
                setForm({
                  ...current,
                  shrinkageType: event.target.value as UnitShrinkageType,
                  accepted: false,
                })
              }
            >
              {Object.entries(SHRINKAGE_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm" htmlFor={`unit-cost-${source.inventoryItemId}`}>
              Costo unitario S/
            </label>
            <Input
              id={`unit-cost-${source.inventoryItemId}`}
              type="number"
              min={0}
              step="0.01"
              max="9999999999.99"
              disabled={disabled}
              value={current.unitCost}
              onChange={(event) =>
                setForm({ ...current, unitCost: event.target.value, accepted: false })
              }
            />
          </div>
          <div>
            <label className="text-sm" htmlFor={`unit-recovered-${source.inventoryItemId}`}>
              Monto recuperado S/
            </label>
            <Input
              id={`unit-recovered-${source.inventoryItemId}`}
              type="number"
              min={0}
              step="0.01"
              max="9999999999.99"
              disabled={disabled}
              value={current.recoveredAmount}
              onChange={(event) =>
                setForm({ ...current, recoveredAmount: event.target.value, accepted: false })
              }
            />
          </div>
          {!financeValid && (
            <p role="alert" className="text-sm text-destructive sm:col-span-3">
              Ingresa importes entre 0 y 9999999999.99 con hasta dos decimales.
            </p>
          )}
        </div>
      )}
      <div className="space-y-1">
        <label htmlFor={`unit-reason-${source.inventoryItemId}`} className="text-sm">
          Motivo del movimiento
        </label>
        <textarea
          id={`unit-reason-${source.inventoryItemId}`}
          className="min-h-20 w-full rounded border p-2"
          maxLength={500}
          disabled={disabled}
          value={current.reason}
          onChange={(event) => setForm({ ...current, reason: event.target.value })}
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={current.accepted}
          disabled={disabled}
          onChange={(event) => setForm({ ...current, accepted: event.target.checked })}
        />
        {action === "transfer"
          ? "Confirmo los códigos y el almacén de destino de esta transferencia."
          : "Confirmo los códigos que deben darse de baja y el registro de merma con los importes indicados."}
      </label>
      <Button
        type="button"
        disabled={
          disabled ||
          Boolean(selectionError) ||
          !destinationValid ||
          !financeValid ||
          !current.accepted ||
          !current.reason.trim()
        }
        onClick={confirm}
      >
        {action === "transfer" ? "Confirmar transferencia" : "Confirmar merma de unidades"}
      </Button>
    </section>
  );
}
