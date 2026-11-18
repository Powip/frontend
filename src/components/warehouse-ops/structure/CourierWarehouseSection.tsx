"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import {
  aliclikMapErrorMessage,
  courierAccess,
  COURIER_PROVIDER_LABEL,
  COURIER_PROVIDERS,
  COURIER_SYNC_MODES,
  SYNC_MODE_HELP,
  SYNC_MODE_LABEL,
} from "@/lib/courier";
import { opsErrorMessage } from "@/lib/warehouseOps";
import { getAliclikMap, saveAliclikMap, type CourierProvider, type CourierSyncMode } from "@/services/sharedCourierService";
import { updateWarehouseDetails, type WarehouseDetails, type WarehouseDetailsPatch } from "@/services/warehouseOpsService";
import { ErrorBox, SELECT_CLASS } from "../OpsBits";

// FEAT-24 H8-D1 — datos del courier en la ficha de un almacén COURIER: qué
// courier es, cómo llega su stock (API, portal o carga manual) y el costo
// mensual de almacenaje (gasto logístico, no va al costo del producto; oculto
// sin rol de costos). Si es Aliclik, qué almacenes de Aliclik suman a este
// almacén de POWIP (el mapa que antes se llenaba a mano).

interface CourierForm {
  courierProvider: CourierProvider | "";
  syncMode: CourierSyncMode | "";
  storageCostMonth: string;
}

const formFrom = (details: Partial<WarehouseDetails> | undefined): CourierForm => ({
  courierProvider: details?.courierProvider ?? "",
  syncMode: details?.syncMode ?? "",
  storageCostMonth: details?.storageCostMonth === null || details?.storageCostMonth === undefined ? "" : String(details.storageCostMonth),
});

/** Por qué no se puede guardar (o null). Las mismas reglas que la fachada y logistics. */
export function courierFormProblem(form: CourierForm): string | null {
  if (form.syncMode === "api" && form.courierProvider !== "aliclik") return "La sincronización por API solo está disponible con Aliclik.";
  const cost = form.storageCostMonth.trim();
  if (cost && (!/^\d+(\.\d{1,2})?$/.test(cost) || Number(cost) > 9_999_999_999)) return "El costo de almacenaje es un monto en soles con hasta 2 decimales (por ejemplo, 350.50).";
  return null;
}

/** Solo lo que cambió; vacío = `null` (lo borra). Sin rol de costos no se manda el almacenaje. */
export function courierPatch(form: CourierForm, details: Partial<WarehouseDetails> | undefined, withCost: boolean): WarehouseDetailsPatch {
  const before = formFrom(details);
  const patch: WarehouseDetailsPatch = {};
  if (form.courierProvider !== before.courierProvider) patch.courierProvider = form.courierProvider || null;
  if (form.syncMode !== before.syncMode) patch.syncMode = form.syncMode || null;
  if (withCost) {
    const cost = form.storageCostMonth.trim();
    const next = cost === "" ? null : Number(cost);
    const saved = details?.storageCostMonth === null || details?.storageCostMonth === undefined ? null : Number(details.storageCostMonth);
    if (next !== saved) patch.storageCostMonth = next;
  }
  return patch;
}

interface Props {
  warehouseId: string;
  details: WarehouseDetails | undefined;
  /** Administrador u Operaciones: editan los datos y el mapa de Aliclik. */
  canEdit: boolean;
  disabled?: boolean;
  onSaved: (saved: WarehouseDetails) => void;
}

export default function CourierWarehouseSection({ warehouseId, details, canEdit, disabled, onSaved }: Props) {
  const { auth } = useAuth();
  // El almacenaje es un monto: solo con rol de costos (sin él la API tampoco lo manda).
  const canSeeCosts = courierAccess(auth?.user).seeCosts;
  const [form, setForm] = useState<CourierForm>(() => formFrom(details));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (details) setForm(formFrom(details));
  }, [details]);

  const withCost = canSeeCosts && !!details && "storageCostMonth" in details;
  const problem = courierFormProblem(form);
  const patch = courierPatch(form, details, withCost);
  const dirty = Object.keys(patch).length > 0;

  const save = useMutation({
    mutationFn: () => updateWarehouseDetails(warehouseId, patch),
    onSuccess: (saved) => {
      setError(null);
      onSaved(saved);
      toast.success("Datos del courier guardados");
    },
    onError: (failure) => setError(opsErrorMessage(failure, "No se pudieron guardar los datos del courier.")),
  });

  const locked = !canEdit || disabled || save.isPending;

  return (
    <section className="space-y-3" aria-label="Datos del courier">
      <h3 className="text-sm font-semibold">Courier</h3>
      <p className="text-xs text-muted-foreground">
        Almacén compartido con el courier. POWIP compara su stock con lo que reporta el courier en Inventario › Couriers.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="courier-provider">Courier</Label>
          <select
            id="courier-provider"
            className={SELECT_CLASS}
            value={form.courierProvider}
            disabled={locked}
            onChange={(event) => {
              setError(null);
              setForm((current) => ({ ...current, courierProvider: event.target.value as CourierForm["courierProvider"] }));
            }}
          >
            <option value="">Sin definir</option>
            {COURIER_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {COURIER_PROVIDER_LABEL[provider]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="courier-sync">Sincronización del stock</Label>
          <select
            id="courier-sync"
            className={SELECT_CLASS}
            value={form.syncMode}
            disabled={locked}
            onChange={(event) => {
              setError(null);
              setForm((current) => ({ ...current, syncMode: event.target.value as CourierForm["syncMode"] }));
            }}
          >
            <option value="">Sin definir</option>
            {COURIER_SYNC_MODES.map((mode) => (
              <option key={mode} value={mode} disabled={mode === "api" && form.courierProvider !== "aliclik"}>
                {SYNC_MODE_LABEL[mode]}
              </option>
            ))}
          </select>
          {form.syncMode ? <p className="text-xs text-muted-foreground">{SYNC_MODE_HELP[form.syncMode]}</p> : null}
        </div>
        {withCost ? (
          <div className="space-y-1">
            <Label htmlFor="courier-storage-cost">Almacenaje por mes (S/)</Label>
            <Input
              id="courier-storage-cost"
              inputMode="decimal"
              placeholder="350.00"
              value={form.storageCostMonth}
              disabled={locked}
              onChange={(event) => {
                setError(null);
                setForm((current) => ({ ...current, storageCostMonth: event.target.value }));
              }}
            />
            <p className="text-xs text-muted-foreground">Gasto logístico: no va al costo del producto.</p>
          </div>
        ) : null}
      </div>
      {dirty && problem ? <ErrorBox>{problem}</ErrorBox> : null}
      <ErrorBox>{error}</ErrorBox>
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="button" disabled={!dirty || !!problem || locked} onClick={() => save.mutate()}>
            {save.isPending ? "Guardando…" : "Guardar datos del courier"}
          </Button>
        </div>
      ) : null}

      {canEdit && details?.courierProvider === "aliclik" ? <AliclikMapEditor warehouseId={warehouseId} /> : null}
    </section>
  );
}

/** Almacenes de Aliclik (los que vio el sync) que suman al stock del courier de este almacén. */
function AliclikMapEditor({ warehouseId }: { warehouseId: string }) {
  const queryClient = useQueryClient();
  const { nameOf } = useCompanyWarehouses();
  const mapKey = ["aliclik-map", warehouseId];
  const mapQuery = useQuery({ queryKey: mapKey, queryFn: ({ signal }) => getAliclikMap(warehouseId, signal), retry: false });
  const items = useMemo(() => mapQuery.data?.items ?? [], [mapQuery.data]);
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useMemo(() => new Set(items.filter((item) => item.mappedHere).map((item) => item.aliclikWarehouseId)), [items]);
  const chosen = selected ?? current;
  const dirty = chosen.size !== current.size || [...chosen].some((id) => !current.has(id));

  const save = useMutation({
    mutationFn: () => saveAliclikMap(warehouseId, [...chosen].sort((a, b) => a - b)),
    onSuccess: (saved) => {
      queryClient.setQueryData(mapKey, saved);
      setSelected(null);
      setError(null);
      toast.success("Almacenes de Aliclik guardados");
    },
    onError: (failure) =>
      setError(
        aliclikMapErrorMessage(failure, {
          aliclik: (id) => {
            const name = items.find((item) => item.aliclikWarehouseId === id)?.warehouseName;
            return name ? `«${name}» de Aliclik` : null;
          },
          powip: (inventoryId) => nameOf(inventoryId),
        }),
      ),
  });

  const toggle = (id: number) => {
    setError(null);
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-2 rounded-md border p-3" aria-label="Almacenes de Aliclik">
      <p className="text-sm font-medium">Almacenes de Aliclik</p>
      <p className="text-xs text-muted-foreground">
        Marca los almacenes de Aliclik que son este almacén. Su stock se suma (por SKU vinculado) y se compara con POWIP. Un almacén de Aliclik va en un
        solo almacén de POWIP.
      </p>
      {mapQuery.isError ? <ErrorBox>{opsErrorMessage(mapQuery.error, "No se pudieron cargar los almacenes de Aliclik.")}</ErrorBox> : null}
      {mapQuery.isPending ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
      {mapQuery.isSuccess && items.length === 0 ? (
        <p className="rounded-md border border-dashed py-3 text-center text-sm text-muted-foreground">
          Aliclik todavía no sincronizó almacenes de tu empresa. Revisa la integración de Aliclik.
        </p>
      ) : null}
      <ul className="divide-y rounded-md border">
        {items.map((item) => {
          const elsewhere = item.inventoryId && !item.mappedHere ? nameOf(item.inventoryId) : null;
          return (
            <li key={item.aliclikWarehouseId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <input
                id={`aliclik-${item.aliclikWarehouseId}`}
                type="checkbox"
                className="h-4 w-4"
                checked={chosen.has(item.aliclikWarehouseId)}
                disabled={save.isPending}
                onChange={() => toggle(item.aliclikWarehouseId)}
              />
              <label htmlFor={`aliclik-${item.aliclikWarehouseId}`} className="min-w-0 flex-1">
                <span className="font-medium">{item.warehouseName || `Almacén ${item.aliclikWarehouseId}`}</span>
                <span className="ml-1 text-xs text-muted-foreground">#{item.aliclikWarehouseId}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.linkedSkus} de {item.skus} SKU vinculados · {item.units} und
                  {item.lastSyncedAt ? ` · leído ${formatPeruDateTime(item.lastSyncedAt)}` : ""}
                </span>
              </label>
              {elsewhere ? <span className="text-xs text-amber-700 dark:text-amber-300">Asignado a «{elsewhere}»</span> : null}
            </li>
          );
        })}
      </ul>
      <ErrorBox>{error}</ErrorBox>
      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Guardando…" : "Guardar almacenes de Aliclik"}
        </Button>
      </div>
    </div>
  );
}
