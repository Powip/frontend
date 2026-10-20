"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@/interfaces/IOrder";
import {
  getSaleUnits,
  type InventoryUnit,
  isTracked,
  trackingError,
} from "@/services/inventoryTrackingService";
import {
  hasConfirmedQuantityHold,
  unitAssignmentLabel,
  type UnitAssignmentState,
} from "@/services/saleTrackingService";

export function UnitAssignmentNotice({ order }: { order: UnitAssignmentState }) {
  const label = unitAssignmentLabel(order);
  if (!label) return null;
  return (
    <div role="status" className="rounded border bg-muted/30 p-3 text-sm">
      <p className="font-medium">{label}</p>
      {(order.unitAssignmentStatus !== "CONFIRMED" || order.confirmedStockVersion !== order.stockVersion) && (
        <p>
          {hasConfirmedQuantityHold(order)
            ? "La cantidad ya está reservada. Selecciona un IMEI/serie por unidad y guarda la venta para confirmar su asignación antes de preparar o enviar."
            : "Las unidades deben estar asignadas y confirmadas antes de preparar o enviar. Consulta el resultado de cualquier solicitud pendiente antes de volver a guardar."}
        </p>
      )}
      {order.unitAssignmentError && <p className="text-destructive">{order.unitAssignmentError}</p>}
    </div>
  );
}

interface Props {
  companyId: string;
  inventoryId: string;
  orderId?: string;
  cart: CartItem[];
  disabled?: boolean;
  onChange: (lineId: string, units: InventoryUnit[]) => void;
}
export default function SaleUnitSelection(props: Props) {
  const tracked = props.cart.filter((line) => isTracked(line.trackingMode));
  if (!tracked.length) return null;
  return (
    <section aria-label="Selección de IMEI y series" className="mt-4 space-y-4 border-t pt-4">
      <h3 className="font-semibold">IMEI / series de la venta</h3>
      <p className="text-sm text-muted-foreground">
        Selecciona una unidad por cantidad vendida. La disponibilidad se confirma al guardar la
        venta.
      </p>
      {tracked.map((line) => (
        <SaleUnitLine
          key={`${props.companyId}:${props.inventoryId}:${props.orderId || "new"}:${line.id}`}
          {...props}
          line={line}
          excludedIds={
            new Set(
              props.cart
                .filter((other) => other.id !== line.id)
                .flatMap((other) => other.unitIds ?? []),
            )
          }
        />
      ))}
    </section>
  );
}
function SaleUnitLine({
  companyId,
  inventoryId,
  orderId,
  line,
  excludedIds,
  onChange,
  disabled,
}: Props & { line: CartItem; excludedIds: Set<string> }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<InventoryUnit[]>([]);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestKey = JSON.stringify([
    companyId,
    inventoryId,
    orderId,
    line.variantId,
    page,
    q,
    refresh,
  ]);
  const currentRequest = useRef(requestKey);
  currentRequest.current = requestKey;
  const selectedIds = line.unitIds ?? [];
  useEffect(() => {
    const controller = new AbortController();
    setRows([]);
    setLoading(true);
    setError("");
    if (!companyId || !inventoryId) {
      setLoading(false);
      return;
    }
    const timeout = setTimeout(
      () => {
        getSaleUnits(
          { variantId: line.variantId, inventoryId, orderId, page, limit: 20, q: q || undefined },
          controller.signal,
        )
          .then((result) => {
            if (controller.signal.aborted || currentRequest.current !== requestKey) return;
            if (result.variantId !== line.variantId || result.inventoryId !== inventoryId)
              throw new Error("La respuesta no corresponde al producto y almacén seleccionados.");
            setRows(
              result.data.filter(
                (unit) => unit.status === "AVAILABLE" || unit.status === "RESERVED",
              ),
            );
            setPages(Math.max(1, result.meta.totalPages));
          })
          .catch((reason) => {
            if (!controller.signal.aborted && currentRequest.current === requestKey)
              setError(trackingError(reason, "No se pudieron consultar las unidades."));
          })
          .finally(() => {
            if (!controller.signal.aborted && currentRequest.current === requestKey)
              setLoading(false);
          });
      },
      q ? 250 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [companyId, inventoryId, orderId, line.variantId, page, q, requestKey]);
  const selectedUnits = selectedIds.map(
    (id) =>
      line.units?.find((unit) => unit.id === id) ??
      rows.find((unit) => unit.id === id) ?? { id, code: id, status: "RESERVED" as const },
  );
  const toggle = (unit: InventoryUnit, checked: boolean) => {
    const next = checked
      ? [...selectedUnits, unit]
      : selectedUnits.filter((entry) => entry.id !== unit.id);
    onChange(line.id, next);
  };
  return (
    <fieldset disabled={disabled} className="space-y-2 rounded border p-3">
      <legend className="px-1 font-medium">
        {line.sku} · {Object.values(line.attributes ?? {}).join(" · ") || line.productName}
        {line.isGift ? " · Regalo" : ""}
      </legend>
      <p>
        {selectedIds.length} de {line.quantity} unidades seleccionadas
      </p>
      {selectedUnits.length > 0 && (
        <ul aria-label={`Unidades seleccionadas ${line.sku}`} className="space-y-1">
          {selectedUnits.map((unit) => (
            <li key={unit.id} className="flex items-center gap-2 text-sm">
              <code>{unit.code}</code>
              <span>
                {unit.status === "RESERVED" ? "Reservada para esta venta" : "Seleccionada"}
              </span>
              <button
                type="button"
                className="underline"
                aria-label={`Quitar ${unit.code}`}
                onClick={() => toggle(unit, false)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="block text-sm" htmlFor={`units-${line.id}`}>
        Buscar {line.trackingMode === "IMEI" ? "IMEI" : "serie"}
      </label>
      <input
        id={`units-${line.id}`}
        className="h-9 w-full rounded border px-3"
        value={q}
        maxLength={200}
        onChange={(event) => {
          setQ(event.target.value);
          setPage(1);
        }}
      />
      {loading && <p role="status">Consultando unidades disponibles…</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p>No hay unidades disponibles para esta búsqueda.</p>
      )}
      {!loading && !error && (
        <ul className="max-h-52 space-y-1 overflow-y-auto">
          {rows.map((unit) => {
            const checked = selectedIds.includes(unit.id);
            const excluded = excludedIds.has(unit.id);
            return (
              <li key={unit.id}>
                <label className="flex items-center gap-2 rounded p-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={
                      disabled || (!checked && (excluded || selectedIds.length >= line.quantity))
                    }
                    onChange={(event) => toggle(unit, event.target.checked)}
                  />
                  <code>{unit.code}</code>
                  <span className="text-xs">
                    {excluded
                      ? "Seleccionada en otra línea"
                      : unit.status === "RESERVED"
                        ? "Reservada para esta venta"
                        : "Disponible"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRefresh((value) => value + 1)}
          disabled={loading}
        >
          Actualizar disponibilidad
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Anterior
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page >= pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Siguiente
        </Button>
      </div>
    </fieldset>
  );
}
