"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CartItem, OrderHeader } from "@/interfaces/IOrder";
import { canCorrectTrackingRequest, trackingError } from "@/services/inventoryTrackingService";
import {
  getSaleAssignment,
  getSaleOperation,
  retrySaleAssignment,
} from "@/services/saleTrackingService";
import {
  getSaleUnitLifecycleContext,
  lifecycleStorageKey,
  persistLifecycleOperation,
  readLifecycleOperation,
  submitSaleUnitLifecycle,
  type PendingLifecycleOperation,
  type SaleUnitLifecycleAction,
  type SaleUnitLifecycleContext,
  type SaleUnitLifecycleDraft,
  type SaleUnitLifecycleOperation,
  type SaleUnitLifecycleResponse,
} from "@/services/saleUnitLifecycleService";
import SaleUnitSelection from "./SaleUnitSelection";
import SaleUnitLifecycleForm, { lifecycleCart } from "./SaleUnitLifecycleForm";

interface Props {
  open: boolean;
  orderId: string;
  action: SaleUnitLifecycleAction;
  onClose: () => void;
  onUpdated?: (order: OrderHeader) => void;
}
export default function SaleUnitLifecycleModal(props: Props) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const userId = auth?.user?.id ?? "";
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {props.action === "return" ? "Retorno físico / devolución completa" : "Reactivar venta"}
          </DialogTitle>
        </DialogHeader>
        {props.open && companyId && userId ? (
          <LifecycleEditor
            key={`${companyId}:${userId}:${props.orderId}:${props.action}`}
            {...props}
            companyId={companyId}
            userId={userId}
          />
        ) : (
          <p role="alert">Selecciona una empresa e inicia sesión para gestionar las unidades.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LifecycleEditor({
  orderId,
  action,
  onUpdated,
  onClose,
  companyId,
  userId,
}: Props & { companyId: string; userId: string }) {
  const storageKey = lifecycleStorageKey(companyId, userId, orderId);
  const [pending, setPending] = useState(() => readLifecycleOperation(storageKey, orderId));
  const [operation, setOperation] = useState<SaleUnitLifecycleOperation | null>(null);
  const [context, setContext] = useState<SaleUnitLifecycleContext | null>(null);
  const [order, setOrder] = useState<OrderHeader | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [confirmed, setConfirmed] = useState<{
    kind: SaleUnitLifecycleAction;
    stockVersion: number;
    historical: boolean;
    currentStatus: string;
  } | null>(null);
  const alive = useRef(true);
  const working = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh deliberately reloads the authoritative snapshot after recovery or user refresh.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setContext(null);
    setOrder(null);
    Promise.all([
      getSaleUnitLifecycleContext(orderId, controller.signal),
      getSaleAssignment<OrderHeader>(orderId, controller.signal),
    ])
      .then(([result, header]) => {
        if (controller.signal.aborted) return;
        if (result.orderId !== orderId || header.id !== orderId)
          throw new Error("La respuesta no corresponde a esta venta.");
        const snapshot = {
          ...header,
          status: result.status,
          inventoryId: result.inventoryId ?? header.inventoryId,
          stockVersion: result.stockVersion ?? header.stockVersion,
          items: result.items.map((item) => ({
            ...header.items.find((original) => original.id === item.orderItemId),
            ...item,
            id: item.orderItemId,
          })),
        } as OrderHeader;
        setContext(result);
        setConfirmed((previous) =>
          previous?.historical ? { ...previous, currentStatus: result.status } : previous,
        );
        setOrder(snapshot);
        setCart(lifecycleCart(snapshot));
        const active = result.operations
          .filter((entry) => entry.status === "PENDING")
          .sort((a, b) => b.stockVersion - a.stockVersion)[0];
        if (active) {
          setOperation(active);
          if (!readLifecycleOperation(storageKey, orderId)) {
            const restored = { orderId, kind: active.kind, operationId: active.operationId };
            persistLifecycleOperation(storageKey, restored);
            setPending(restored);
          }
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(trackingError(reason, "No se pudo consultar la entrega y sus unidades."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [orderId, storageKey, refresh]);

  const savePending = (value: PendingLifecycleOperation) => {
    persistLifecycleOperation(storageKey, value);
    if (alive.current) setPending(value);
  };
  const acceptResponse = (
    result: SaleUnitLifecycleResponse,
    expected: PendingLifecycleOperation,
  ) => {
    const receipt = result.unitLifecycleOperation;
    if (
      result.id !== orderId ||
      receipt?.operationId !== expected.operationId ||
      receipt.kind !== expected.kind
    )
      throw new Error(
        "No se pudo comprobar la respuesta de esta operación. Conservamos su identificador.",
      );
    if (!alive.current) return;
    setOperation(receipt);
    if (receipt.status === "CONFIRMED") {
      persistLifecycleOperation(storageKey, null);
      setPending(null);
      const historical =
        result.stockVersion !== receipt.stockVersion ||
        result.confirmedStockVersion !== receipt.stockVersion ||
        result.status !== (receipt.kind === "return" ? "ANULADO" : "PENDIENTE");
      setConfirmed({
        kind: receipt.kind,
        stockVersion: receipt.stockVersion,
        historical,
        currentStatus: result.status,
      });
      if (historical) setRefresh((value) => value + 1);
      onUpdated?.(result);
    }
  };
  const write = async (value: PendingLifecycleOperation) => {
    if (!value.request)
      throw new Error("Consulta el resultado de la operación guardada en el servidor.");
    try {
      return await submitSaleUnitLifecycle(orderId, value.kind, value.request);
    } catch (reason) {
      if (canCorrectTrackingRequest(reason)) savePending({ ...value, definitiveRejection: true });
      throw reason;
    }
  };
  const run = async (task: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (reason) {
      if (alive.current)
        setError(
          trackingError(
            reason,
            "No se pudo confirmar el resultado. Conservamos la operación para reintentar.",
          ),
        );
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const submit = (draft: SaleUnitLifecycleDraft) =>
    run(async () => {
      if (!context || pending) return;
      const operationId = crypto.randomUUID();
      const value = {
        orderId,
        operationId,
        kind: action,
        request: { ...draft, operationId, expectedStockVersion: context.expectedStockVersion },
      };
      savePending(value);
      acceptResponse(await write(value), value);
    });
  const recover = (retry: boolean) =>
    run(async () => {
      if (!pending) return;
      let result: SaleUnitLifecycleResponse;
      try {
        result = await getSaleOperation<SaleUnitLifecycleResponse>(pending.operationId);
        if (!alive.current) return;
        if (retry && result.unitLifecycleOperation?.status === "PENDING") {
          await retrySaleAssignment(orderId);
          if (!alive.current) return;
          result = await getSaleOperation<SaleUnitLifecycleResponse>(pending.operationId);
        }
      } catch (reason) {
        if (
          (reason as { response?: { status?: number } })?.response?.status !== 404 ||
          !pending.request
        )
          throw reason;
        if (!alive.current) return;
        result = await write(pending);
      }
      acceptResponse(result, pending);
    });
  const correct = () =>
    run(async () => {
      if (!pending) return;
      let safe = false;
      try {
        const result = await getSaleOperation<SaleUnitLifecycleResponse>(pending.operationId);
        acceptResponse(result, pending);
        safe = ["REJECTED", "ABORTED"].includes(result.unitLifecycleOperation.status);
      } catch (reason) {
        if (
          (reason as { response?: { status?: number } })?.response?.status === 404 &&
          pending.definitiveRejection
        )
          safe = true;
        else throw reason;
      }
      if (alive.current && safe) {
        persistLifecycleOperation(storageKey, null);
        setPending(null);
        setOperation(null);
        setRefresh((value) => value + 1);
      }
    });
  const canCorrect =
    pending &&
    (pending.definitiveRejection ||
      operation?.status === "REJECTED" ||
      operation?.status === "ABORTED");
  if (confirmed)
    return (
      <div role="status" className="space-y-3">
        <p>
          {confirmed.historical
            ? `La ${confirmed.kind === "return" ? "devolución" : "reactivación"} de la versión ${confirmed.stockVersion} fue confirmada. La venta avanzó a otro estado o ciclo; su estado actual es ${confirmed.currentStatus}.`
            : confirmed.kind === "return"
              ? "Devolución completa confirmada. Las unidades regresaron al inventario."
              : "Nueva reserva confirmada. La venta está reactivada."}
        </p>
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
          aria-label="Operación de unidades pendiente"
          className="space-y-3 rounded border p-3"
        >
          <p className="font-medium">
            {pending.kind === "return" ? "Devolución" : "Reactivación"}:{" "}
            {operation?.status === "REJECTED"
              ? "solicitud rechazada"
              : "resultado pendiente de confirmar"}
          </p>
          <p className="text-sm">
            Conservamos la misma solicitud. Consulta su resultado antes de iniciar otra operación.
          </p>
          {operation?.error && <p role="alert">{operation.error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => recover(false)}>
              Consultar resultado
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => recover(true)}>
              Reintentar misma operación
            </Button>
            {canCorrect && (
              <Button variant="outline" disabled={busy} onClick={correct}>
                Revisar solicitud rechazada
              </Button>
            )}
          </div>
        </section>
      ) : loading ? (
        <p role="status">Consultando las unidades de la venta…</p>
      ) : context && order ? (
        (action === "return"
          ? context.canReturn && (context.status !== "EN_ENVIO" || context.requiresPhysicalReturnConfirmation === true)
          : context.canReactivate) ? (
          <SaleUnitLifecycleForm
            action={action}
            companyId={companyId}
            order={order}
            cart={cart}
            disabled={busy}
            onConfirm={submit}
            selection={
              <SaleUnitSelection
                companyId={companyId}
                inventoryId={order.inventoryId ?? ""}
                orderId={orderId}
                cart={cart}
                disabled={busy}
                onChange={(lineId, units) =>
                  setCart((lines) =>
                    lines.map((line) =>
                      line.id === lineId
                        ? { ...line, units, unitIds: units.map((unit) => unit.id) }
                        : line,
                    ),
                  )
                }
              />
            }
          />
        ) : (
          <p role="status">
            {action === "return"
              ? "Esta venta todavía no permite una devolución completa de sus unidades."
              : "Esta venta todavía no permite una nueva reserva de unidades."}
          </p>
        )
      ) : null}
      {!loading && !pending && (
        <Button variant="outline" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>
          Actualizar información
        </Button>
      )}
    </div>
  );
}
