"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDay } from "@/lib/purchaseOrders";
import { COUNT_STATUS_LABEL, opsErrorMessage } from "@/lib/warehouseOps";
import {
  createReconciliation,
  type CourierReconciliation,
  type CourierWarehouse,
  type ReconciliationBasis,
  type ReconciliationSource,
} from "@/services/sharedCourierService";
import { listCounts } from "@/services/warehouseOpsService";
import { ErrorBox, SELECT_CLASS } from "../../warehouse-ops/OpsBits";

// FEAT-24 H8-D3 — nueva conciliación de un almacén courier: con lo que leyó la
// API de Aliclik (compara con el disponible de POWIP, o con el físico) o con un
// conteo del almacén (lo que cargó el courier en el portal o alguien de tu
// equipo; compara con lo esperado del conteo). A lo sumo una abierta por almacén.

interface Props {
  warehouse: CourierWarehouse;
  /** Último conteo por validar o aplicado (sugerido). */
  lastCountId?: string | null;
  onClose: () => void;
  onCreated: (reconciliation: CourierReconciliation) => void;
}

export default function NewReconciliationDialog({ warehouse, lastCountId, onClose, onCreated }: Props) {
  const apiReady = warehouse.syncMode === "api" && warehouse.courierProvider === "aliclik";
  const [source, setSource] = useState<ReconciliationSource>(apiReady ? "api" : "conteo");
  const [basis, setBasis] = useState<ReconciliationBasis>("disponible");
  const [countId, setCountId] = useState(lastCountId ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countsQuery = useQuery({
    queryKey: ["courier-counts", warehouse.id],
    queryFn: ({ signal }) => listCounts({ inventoryId: warehouse.id }, signal),
    enabled: source === "conteo",
    retry: false,
  });
  const counts = (countsQuery.data ?? []).filter((count) => count.status === "por_validar" || count.status === "aplicado");
  const missingCount = source === "conteo" && !countId;

  const create = async () => {
    if (busy || missingCount) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createReconciliation({
        inventoryId: warehouse.id,
        source,
        ...(source === "conteo" ? { countId, basis: "fisico" as const } : { basis }),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onCreated(created);
    } catch (failure) {
      setError(opsErrorMessage(failure, "No se pudo crear la conciliación."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva conciliación · {warehouse.name}</DialogTitle>
          <DialogDescription>POWIP toma una foto de su stock y la compara con lo que reporta el courier. Las diferencias se explican o se reclaman.</DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">¿Qué reporta el courier?</legend>
          <label className={`flex items-start gap-2 rounded-md border p-3 text-sm ${apiReady ? "" : "opacity-60"}`}>
            <input type="radio" name="rec-source" value="api" checked={source === "api"} disabled={!apiReady || busy} onChange={() => setSource("api")} />
            <span>
              <b>Stock por API de Aliclik</b>
              <span className="block text-xs text-muted-foreground">
                {apiReady ? "Lo último que leyó POWIP (cada 5 minutos)." : "Solo para almacenes de Aliclik con sincronización por API (en la ficha del almacén)."}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <input type="radio" name="rec-source" value="conteo" checked={source === "conteo"} disabled={busy} onChange={() => setSource("conteo")} />
            <span>
              <b>Un conteo del almacén</b>
              <span className="block text-xs text-muted-foreground">Lo que contó el courier en el portal o lo que cargó tu equipo. Compara con lo esperado del conteo.</span>
            </span>
          </label>
        </fieldset>

        {source === "api" ? (
          <div className="space-y-1">
            <Label htmlFor="rec-basis">Comparar con</Label>
            <select id="rec-basis" className={SELECT_CLASS} value={basis} disabled={busy} onChange={(event) => setBasis(event.target.value as ReconciliationBasis)}>
              <option value="disponible">El disponible de POWIP (físico − reservado)</option>
              <option value="fisico">El físico de POWIP</option>
            </select>
            <p className="text-xs text-muted-foreground">Aliclik suele descontar lo que ya reservó para pedidos: por eso se compara con el disponible.</p>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="rec-count">Conteo</Label>
            <select id="rec-count" className={SELECT_CLASS} value={countId} disabled={busy || countsQuery.isPending} onChange={(event) => setCountId(event.target.value)}>
              <option value="">{countsQuery.isPending ? "Cargando conteos…" : "Elige el conteo"}</option>
              {counts.map((count) => (
                <option key={count.id} value={count.id}>
                  {count.number} · {COUNT_STATUS_LABEL[count.status] ?? count.status} · {formatDay(count.closedAt ?? count.createdAt)}
                </option>
              ))}
            </select>
            {countsQuery.isSuccess && counts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay conteos cerrados de este almacén: el courier cuenta en el portal o tu equipo arma uno en Inventario › Conteos.</p>
            ) : null}
            {countsQuery.isError ? <ErrorBox>{opsErrorMessage(countsQuery.error, "No se pudieron cargar los conteos.")}</ErrorBox> : null}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="rec-notes">Notas (opcional)</Label>
          <Textarea id="rec-notes" value={notes} maxLength={2000} disabled={busy} onChange={(event) => setNotes(event.target.value)} />
        </div>

        <ErrorBox>{error}</ErrorBox>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Volver
          </Button>
          <Button type="button" disabled={busy || missingCount} onClick={() => void create()}>
            {busy ? "Creando…" : "Crear conciliación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
