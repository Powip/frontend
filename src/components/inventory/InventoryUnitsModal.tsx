"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getInventoryUnits,
  trackingError,
  type InventoryUnit,
} from "@/services/inventoryTrackingService";

const STATUS = {
  AVAILABLE: "Disponible",
  RESERVED: "Reservada",
  SOLD: "Vendida",
  WRITTEN_OFF: "Dada de baja",
};
export default function InventoryUnitsModal({
  inventoryItemId,
  productName,
  companyId,
  onClose,
  onViewHistory,
}: {
  inventoryItemId: string;
  productName: string;
  companyId: string;
  onClose: () => void;
  onViewHistory?: (code: string) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    data: InventoryUnit[];
    meta: { total: number; totalPages: number };
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const currentRequest = useRef("");
  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    const requestId = JSON.stringify([companyId, inventoryItemId, page, q, retry]);
    currentRequest.current = requestId;
    const isCurrent = () => !controller.signal.aborted && currentRequest.current === requestId;
    setLoading(true);
    setError("");
    setData(null);
    const timeout = setTimeout(
      () => {
        getInventoryUnits(inventoryItemId, page, q, controller.signal)
          .then((result) => {
            if (isCurrent()) setData(result);
          })
          .catch((err) => {
            if (isCurrent()) setError(trackingError(err, "No se pudieron consultar las unidades."));
          })
          .finally(() => {
            if (isCurrent()) setLoading(false);
          });
      },
      q ? 250 : 0,
    );
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [inventoryItemId, companyId, page, q, retry]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unidades · {productName}</DialogTitle>
          <DialogDescription>
            Consulta el IMEI o la serie y el estado de cada unidad.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Buscar IMEI o serie"
          placeholder="Buscar IMEI o serie"
          value={q}
          maxLength={200}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
        {error ? (
          <div role="alert">
            {error}
            <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
              Reintentar
            </Button>
          </div>
        ) : null}
        {loading ? (
          <p role="status">Cargando unidades…</p>
        ) : data ? (
          <>
            <p>{data.meta.total} unidades</p>
            <ul className="divide-y max-h-80 overflow-auto">
              {data.data.map((unit) => (
                <li key={unit.id} className="py-2 flex justify-between gap-4">
                  <span className="font-mono break-all">{unit.code}</span>
                  <span>{STATUS[unit.status] ?? unit.status}</span>
                  {onViewHistory && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Ver historial de ${unit.code}`}
                      onClick={() => onViewHistory(unit.code)}
                    >
                      Ver historial
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {!data.data.length ? <p>No hay unidades para esta búsqueda.</p> : null}
            <div className="flex justify-between">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {page} de {Math.max(1, data.meta.totalPages)}
              </span>
              <Button
                variant="outline"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
