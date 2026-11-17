"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { hasAdminAccess } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import {
  draftsToInput,
  emptyRule,
  moveRule,
  RESERVATION_RULES_MAX,
  rulesChanged,
  rulesToDrafts,
  shadowedRuleKeys,
  validateRules,
  withNames,
  type RuleDraft,
} from "@/lib/stockRules";
import {
  getReservationRules,
  listWarehouses,
  saveReservationRules,
  type ReservationRule,
} from "@/services/warehousesService";
import { DEPARTMENT_NAMES, optionFor, provinceNames, withCurrent } from "./regionOptions";

// FEAT-24 H2-F — Configuración › Tiendas y almacenes › «Reglas de reserva por
// región»: de qué almacén reserva cada pedido. Se edita la lista y se guarda
// completa (el PUT reemplaza todo). Solo un administrador edita.

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const EMPTY: ReservationRule[] = [];

export default function ReservationRulesSection() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const companyId = auth?.company?.id;
  const enabled = Boolean(companyId && auth?.accessToken);
  const isAdmin = hasAdminAccess(auth?.user?.role);
  const stores = useMemo(() => auth?.company?.stores ?? [], [auth?.company?.stores]);

  const rulesKey = useMemo(() => ["reservation-rules", companyId], [companyId]);
  const rulesQuery = useQuery({ queryKey: rulesKey, queryFn: () => getReservationRules(), enabled, retry: false, staleTime: 0 });
  // Los mismos almacenes que muestra la sección de arriba (misma clave de caché).
  const warehousesQuery = useQuery({
    queryKey: ["company-warehouses", companyId],
    queryFn: () => listWarehouses(),
    enabled,
    retry: false,
    staleTime: 0,
  });

  const saved = rulesQuery.data ?? EMPTY;
  const savedDrafts = useMemo(() => rulesToDrafts(saved), [saved]);
  // `null` = sin cambios en pantalla: se muestra lo guardado.
  const [edited, setEdited] = useState<RuleDraft[] | null>(null);
  const drafts = edited ?? savedDrafts;
  const [serverError, setServerError] = useState<string | null>(null);

  const warehouses = useMemo(() => warehousesQuery.data?.warehouses ?? [], [warehousesQuery.data]);
  const activeIds = useMemo(() => new Set(warehouses.filter((w) => w.status).map((w) => w.id)), [warehouses]);
  const names = useMemo(
    () =>
      new Map<string, string>([
        ...warehouses.map((w) => [w.id.toLowerCase(), w.name] as [string, string]),
        ...stores.map((s) => [s.id.toLowerCase(), s.name] as [string, string]),
      ]),
    [warehouses, stores],
  );
  const warehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "Almacén desconocido";
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? "Tienda desconocida";
  const defaultWarehouse = warehouses.find((w) => w.status && w.is_main)?.id ?? warehouses.find((w) => w.status)?.id ?? "";

  const problems = useMemo(() => validateRules(drafts, activeIds), [drafts, activeIds]);
  const shadowed = useMemo(() => shadowedRuleKeys(drafts), [drafts]);
  const dirty = edited !== null && rulesChanged(edited, saved);

  const save = useMutation({
    mutationFn: (list: RuleDraft[]) => saveReservationRules(draftsToInput(list)),
    onSuccess: (rules) => {
      queryClient.setQueryData(rulesKey, rules);
      setEdited(null);
      setServerError(null);
      toast.success("Reglas de reserva guardadas");
    },
    onError: (error) => {
      const message = withNames(
        warehouseErrorMessage(error, "No se pudieron guardar las reglas. Inténtalo de nuevo."),
        names,
      );
      setServerError(message);
      toast.error(message);
    },
  });

  if (!companyId) return null;

  const edit = (next: RuleDraft[]) => {
    setServerError(null);
    setEdited(next);
  };
  const patch = (key: string, change: Partial<RuleDraft>) =>
    edit(drafts.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)));

  const describe = (draft: RuleDraft) => {
    const where = [draft.department || "Cualquier departamento", draft.department ? draft.province || "cualquier provincia" : null]
      .filter(Boolean)
      .join(" › ");
    const store = draft.storeId ? storeName(draft.storeId) : "cualquier tienda";
    return `${where} · ${store} → ${warehouseName(draft.inventoryId)}`;
  };

  const loading = rulesQuery.isPending || warehousesQuery.isPending;
  const loadError = rulesQuery.error ?? warehousesQuery.error;
  const canEdit = isAdmin && !loading && !loadError;
  const busy = save.isPending;

  return (
    <section aria-labelledby="reservation-rules-title" className="space-y-4 rounded-lg border bg-card p-6">
      <div className="space-y-2">
        <h3 id="reservation-rules-title" className="text-lg font-medium">
          Reglas de reserva por región
        </h3>
        <p className="text-sm text-muted-foreground">Cuando entra un pedido, Powip elige de qué almacén reservar en este orden:</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            La primera regla <strong>activa</strong>, de arriba hacia abajo, cuyo departamento, provincia y tienda coinciden con
            el pedido. Un campo vacío vale para cualquiera.
          </li>
          <li>Si ninguna coincide, el almacén por defecto de la tienda del pedido.</li>
          <li>Si la tienda no tiene, el almacén principal.</li>
        </ol>
        {!isAdmin ? <p className="text-xs text-muted-foreground">Solo un administrador puede cambiar las reglas.</p> : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando reglas…</p>
      ) : loadError ? (
        <div role="alert" className="space-y-2 rounded-md border border-dashed p-4 text-sm">
          <p className="font-medium">No se pudieron cargar las reglas de reserva</p>
          <p className="text-muted-foreground">{warehouseErrorMessage(loadError, "Inténtalo de nuevo en unos minutos.")}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void rulesQuery.refetch();
              void warehousesQuery.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {drafts.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No hay reglas: cada pedido reserva en el almacén por defecto de su tienda (o en el principal).
            </p>
          ) : canEdit ? (
            <ol className="space-y-3" aria-label="Reglas de reserva">
              {drafts.map((draft, index) => {
                const n = index + 1;
                const problem = problems.find((p) => p.key === draft.key);
                const provinces = withCurrent(provinceNames(draft.department), draft.province);
                const departments = withCurrent(DEPARTMENT_NAMES, draft.department);
                // Un almacén inactivo solo se muestra si es el que ya tiene la regla.
                const warehouseOptions = warehouses.filter((w) => w.status || w.id === draft.inventoryId);
                return (
                  <li key={draft.key} data-testid={`rule-${n}`} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={draft.active ? "default" : "outline"}>{n}</Badge>
                      <span className="min-w-0 flex-1 text-sm">{describe(draft)}</span>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={draft.active}
                          disabled={busy}
                          aria-label={`Regla ${n} activa`}
                          onCheckedChange={(active) => patch(draft.key, { active })}
                        />
                        {draft.active ? "Activa" : "Inactiva"}
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy || index === 0}
                        aria-label={`Subir regla ${n}`}
                        onClick={() => edit(moveRule(drafts, index, -1))}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy || index === drafts.length - 1}
                        aria-label={`Bajar regla ${n}`}
                        onClick={() => edit(moveRule(drafts, index, 1))}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        aria-label={`Borrar regla ${n}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => edit(drafts.filter((d) => d.key !== draft.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <select
                        aria-label={`Departamento de la regla ${n}`}
                        className={SELECT_CLASS}
                        disabled={busy}
                        value={optionFor(departments, draft.department)}
                        onChange={(e) => patch(draft.key, { department: e.target.value, province: "" })}
                      >
                        <option value="">Cualquier departamento</option>
                        {departments.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Provincia de la regla ${n}`}
                        className={SELECT_CLASS}
                        disabled={busy || !draft.department}
                        value={draft.department ? optionFor(provinces, draft.province) : ""}
                        onChange={(e) => patch(draft.key, { province: e.target.value })}
                      >
                        <option value="">{draft.department ? "Cualquier provincia" : "Elige el departamento"}</option>
                        {draft.department
                          ? provinces.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))
                          : null}
                      </select>
                      <select
                        aria-label={`Tienda de la regla ${n}`}
                        className={SELECT_CLASS}
                        disabled={busy}
                        value={draft.storeId}
                        onChange={(e) => patch(draft.key, { storeId: e.target.value })}
                      >
                        <option value="">Cualquier tienda</option>
                        {draft.storeId && !stores.some((s) => s.id === draft.storeId) ? (
                          <option value={draft.storeId}>Tienda desconocida</option>
                        ) : null}
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Almacén de la regla ${n}`}
                        className={SELECT_CLASS}
                        disabled={busy}
                        value={draft.inventoryId}
                        onChange={(e) => patch(draft.key, { inventoryId: e.target.value })}
                      >
                        {draft.inventoryId === "" ? (
                          <option value="" disabled>
                            Elige el almacén
                          </option>
                        ) : null}
                        {draft.inventoryId && !warehouses.some((w) => w.id === draft.inventoryId) ? (
                          <option value={draft.inventoryId}>Almacén desconocido</option>
                        ) : null}
                        {warehouseOptions.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.status ? w.name : `${w.name} (inactivo)`}
                          </option>
                        ))}
                      </select>
                    </div>
                    {problem ? <p className="text-xs text-destructive">{problem.message}</p> : null}
                    {!problem && shadowed.has(draft.key) ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Esta regla nunca se usa: una regla activa de más arriba ya cubre estos pedidos.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <ol className="space-y-2" aria-label="Reglas de reserva">
              {drafts.map((draft, index) => (
                <li key={draft.key} data-testid={`rule-${index + 1}`} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                  <Badge variant={draft.active ? "default" : "outline"}>{index + 1}</Badge>
                  <span className="min-w-0 flex-1">{describe(draft)}</span>
                  {!draft.active ? <Badge variant="outline">Inactiva</Badge> : null}
                </li>
              ))}
            </ol>
          )}

          {problems.some((p) => p.key === "") ? (
            <p className="text-sm text-destructive">{problems.find((p) => p.key === "")?.message}</p>
          ) : null}

          {serverError ? (
            <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {serverError}
            </div>
          ) : null}

          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || drafts.length >= RESERVATION_RULES_MAX || activeIds.size === 0}
                onClick={() => edit([...drafts, emptyRule(defaultWarehouse)])}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar regla
              </Button>
              <span className="flex-1" />
              {dirty ? (
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => {
                    setServerError(null);
                    setEdited(null);
                  }}
                >
                  Descartar cambios
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={!dirty || busy || problems.length > 0}
                onClick={() => save.mutate(drafts)}
              >
                {busy ? "Guardando…" : "Guardar reglas"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
