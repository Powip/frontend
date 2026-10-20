"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trackingError } from "@/services/inventoryTrackingService";
import {
  getInventoryUnitTrace,
  trimUnitTraceCode,
  validUnitTraceCode,
  validateInventoryUnitTrace,
  type InventoryUnitTraceResponse,
} from "@/services/inventoryUnitTraceService";

const STATUS = {
  AVAILABLE: "Disponible",
  RESERVED: "Reservada",
  SOLD: "Vendida",
  WRITTEN_OFF: "Dada de baja",
};
const MOVEMENT: Record<string, string> = {
  IN: "Ingreso",
  OUT: "Salida",
  RESERVED: "Reserva",
  RELEASED: "Liberación de reserva",
  COMMITTED: "Salida por venta",
  ADJUSTMENT: "Ajuste",
  TRANSFER: "Transferencia",
};
const date = (value: string) =>
  Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("es-PE")
    : "Fecha no disponible";
const reasonLabel = (reason: string | null) => {
  if (!reason) return "Sin motivo registrado";
  const saleReason = /^order\.(created|updated|cancelled|delivered|returned|reactivated):\d+$/.exec(
    reason,
  );
  if (saleReason) {
    const labels: Record<string, string> = {
      created: "Reserva por venta",
      updated: "Actualización de venta",
      cancelled: "Anulación de venta",
      delivered: "Entrega de venta",
      returned: "Devolución de venta",
      reactivated: "Reactivación de venta",
    };
    return labels[saleReason[1]];
  }
  if (reason === "UNIT_REGULARIZATION") return "Asociación de códigos al stock existente";
  const prefixes: Record<string, string> = {
    "UNIT_TRANSFER_OUT - ": "Transferencia de salida: ",
    "UNIT_TRANSFER_IN - ": "Transferencia de ingreso: ",
    "SHRINKAGE - ": "Merma: ",
    "PURCHASE - ": "Compra: ",
    "PURCHASE_CANCELLED - ": "Anulación de compra: ",
  };
  for (const [prefix, label] of Object.entries(prefixes))
    if (reason.startsWith(prefix)) return label + reason.slice(prefix.length);
  return reason;
};
interface Props {
  companyId: string;
  initialCode?: string;
  onClose: () => void;
}
export default function InventoryUnitTraceModal({ companyId, initialCode = "", onClose }: Props) {
  const { auth } = useAuth();
  const userId = auth?.user?.id ?? "";
  const authorized = Boolean(companyId && userId && auth?.company?.id === companyId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar IMEI / serie</DialogTitle>
          <DialogDescription>
            Búsqueda exacta en toda la empresa, independientemente del almacén seleccionado.
          </DialogDescription>
        </DialogHeader>
        {authorized ? (
          <TraceContent
            key={`${companyId}:${userId}:${initialCode}`}
            companyId={companyId}
            initialCode={initialCode}
          />
        ) : (
          <p role="alert">La sesión no permite consultar este inventario.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
function TraceContent({ companyId, initialCode }: { companyId: string; initialCode: string }) {
  const [input, setInput] = useState(initialCode);
  const [query, setQuery] = useState({
    code: validUnitTraceCode(initialCode) ? trimUnitTraceCode(initialCode) : "",
    page: 1,
    revision: 0,
  });
  const [result, setResult] = useState<InventoryUnitTraceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError("");
    setNotFound(false);
    if (!query.code) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    getInventoryUnitTrace(query.code, query.page, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        validateInventoryUnitTrace(response, companyId, query.code, query.page);
        setResult(response);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if ((reason as { response?: { status?: number } }).response?.status === 404)
          setNotFound(true);
        else
          setError(trackingError(reason, "No se pudo consultar el historial. Inténtalo otra vez."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [companyId, query]);
  return (
    <div className="space-y-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (validUnitTraceCode(input))
            setQuery((previous) => ({
              code: trimUnitTraceCode(input),
              page: 1,
              revision: previous.revision + 1,
            }));
        }}
      >
        <div className="flex-1">
          <label className="text-sm" htmlFor="unit-trace-code">
            IMEI o serie exacto
          </label>
          <Input
            id="unit-trace-code"
            type="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Escribe o escanea el código completo"
          />
        </div>
        <Button type="submit" disabled={!validUnitTraceCode(input)}>
          Buscar código
        </Button>
      </form>
      {input && !validUnitTraceCode(input) && (
        <p role="alert" className="text-sm text-destructive">
          Usa el código completo: hasta 100 letras, números, puntos, guiones, barras o guiones
          bajos.
        </p>
      )}
      {loading && <p role="status">Consultando código y movimientos…</p>}
      {notFound && (
        <p role="status">
          No se encontró este código en la empresa actual. Revisa que esté completo.
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-2">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={() =>
              setQuery((previous) => ({ ...previous, revision: previous.revision + 1 }))
            }
          >
            Reintentar consulta
          </Button>
        </div>
      )}
      {!loading && result && (
        <>
          <section
            aria-label="Estado y ubicación actuales"
            className="space-y-2 rounded border p-4"
          >
            <h3 className="font-semibold">
              <code>{result.unit.code}</code> · {STATUS[result.unit.status]}
            </h3>
            {result.product ? (
              <p>
                {result.product.sku} · {result.product.name}
                {Object.values(result.product.attributes ?? {}).length
                  ? ` · ${Object.values(result.product.attributes).join(" · ")}`
                  : ""}
              </p>
            ) : (
              <p className="text-sm">Variante: {result.unit.variantId}</p>
            )}
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Ubicación actual</dt>
                <dd>{result.unit.inventory.name || result.unit.inventory.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Seguimiento</dt>
                <dd>{result.unit.trackingMode === "IMEI" ? "IMEI" : "Número de serie"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Registrada</dt>
                <dd>{date(result.unit.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Última actualización</dt>
                <dd>{date(result.unit.updatedAt)}</dd>
              </div>
            </dl>
            <div className="space-y-1 text-sm">
              {result.unit.purchase ? (
                <p>
                  Compra de origen:{" "}
                  <Link
                    className="underline"
                    href={`/registrar-compra?edit=${encodeURIComponent(result.unit.purchase.id)}&tracked=1`}
                  >
                    {result.unit.purchase.id}
                  </Link>
                </p>
              ) : (
                <p>Sin compra de origen vinculada.</p>
              )}
              {result.unit.reservedOrderId && (
                <p>
                  Pedido con reserva:{" "}
                  <Link
                    className="underline"
                    href={`/registrar-venta?orderId=${encodeURIComponent(result.unit.reservedOrderId)}`}
                  >
                    {result.unit.reservedOrderId}
                  </Link>
                </p>
              )}
              {result.unit.soldOrderId && (
                <p>
                  Pedido de venta:{" "}
                  <Link
                    className="underline"
                    href={`/registrar-venta?orderId=${encodeURIComponent(result.unit.soldOrderId)}`}
                  >
                    {result.unit.soldOrderId}
                  </Link>
                </p>
              )}
            </div>
          </section>
          <section aria-label="Historial de movimientos de esta unidad" className="space-y-2">
            <h3 className="font-semibold">Movimientos de esta unidad</h3>
            <p className="text-sm text-muted-foreground">
              Los registros muestran los movimientos realizados. El estado y la ubicación de arriba
              corresponden a la situación actual.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Movimientos vinculados al IMEI o serie consultado
                </caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="p-2">
                      Fecha
                    </th>
                    <th scope="col" className="p-2">
                      Movimiento
                    </th>
                    <th scope="col" className="p-2">
                      Almacén del movimiento
                    </th>
                    <th scope="col" className="p-2">
                      Efecto físico de esta unidad
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((entry) => (
                    <tr key={entry.movementId} className="border-b align-top">
                      <td className="p-2 whitespace-nowrap">{date(entry.createdAt)}</td>
                      <td className="p-2">
                        <p className="font-medium">{MOVEMENT[entry.type] ?? entry.type}</p>
                        <p>{reasonLabel(entry.reason)}</p>
                        <p className="text-xs text-muted-foreground">
                          Unidades de este código en el registro: {entry.quantity}
                        </p>
                        {entry.movementQuantity !== entry.quantity && (
                          <p className="text-xs text-muted-foreground">
                            Movimiento completo: {entry.movementQuantity} unidades
                          </p>
                        )}
                        {entry.referenceId && (
                          <p className="break-all text-xs">Referencia: {entry.referenceId}</p>
                        )}
                      </td>
                      <td className="p-2">
                        {entry.inventory.name || entry.inventory.id}
                        {entry.transfer && (
                          <p className="mt-1 text-xs">
                            {entry.transfer.sourceInventory.name ||
                              entry.transfer.sourceInventory.id}{" "}
                            →{" "}
                            {entry.transfer.destinationInventory.name ||
                              entry.transfer.destinationInventory.id}
                          </p>
                        )}
                      </td>
                      <td className="p-2">
                        {entry.physicalDelta === 0
                          ? "Sin cambio (0)"
                          : entry.physicalDelta > 0
                            ? "+1"
                            : "−1"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!result.data.length && (
              <p>No hay movimientos vinculados registrados para esta unidad.</p>
            )}
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={query.page <= 1}
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page - 1 }))}
              >
                Movimientos anteriores
              </Button>
              <span className="text-sm">
                Página {query.page} de {Math.max(1, result.meta.totalPages)} · {result.meta.total}{" "}
                movimientos
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={query.page >= result.meta.totalPages}
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page + 1 }))}
              >
                Más movimientos
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
