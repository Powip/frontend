"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isTracked, trackingError, type InventoryUnit } from "@/services/inventoryTrackingService";
import {
  getAvailableInventoryUnits,
  type AvailableInventoryUnitsResponse,
  type InventoryUnitMovementSource,
} from "@/services/inventoryUnitMovementService";

export default function AvailableInventoryUnitPicker({
  companyId,
  source,
  selected,
  disabled,
  onChange,
}: {
  companyId: string;
  source: InventoryUnitMovementSource;
  selected: InventoryUnit[];
  disabled?: boolean;
  onChange: (units: InventoryUnit[]) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<AvailableInventoryUnitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry refreshes current availability without changing the query.
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setLoading(true);
    setError("");
    const timeout = setTimeout(
      () => {
        getAvailableInventoryUnits(source.inventoryItemId, page, q, controller.signal)
          .then((data) => {
            if (controller.signal.aborted) return;
            if (
              data.inventoryItemId !== source.inventoryItemId ||
              data.inventoryId !== source.inventoryId ||
              data.variantId !== source.variantId ||
              !isTracked(data.trackingMode) ||
              !Array.isArray(data.data) ||
              data.meta?.page !== page ||
              !Number.isSafeInteger(data.meta.totalPages) ||
              data.meta.totalPages < 0 ||
              data.data.some((unit) => !unit.id || !unit.code || unit.status !== "AVAILABLE") ||
              new Set(data.data.map((unit) => unit.id.toLowerCase())).size !== data.data.length
            )
              throw new Error(
                "La respuesta no contiene unidades disponibles de este producto y almacén.",
              );
            setResult(data);
          })
          .catch((reason) => {
            if (!controller.signal.aborted)
              setError(trackingError(reason, "No se pudieron consultar las unidades disponibles."));
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      q ? 250 : 0,
    );
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [companyId, source.inventoryItemId, source.inventoryId, source.variantId, page, q, retry]);
  return (
    <section aria-label="Seleccionar unidades disponibles" className="space-y-2">
      <Input
        aria-label="Buscar código disponible"
        placeholder="Buscar IMEI o serie disponible"
        maxLength={200}
        value={q}
        disabled={disabled}
        onChange={(event) => {
          setQ(event.target.value);
          setPage(1);
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Consultando unidades disponibles…</p>
      ) : (
        result && (
          <>
            <p className="text-sm">
              {result.meta.total} unidades disponibles · {selected.length} seleccionadas
            </p>
            <ul className="max-h-52 overflow-auto divide-y rounded border p-2">
              {result.data.map((unit) => {
                const checked = selected.some((entry) => entry.id === unit.id);
                return (
                  <li key={unit.id}>
                    <label className="flex items-center gap-2 py-2">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={checked}
                        onChange={(event) =>
                          onChange(
                            event.target.checked
                              ? [...selected.filter((entry) => entry.id !== unit.id), unit]
                              : selected.filter((entry) => entry.id !== unit.id),
                          )
                        }
                      />
                      <code>{unit.code}</code>
                      <span className="text-xs">Disponible</span>
                    </label>
                  </li>
                );
              })}
              {!result.data.length && <li>No hay unidades disponibles para esta búsqueda.</li>}
            </ul>
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm">
                Página {page} de {Math.max(1, result.meta.totalPages)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || page >= result.meta.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </Button>
            </div>
          </>
        )
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={disabled || loading}
        onClick={() => setRetry((value) => value + 1)}
      >
        Actualizar disponibles
      </Button>
    </section>
  );
}
