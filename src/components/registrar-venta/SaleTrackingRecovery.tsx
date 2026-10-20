"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { OrderHeader } from "@/interfaces/IOrder";
import axiosAuth from "@/lib/axiosAuth";
import { canCorrectTrackingRequest, trackingError } from "@/services/inventoryTrackingService";
import {
  getSaleAssignment,
  getSaleOperation,
  hasUnitAssignment,
  type PendingSaleOperation,
  persistSaleOperation,
  retrySaleAssignment,
} from "@/services/saleTrackingService";
import { UnitAssignmentNotice } from "./SaleUnitSelection";

export function SaleAssignmentStatus({
  order,
  onRefresh,
}: {
  order: OrderHeader;
  onRefresh?: (order: OrderHeader) => void;
}) {
  const [currentOrder, setCurrentOrder] = useState(order);
  useEffect(() => setCurrentOrder(order), [order]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  if (!hasUnitAssignment(currentOrder)) return null;
  const refresh = async (retry: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (retry) await retrySaleAssignment(order.id);
      const result = await getSaleAssignment<OrderHeader>(order.id);
      if (alive.current) {
        setCurrentOrder(result);
        onRefresh?.(result);
      }
    } catch (reason) {
      if (alive.current)
        setError(trackingError(reason, "No se pudo consultar la reserva de las unidades."));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <UnitAssignmentNotice order={currentOrder} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => refresh(false)}>
          Consultar confirmación
        </Button>
        {(currentOrder.unitAssignmentStatus === "PENDING" ||
          currentOrder.unitAssignmentStatus === "REJECTED") && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => refresh(true)}>
            Reintentar reserva
          </Button>
        )}
      </div>
    </div>
  );
}

export function PendingSaleRecovery({
  operation,
  storageKey,
  onResolved,
  onCorrect,
  disabled = false,
}: {
  operation: PendingSaleOperation;
  storageKey: string;
  onResolved: (order: OrderHeader) => void;
  onCorrect: () => void;
  disabled?: boolean;
}) {
  const [retryRejected, setRetryRejected] = useState(false);
  const canCorrect = operation.definitiveRejection || retryRejected;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const recover = async () => {
    if (busy || disabled) return;
    setBusy(true);
    setError("");
    try {
      let order: OrderHeader;
      try {
        order = await getSaleOperation<OrderHeader>(operation.operationId);
      } catch (reason) {
        if ((reason as { response?: { status?: number } })?.response?.status !== 404) throw reason;
        if (!alive.current) return;
        try {
          order = (await axiosAuth[operation.method]<OrderHeader>(operation.url, operation.payload))
            .data;
        } catch (writeError) {
          if (canCorrectTrackingRequest(writeError)) {
            persistSaleOperation(storageKey, { ...operation, definitiveRejection: true });
            if (alive.current) setRetryRejected(true);
          }
          throw writeError;
        }
      }
      persistSaleOperation(storageKey, null);
      if (alive.current) onResolved(order);
    } catch (reason) {
      if (alive.current)
        setError(
          trackingError(
            reason,
            "No se pudo confirmar el resultado. Conservamos la operación para volver a consultar.",
          ),
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const correct = async () => {
    if (busy || disabled || !canCorrect) return;
    setBusy(true);
    setError("");
    try {
      const result = await getSaleOperation<OrderHeader>(operation.operationId);
      persistSaleOperation(storageKey, null);
      if (alive.current) onResolved(result);
    } catch (reason) {
      if ((reason as { response?: { status?: number } })?.response?.status === 404) {
        persistSaleOperation(storageKey, null);
        if (alive.current) onCorrect();
      } else if (alive.current)
        setError(trackingError(reason, "No se pudo comprobar si la operación fue aplicada."));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <section
      role="status"
      className="mb-4 space-y-2 rounded border border-amber-500 bg-amber-50 p-4 dark:bg-amber-950"
    >
      <h2 className="font-semibold">Venta pendiente de confirmar</h2>
      <p>
        Conservamos los datos enviados. Consulta el resultado o reintenta la misma operación; no
        vuelvas a registrar esta venta.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button type="button" disabled={busy || disabled} onClick={recover}>
        {busy ? "Consultando…" : "Consultar y recuperar venta"}
      </Button>
      {canCorrect && (
        <Button type="button" variant="outline" disabled={busy || disabled} onClick={correct}>
          Corregir datos rechazados
        </Button>
      )}
    </section>
  );
}
