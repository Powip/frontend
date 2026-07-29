"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Pencil, Plus, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsRole, OPS_PERMISSIONS } from "@/contexts/OperationsRoleContext";
import { DELIVERY_ZONES, TRANSPORT_COURIERS } from "@/constants/operationsDomain";
import { Courier, createCourier, fetchCouriers, updateCourier } from "@/services/courierService";

/* -----------------------------------------------------------------------
   Couriers de transporte — tabla editable de los couriers reales de la
   empresa (fetchCouriers/createCourier/updateCourier de courierService).

   BACKEND GAP: el modelo `Courier` de ms-courier hoy solo tiene
   { id, name, phone, email, companyId, isActive, created_at }. NO tiene
   zonas cubiertas, tarifa base, SLA prometido ni comisión COD — los campos
   que este tarifario necesita. Se construye la UI completa igual (así el
   diseño queda validado), pero esos 4 campos se guardan únicamente en
   estado local de React (`localTariffs`, keyed por courier.id) y se
   pierden al recargar la página. Nombre/teléfono/email/activo sí son
   reales y sí persisten via updateCourier. Falta:
     1. Migración en ms-courier agregando esos 4 campos a la entidad Courier.
     2. Endpoint (o extensión de PATCH /couriers/:id) para persistirlos.
------------------------------------------------------------------------ */

interface LocalTariff {
  zones: string[];
  tarifaBase: string;
  sla: string;
  comisionCod: string;
}

const EMPTY_TARIFF: LocalTariff = { zones: [], tarifaBase: "", sla: "", comisionCod: "" };

const ZONE_MAP = new Map(DELIVERY_ZONES.map((z) => [z.value, z]));

export default function CourierTransportTable() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const { can } = useOperationsRole();
  const canEdit = can(OPS_PERMISSIONS.MANAGE_TARIFARIO);

  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [localTariffs, setLocalTariffs] = useState<Record<string, LocalTariff>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    name: string;
    phone: string;
    email: string;
    isActive: boolean;
    tariff: LocalTariff;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await fetchCouriers(companyId);
      setCouriers(data);
    } catch {
      toast.error("No se pudieron cargar los couriers de transporte");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const startEdit = (courier: Courier) => {
    setEditingId(courier.id);
    setDraft({
      name: courier.name,
      phone: courier.phone || "",
      email: courier.email || "",
      isActive: courier.isActive,
      tariff: localTariffs[courier.id] ?? EMPTY_TARIFF,
    });
  };

  const startCreate = () => {
    setCreating(true);
    setEditingId("__new__");
    setDraft({ name: "", phone: "", email: "", isActive: true, tariff: EMPTY_TARIFF });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCreating(false);
    setDraft(null);
  };

  const toggleZone = (zone: string) => {
    if (!draft) return;
    const zones = draft.tariff.zones.includes(zone)
      ? draft.tariff.zones.filter((z) => z !== zone)
      : [...draft.tariff.zones, zone];
    setDraft({ ...draft, tariff: { ...draft.tariff, zones } });
  };

  const saveDraft = async () => {
    if (!draft || !companyId) return;
    if (!draft.name.trim()) {
      toast.error("El nombre del courier es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (creating) {
        const created = await createCourier({
          name: draft.name,
          phone: draft.phone || undefined,
          email: draft.email || undefined,
          companyId,
          isActive: draft.isActive,
        });
        setCouriers((prev) => [...prev, created]);
        setLocalTariffs((prev) => ({ ...prev, [created.id]: draft.tariff }));
        toast.success("Courier creado. Tarifa/zonas/SLA guardados solo en esta sesión (ver nota de brecha de backend).");
      } else if (editingId) {
        const updated = await updateCourier(editingId, {
          name: draft.name,
          phone: draft.phone || undefined,
          email: draft.email || undefined,
          isActive: draft.isActive,
        });
        setCouriers((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        setLocalTariffs((prev) => ({ ...prev, [editingId]: draft.tariff }));
        toast.success("Courier actualizado. Tarifa/zonas/SLA guardados solo en esta sesión.");
      }
      cancelEdit();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError?.response?.data?.message || "Error guardando el courier");
    } finally {
      setSaving(false);
    }
  };

  const toggleActiveQuick = async (courier: Courier) => {
    if (!canEdit) return;
    try {
      const updated = await updateCourier(courier.id, { isActive: !courier.isActive });
      setCouriers((prev) => prev.map((c) => (c.id === courier.id ? updated : c)));
    } catch {
      toast.error("No se pudo actualizar el estado del courier");
    }
  };

  const rows = useMemo(() => couriers, [couriers]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold">Couriers de transporte</h3>
          <p className="text-xs text-muted-foreground">
            Motorizados y agencias que efectivamente entregan (Shalom, Olva, Marvisur, Flores, motorizado propio…).
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" className="gap-1.5" onClick={startCreate} disabled={editingId !== null}>
            <Plus className="h-4 w-4" /> Nuevo courier
          </Button>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Solo lectura
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando couriers…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Zonas que cubre</th>
                  <th className="px-3 py-2">Tarifa base</th>
                  <th className="px-3 py-2">SLA prometido</th>
                  <th className="px-3 py-2">Comisión COD</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {creating && draft && (
                  <EditRow
                    draft={draft}
                    setDraft={setDraft}
                    toggleZone={toggleZone}
                    onSave={saveDraft}
                    onCancel={cancelEdit}
                    saving={saving}
                  />
                )}
                {rows.length === 0 && !creating ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      No hay couriers de transporte registrados.{" "}
                      {canEdit && "Usa \"Nuevo courier\" para agregar uno."}
                    </td>
                  </tr>
                ) : (
                  rows.map((courier) =>
                    editingId === courier.id && draft ? (
                      <EditRow
                        key={courier.id}
                        draft={draft}
                        setDraft={setDraft}
                        toggleZone={toggleZone}
                        onSave={saveDraft}
                        onCancel={cancelEdit}
                        saving={saving}
                      />
                    ) : (
                      <tr key={courier.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <p className="font-semibold">{courier.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {courier.phone || "-"} {courier.email ? `· ${courier.email}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(localTariffs[courier.id]?.zones ?? []).length === 0 ? (
                              <span className="text-xs text-muted-foreground">Sin definir</span>
                            ) : (
                              localTariffs[courier.id]?.zones.map((z) => (
                                <Badge key={z} variant="outline" className="text-[10px]">
                                  {ZONE_MAP.get(z)?.emoji} {ZONE_MAP.get(z)?.label}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {localTariffs[courier.id]?.tarifaBase
                            ? `S/ ${localTariffs[courier.id]?.tarifaBase}`
                            : "-"}
                        </td>
                        <td className="px-3 py-2">{localTariffs[courier.id]?.sla || "-"}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {localTariffs[courier.id]?.comisionCod
                            ? `${localTariffs[courier.id]?.comisionCod}%`
                            : "-"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={courier.isActive}
                              onCheckedChange={() => toggleActiveQuick(courier)}
                              disabled={!canEdit}
                            />
                            <span className="text-xs text-muted-foreground">
                              {courier.isActive ? "Activo" : "Inactivo"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5"
                            disabled={!canEdit || editingId !== null}
                            onClick={() => startEdit(courier)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </Button>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EditRow({
  draft,
  setDraft,
  toggleZone,
  onSave,
  onCancel,
  saving,
}: {
  draft: {
    name: string;
    phone: string;
    email: string;
    isActive: boolean;
    tariff: LocalTariff;
  };
  setDraft: (d: {
    name: string;
    phone: string;
    email: string;
    isActive: boolean;
    tariff: LocalTariff;
  }) => void;
  toggleZone: (zone: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <tr className="border-t bg-teal-50/40 dark:bg-teal-500/5">
      <td className="px-3 py-2 align-top">
        <Input
          list="transport-courier-names"
          placeholder="Nombre del courier"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="h-8 text-xs"
        />
        <datalist id="transport-courier-names">
          {TRANSPORT_COURIERS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Input
          placeholder="Teléfono"
          value={draft.phone}
          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          className="mt-1 h-8 text-xs"
        />
        <Input
          placeholder="Email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          className="mt-1 h-8 text-xs"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex max-w-[180px] flex-wrap gap-1">
          {DELIVERY_ZONES.map((z) => (
            <button
              key={z.value}
              type="button"
              onClick={() => toggleZone(z.value)}
              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                draft.tariff.zones.includes(z.value)
                  ? "border-teal-400 bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {z.emoji} {z.label}
            </button>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <Input
          type="number"
          placeholder="0.00"
          value={draft.tariff.tarifaBase}
          onChange={(e) =>
            setDraft({ ...draft, tariff: { ...draft.tariff, tarifaBase: e.target.value } })
          }
          className="h-8 w-24 text-xs"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <Input
          placeholder="ej. 24-48h"
          value={draft.tariff.sla}
          onChange={(e) => setDraft({ ...draft, tariff: { ...draft.tariff, sla: e.target.value } })}
          className="h-8 w-28 text-xs"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <Input
          type="number"
          placeholder="0"
          value={draft.tariff.comisionCod}
          onChange={(e) =>
            setDraft({ ...draft, tariff: { ...draft.tariff, comisionCod: e.target.value } })
          }
          className="h-8 w-20 text-xs"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <Switch
          checked={draft.isActive}
          onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })}
        />
      </td>
      <td className="px-3 py-2 text-right align-top">
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel} disabled={saving}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
