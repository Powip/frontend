"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { opsErrorMessage } from "@/lib/warehouseOps";
import {
  blockingBalances,
  DETAIL_FIELDS,
  DETAIL_LABEL,
  detailsFormFrom,
  detailsPatch,
  detailsProblem,
  locationCodeProblem,
  normalizeLocationCode,
  type DetailsForm,
} from "@/lib/warehouseStructure";
import {
  assignLocation,
  createLocation,
  deleteLocation,
  getWarehouseDetails,
  listLocations,
  setWarehouseActive,
  updateLocation,
  updateWarehouseDetails,
  type WarehouseLocation,
} from "@/services/warehouseOpsService";
import { ErrorBox, SELECT_CLASS } from "../OpsBits";
import VariantLinePicker from "../VariantLinePicker";
import CourierWarehouseSection from "./CourierWarehouseSection";

// FEAT-24 H5-C (H5-D7/D8) — ficha de un almacén (mockup vEstructura): los datos
// para la guía de remisión y SUNAT, lo que tiene hoy (físico, reservado, en
// tránsito…), sus ubicaciones (alta, edición, baja y qué productos van en cada
// una) y desactivar o activar. Un almacén solo se desactiva si no tiene stock
// físico, reservas, tránsito ni traslados pendientes (lo valida el servidor).

const PLACEHOLDER: Record<keyof DetailsForm, string> = {
  code: "ALM-SUR",
  ubigeo: "150101",
  address: "Av. Los Olivos 123, Lima",
  contactName: "Nombre de quien recibe",
  contactPhone: "+51 999 999 999",
  sunatEstablishmentCode: "0001",
};

interface Props {
  companyId: string;
  warehouse: { id: string; name: string; is_main: boolean; status: boolean };
  /** Administrador u Operaciones; el resto solo mira. */
  canEdit: boolean;
  onClose: () => void;
  /** Cambió el estado activo del almacén. */
  onActiveChanged?: () => void;
}

export default function WarehouseDetailsDialog({ companyId, warehouse, canEdit, onClose, onActiveChanged }: Props) {
  const queryClient = useQueryClient();
  const detailsKey = ["warehouse-details", companyId, warehouse.id];
  const locationsKey = ["warehouse-locations", companyId, warehouse.id];
  const detailsQuery = useQuery({ queryKey: detailsKey, queryFn: ({ signal }) => getWarehouseDetails(warehouse.id, signal), retry: false });
  const locationsQuery = useQuery({ queryKey: locationsKey, queryFn: ({ signal }) => listLocations(warehouse.id, signal), retry: false });
  const details = detailsQuery.data;
  const active = details?.active ?? warehouse.status;
  const locations = locationsQuery.data ?? [];

  const [form, setForm] = useState<DetailsForm>(() => detailsFormFrom(null));
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; code: string; description: string } | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [assignInfo, setAssignInfo] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    if (details) setForm(detailsFormFrom(details));
  }, [details]);

  const refreshLocations = () => void queryClient.invalidateQueries({ queryKey: locationsKey });

  const saveDetails = useMutation({
    mutationFn: () => updateWarehouseDetails(warehouse.id, detailsPatch(form, details)),
    onSuccess: (saved) => {
      queryClient.setQueryData(detailsKey, { ...details, ...saved });
      setDetailsError(null);
      toast.success("Datos del almacén guardados");
    },
    onError: (error) => setDetailsError(opsErrorMessage(error, "No se pudieron guardar los datos.")),
  });

  const addLocation = useMutation({
    mutationFn: () =>
      createLocation({ inventoryId: warehouse.id, code: normalizeLocationCode(newCode), ...(newDescription.trim() ? { description: newDescription.trim() } : {}) }),
    onSuccess: (location) => {
      setNewCode("");
      setNewDescription("");
      setLocationError(null);
      toast.success(`Ubicación ${location.code} creada`);
      refreshLocations();
    },
    onError: (error) => setLocationError(opsErrorMessage(error, "No se pudo crear la ubicación.")),
  });

  const changeLocation = useMutation({
    mutationFn: ({ location, body }: { location: WarehouseLocation; body: { code?: string; description?: string | null; active?: boolean } }) =>
      updateLocation(location.id, body),
    onSuccess: () => {
      setEditing(null);
      setLocationError(null);
      refreshLocations();
    },
    onError: (error) => setLocationError(opsErrorMessage(error, "No se pudo cambiar la ubicación.")),
  });

  const removeLocation = useMutation({
    mutationFn: (location: WarehouseLocation) => deleteLocation(location.id),
    onSuccess: (_result, location) => {
      setLocationError(null);
      toast.success(`Ubicación ${location.code} eliminada`);
      refreshLocations();
    },
    onError: (error) => setLocationError(opsErrorMessage(error, "No se pudo eliminar la ubicación.")),
  });

  const toggleActive = useMutation({
    mutationFn: () => setWarehouseActive(warehouse.id, !active),
    onSuccess: () => {
      setConfirmToggle(false);
      setToggleError(null);
      toast.success(active ? `${warehouse.name} desactivado` : `${warehouse.name} activado`);
      void queryClient.invalidateQueries({ queryKey: detailsKey });
      onActiveChanged?.();
    },
    onError: (error) => setToggleError(opsErrorMessage(error, active ? "No se pudo desactivar el almacén." : "No se pudo activar el almacén.")),
  });

  const assign = async (variantIds: string[], locationId: string | null) => {
    const results = await Promise.allSettled(variantIds.map((variantId) => assignLocation({ inventoryId: warehouse.id, variantId, locationId })));
    const failed = results.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
    const done = results.length - failed.length;
    const target = locationId ? locations.find((location) => location.id === locationId)?.code ?? "la ubicación" : null;
    setAssignInfo(
      failed.length
        ? `${done} de ${results.length} asignados. ${opsErrorMessage(failed[0].reason, "Inténtalo de nuevo.")}`
        : target
          ? `${done} producto(s) ahora van en ${target}.`
          : `${done} producto(s) quedaron sin ubicación.`,
    );
    refreshLocations();
  };

  const problem = detailsProblem(form);
  const patch = detailsPatch(form, details);
  const dirty = Object.keys(patch).length > 0;
  const blocking = blockingBalances(details?.counters);
  const busy = saveDetails.isPending || toggleActive.isPending;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {warehouse.name}
            {warehouse.is_main ? <Badge>Principal</Badge> : null}
            {!active ? <Badge variant="outline">Inactivo</Badge> : null}
          </DialogTitle>
          <DialogDescription>Datos para la guía de remisión, ubicaciones y estado del almacén.</DialogDescription>
        </DialogHeader>

        {detailsQuery.isError ? <ErrorBox>{opsErrorMessage(detailsQuery.error, "No se pudieron cargar los datos del almacén.")}</ErrorBox> : null}

        {details?.counters ? (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Lo que tiene hoy">
            {(
              [
                ["Físico", details.counters.physical],
                ["Reservado", details.counters.reserved],
                ["En tránsito", details.counters.inTransit],
                ["Devoluciones por recibir", details.counters.pendingReturn],
                ["Traslados en camino", details.counters.incomingTransfer],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md border px-3 py-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <section className="space-y-3" aria-label="Datos del almacén">
          <h3 className="text-sm font-semibold">Datos del almacén</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {DETAIL_FIELDS.map((field) => (
              <div key={field} className={`space-y-1 ${field === "address" ? "md:col-span-2" : ""}`}>
                <Label htmlFor={`wh-${field}`}>{DETAIL_LABEL[field]}</Label>
                <Input
                  id={`wh-${field}`}
                  value={form[field]}
                  placeholder={PLACEHOLDER[field]}
                  inputMode={field === "ubigeo" || field === "sunatEstablishmentCode" ? "numeric" : undefined}
                  disabled={!canEdit || detailsQuery.isPending || saveDetails.isPending}
                  onChange={(event) => {
                    setDetailsError(null);
                    setForm((current) => ({ ...current, [field]: event.target.value }));
                  }}
                />
              </div>
            ))}
          </div>
          {dirty && problem ? <ErrorBox>{problem}</ErrorBox> : null}
          <ErrorBox>{detailsError}</ErrorBox>
          {canEdit ? (
            <div className="flex justify-end">
              <Button type="button" disabled={!dirty || !!problem || saveDetails.isPending} onClick={() => saveDetails.mutate()}>
                {saveDetails.isPending ? "Guardando…" : "Guardar datos"}
              </Button>
            </div>
          ) : null}
        </section>

        {/* FEAT-24 H8-D1: courier, sincronización, almacenaje y, con Aliclik, su mapa de almacenes. */}
        {details?.type === "COURIER" ? (
          <CourierWarehouseSection
            warehouseId={warehouse.id}
            details={details}
            canEdit={canEdit}
            disabled={detailsQuery.isPending}
            onSaved={(saved) => queryClient.setQueryData(detailsKey, { ...details, ...saved })}
          />
        ) : null}

        <section className="space-y-3" aria-label="Ubicaciones">
          <h3 className="text-sm font-semibold">Ubicaciones</h3>
          <p className="text-xs text-muted-foreground">Estante, pasillo o caja donde se guarda cada producto. Se usan para contar por ubicación y en el picking.</p>
          {locationsQuery.isError ? <ErrorBox>{opsErrorMessage(locationsQuery.error, "No se pudieron cargar las ubicaciones.")}</ErrorBox> : null}
          {locations.length === 0 && !locationsQuery.isPending ? (
            <p className="rounded-md border border-dashed py-4 text-center text-sm text-muted-foreground">Este almacén todavía no tiene ubicaciones.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {locations.map((location) => (
                <li key={location.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm" data-testid={`location-${location.code}`}>
                  {editing?.id === location.id ? (
                    <>
                      <Input
                        aria-label={`Código de ${location.code}`}
                        className="w-32 font-mono"
                        value={editing.code}
                        onChange={(event) => setEditing({ ...editing, code: event.target.value })}
                      />
                      <Input
                        aria-label={`Descripción de ${location.code}`}
                        className="min-w-40 flex-1"
                        value={editing.description}
                        onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={changeLocation.isPending}
                        onClick={() => {
                          const codeProblem = locationCodeProblem(editing.code);
                          if (codeProblem) {
                            setLocationError(codeProblem);
                            return;
                          }
                          changeLocation.mutate({
                            location,
                            body: { code: normalizeLocationCode(editing.code), description: editing.description.trim() || null },
                          });
                        }}
                      >
                        Guardar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-mono font-semibold">{location.code}</span>
                      <span className="min-w-0 flex-1 text-muted-foreground">{location.description || "—"}</span>
                      <span className="text-xs text-muted-foreground">{location.assignedItems} producto(s)</span>
                      {!location.active ? <Badge variant="outline">Inactiva</Badge> : null}
                      {canEdit ? (
                        <span className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing({ id: location.id, code: location.code, description: location.description ?? "" })}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={changeLocation.isPending}
                            onClick={() => changeLocation.mutate({ location, body: { active: !location.active } })}
                          >
                            {location.active ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Eliminar ubicación ${location.code}`}
                            title={location.assignedItems > 0 ? "Tiene productos asignados: muévelos antes de eliminarla." : "Eliminar"}
                            disabled={removeLocation.isPending || location.assignedItems > 0}
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeLocation.mutate(location)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </span>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="loc-code">Código</Label>
                <Input id="loc-code" className="w-36 font-mono" placeholder="A-01-03" value={newCode} onChange={(event) => setNewCode(event.target.value)} />
              </div>
              <div className="min-w-48 flex-1 space-y-1">
                <Label htmlFor="loc-description">Descripción (opcional)</Label>
                <Input id="loc-description" placeholder="Pasillo A, estante 1, nivel 3" value={newDescription} onChange={(event) => setNewDescription(event.target.value)} />
              </div>
              <Button
                type="button"
                disabled={addLocation.isPending}
                onClick={() => {
                  const codeProblem = locationCodeProblem(newCode);
                  if (codeProblem) {
                    setLocationError(codeProblem);
                    return;
                  }
                  addLocation.mutate();
                }}
              >
                Agregar ubicación
              </Button>
            </div>
          ) : null}
          <ErrorBox>{locationError}</ErrorBox>

          {canEdit && locations.some((location) => location.active) ? (
            <div className="space-y-2 rounded-md border p-3">
              <Label htmlFor="loc-assign">Asignar productos a una ubicación</Label>
              <select id="loc-assign" className={SELECT_CLASS} value={assignTo} onChange={(event) => setAssignTo(event.target.value)}>
                <option value="">Elige la ubicación</option>
                {locations
                  .filter((location) => location.active)
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code}
                      {location.description ? ` · ${location.description}` : ""}
                    </option>
                  ))}
                <option value="none">Sin ubicación (quitarla)</option>
              </select>
              <VariantLinePicker
                companyId={companyId}
                idPrefix="loc"
                disabled={!assignTo}
                onAdd={(lines) => {
                  void assign(
                    lines.map((line) => line.variantId),
                    assignTo === "none" ? null : assignTo,
                  );
                  return lines.length;
                }}
              />
              {assignInfo ? (
                <p role="status" className="text-xs text-muted-foreground">
                  {assignInfo}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {canEdit ? (
          <section className="space-y-2 rounded-md border p-3" aria-label="Estado del almacén">
            <h3 className="text-sm font-semibold">{active ? "Desactivar el almacén" : "Activar el almacén"}</h3>
            {active ? (
              <p className="text-xs text-muted-foreground">
                {warehouse.is_main
                  ? "El almacén principal no se desactiva: define otro como principal primero."
                  : blocking.length > 0
                    ? `No se puede desactivar mientras tenga ${blocking.join(", ")}.`
                    : "Deja de usarse para vender, reservar y recibir. Su historial se conserva."}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Vuelve a estar disponible para vender, reservar y recibir.</p>
            )}
            <ErrorBox>{toggleError}</ErrorBox>
            {confirmToggle ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">{active ? `¿Desactivar ${warehouse.name}?` : `¿Activar ${warehouse.name}?`}</span>
                <Button type="button" size="sm" variant={active ? "destructive" : "default"} disabled={toggleActive.isPending} onClick={() => toggleActive.mutate()}>
                  {active ? "Sí, desactivar" : "Sí, activar"}
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={toggleActive.isPending} onClick={() => setConfirmToggle(false)}>
                  Volver
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={active && (warehouse.is_main || blocking.length > 0)}
                onClick={() => {
                  setToggleError(null);
                  setConfirmToggle(true);
                }}
              >
                {active ? "Desactivar" : "Activar"}
              </Button>
            )}
          </section>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
