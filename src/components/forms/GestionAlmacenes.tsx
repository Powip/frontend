"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Home, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteWarehouse,
  listWarehouses,
  setMainWarehouse,
  setStoreDefaultWarehouse,
  setWarehouseType,
  type WarehouseType,
} from "@/services/warehousesService";
import AlmacenModal from "../modals/AlmacenModal";
import { WAREHOUSE_TYPE_OPTIONS, warehouseErrorMessage } from "./warehouseUi";

// `aria-disabled` (mientras guarda) en vez de `disabled`: el selector no pierde el foco.
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

// Cachés de otras pantallas que dependen de los almacenes y del por defecto de cada tienda.
const RELATED_QUERY_PREFIXES = [["business-inventories"], ["sale-context"], ["inventory-metrics"]];

const LOAD_ERROR = "No se pudieron cargar los almacenes. Inténtalo de nuevo.";

interface WarehouseChange {
  run: () => Promise<void>;
  success: string;
}

// Almacén que se va a eliminar, a la espera de que se escriba su nombre.
interface PendingDelete {
  id: string;
  name: string;
}

// Cambio de almacén por defecto a la espera de confirmación.
interface PendingDefault {
  storeId: string;
  storeName: string;
  inventoryId: string;
  warehouseName: string;
}

const GestionAlmacenes = () => {
  const [openModal, setOpenModal] = useState(false);
  const [pendingDefault, setPendingDefault] = useState<PendingDefault | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const { auth, refreshInventories } = useAuth();
  const queryClient = useQueryClient();
  const companyId = auth?.company?.id;
  const stores = useMemo(() => auth?.company?.stores ?? [], [auth?.company?.stores]);

  // Todos los almacenes de la empresa del token, sin importar de qué tienda salieron.
  const queryKey = useMemo(() => ["company-warehouses", companyId], [companyId]);
  const query = useQuery({
    queryKey,
    queryFn: () => listWarehouses(),
    enabled: Boolean(companyId && auth?.accessToken),
    retry: false,
    staleTime: 0,
  });

  const { error: loadFailure, errorUpdatedAt } = query;
  const loadError = loadFailure ? warehouseErrorMessage(loadFailure, LOAD_ERROR) : null;
  useEffect(() => {
    // Un toast por cada fallo de carga (incluidos los reintentos).
    if (loadFailure) toast.error(warehouseErrorMessage(loadFailure, LOAD_ERROR));
  }, [loadFailure, errorUpdatedAt]);

  const invalidateRelatedCaches = () => {
    for (const relatedKey of RELATED_QUERY_PREFIXES) {
      void queryClient.invalidateQueries({ queryKey: relatedKey });
    }
  };

  const change = useMutation({
    mutationFn: ({ run }: WarehouseChange) => run(),
    onSuccess: async (_data, { success }) => {
      invalidateRelatedCaches();
      await queryClient.invalidateQueries({ queryKey });
      toast.success(success);
    },
    onError: (error) => {
      toast.error(warehouseErrorMessage(error, "No se pudo guardar el cambio. Inténtalo de nuevo."));
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: async () => {
      setPendingDelete(null);
      invalidateRelatedCaches();
      toast.success("Almacén eliminado correctamente");
      const refreshes = await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey }),
        Promise.resolve(refreshInventories()), // Sincronizar estado global
      ]);
      if (refreshes.some((result) => result.status === "rejected")) {
        toast.error("El almacén se eliminó, pero no se pudo actualizar la información. Actualiza la página.");
      }
    },
    onError: (error) => {
      setPendingDelete(null);
      toast.error(warehouseErrorMessage(error, "No se pudo eliminar el almacén. Inténtalo nuevamente."));
    },
  });

  // Activos primero; el orden del backend se conserva dentro de cada grupo.
  const warehouses = useMemo(() => {
    const all = query.data?.warehouses ?? [];
    return [...all.filter((w) => w.status), ...all.filter((w) => !w.status)];
  }, [query.data]);
  const links = query.data?.links ?? [];
  const storeName = (id: string) => stores.find((store) => store.id === id)?.name ?? "—";
  const busy = change.isPending || remove.isPending;
  // Hay que escribir el nombre exacto (sin contar espacios de los extremos).
  const deleteConfirmed =
    pendingDelete !== null && confirmName.trim() === pendingDelete.name.trim();

  if (!companyId) return null;

  // Tiendas que tienen este almacén como su almacén por defecto.
  const storesUsing = (inventoryId: string) =>
    stores.filter((store) => links.some((link) => link.inventory_id === inventoryId && link.store_id === store.id && link.is_default)).map((store) => store.name);

  const defaultFor = (storeId: string) =>
    links.find((link) => link.store_id === storeId && link.is_default)?.inventory_id ?? "";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-6 rounded-lg border">
        <div>
          <h3 className="text-lg font-medium">Tiendas y almacenes</h3>
          <p className="text-sm text-muted-foreground">
            El stock es de tu empresa: los almacenes (propios, tiendas físicas o de courier) se comparten entre tiendas
          </p>
        </div>
        <Button
          onClick={() => setOpenModal(true)}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Almacén
        </Button>
      </div>

      {!query.isPending && !loadError && stores.length > 0 && warehouses.length > 0 && (
        <div className="space-y-3 bg-card p-6 rounded-lg border">
          <div>
            <h3 className="text-lg font-medium">Tiendas</h3>
            <p className="text-sm text-muted-foreground">
              Los pedidos que llegan sin almacén (canales e integraciones) salen de este almacén.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => {
              const current = defaultFor(store.id);
              // Un almacén inactivo no se ofrece, salvo que sea el actual (para no mostrar un valor vacío).
              const options = warehouses.filter((w) => w.status || w.id === current);
              return (
                <div key={store.id} data-testid={`store-${store.id}`} className="space-y-2 rounded-md border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xs font-semibold uppercase">
                      {store.name.slice(0, 2)}
                    </div>
                    <p className="text-sm font-medium">{store.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground" aria-hidden="true">
                    Almacén por defecto
                  </span>
                  <select
                    aria-label={`Almacén por defecto de ${store.name}`}
                    className={SELECT_CLASS}
                    value={current}
                    aria-disabled={busy || undefined}
                    onChange={(e) => {
                      // Un teclado cambia el valor con solo una flecha: se confirma antes de guardar.
                      // El select controlado vuelve al valor actual hasta que se confirme.
                      if (busy) return;
                      const inventoryId = e.target.value;
                      const target = warehouses.find((w) => w.id === inventoryId);
                      if (!target || inventoryId === current) return;
                      setPendingDefault({
                        storeId: store.id,
                        storeName: store.name,
                        inventoryId,
                        warehouseName: target.name,
                      });
                    }}
                  >
                    {current === "" && (
                      <option value="" disabled>
                        Sin almacén por defecto
                      </option>
                    )}
                    {options.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.status ? w.name : `${w.name} (inactivo)`}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}


      <div className="space-y-3 bg-card p-6 rounded-lg border">
        <h3 className="text-lg font-medium">Almacenes</h3>
        {query.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-md border p-4">
                <div className="h-5 w-32 bg-muted rounded mb-2" />
                <div className="h-4 w-48 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 border border-dashed rounded-lg">
            <p className="font-medium">No se pudieron cargar los almacenes</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Reintentar
            </Button>
          </div>
        ) : warehouses.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-2">Almacén</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Tiendas que lo usan por defecto</th>
                  <th className="px-4 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
          {warehouses.map((almacen) => (
            <tr
              key={almacen.id}
              data-testid={`warehouse-${almacen.id}`}
              className="border-t align-middle"
            >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                    <Home className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-medium">{almacen.name}</h4>
                    {almacen.is_main && almacen.status && <Badge>Principal</Badge>}
                    {!almacen.status && <Badge variant="outline">Inactivo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {`Tienda de origen: ${storeName(almacen.store_id)}`}
                    </p>
                  </div>
                  </div>
                </td>
                <td className="px-4 py-3 min-w-[150px]">
                    <select
                      aria-label={`Tipo de ${almacen.name}`}
                      className={SELECT_CLASS}
                      value={almacen.type}
                      disabled={!almacen.status}
                      aria-disabled={busy || undefined}
                      onChange={(e) => {
                        if (busy) return;
                        const type = e.target.value as WarehouseType;
                        change.mutate({
                          run: () => setWarehouseType(almacen.id, type),
                          success: "Tipo actualizado",
                        });
                      }}
                    >
                      {WAREHOUSE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {storesUsing(almacen.id).join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                  {almacen.status && !almacen.is_main && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      aria-label={`Hacer principal: ${almacen.name}`}
                      onClick={() =>
                        change.mutate({
                          run: () => setMainWarehouse(almacen.id),
                          success: "Almacén principal actualizado",
                        })
                      }
                    >
                      Hacer principal
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy || almacen.is_main}
                    aria-label={`Eliminar almacén ${almacen.name}`}
                    title={
                      almacen.is_main
                        ? "El almacén principal no se puede eliminar. Define otro como principal primero."
                        : "Eliminar almacén"
                    }
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setConfirmName("");
                      setPendingDelete({ id: almacen.id, name: almacen.name });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  </div>
                </td>
            </tr>
          ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center border border-dashed rounded-lg">
            <Home className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground">
              No tienes almacenes creados aún
            </p>
          </div>
        )}
        {!query.isPending && !loadError && warehouses.length > 0 && (
          <p className="text-xs text-muted-foreground">
            El almacén principal no se puede eliminar: define otro como principal primero.
          </p>
        )}
      </div>


      <AlertDialog
        open={pendingDefault !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDefault(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar el almacén por defecto</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDefault
                ? `${pendingDefault.storeName} usará ${pendingDefault.warehouseName} como almacén por defecto. Los pedidos que lleguen sin almacén (canales e integraciones) saldrán de ahí.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDefault || busy) return;
                const { storeId, inventoryId } = pendingDefault;
                change.mutate({
                  run: () => setStoreDefaultWarehouse(storeId, inventoryId),
                  success: "Almacén por defecto actualizado",
                });
              }}
            >
              Cambiar almacén
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          // No se cierra a mitad de la petición.
          if (!open && !remove.isPending) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Eliminar almacén
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{pendingDelete?.name}</strong>. Solo se pueden eliminar
              almacenes vacíos, sin productos, movimientos, pedidos ni integraciones vinculadas.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirmar-eliminar-almacen">
              Para confirmar, escribe el nombre del almacén: <strong>{pendingDelete?.name}</strong>
            </Label>
            <Input
              id="confirmar-eliminar-almacen"
              value={confirmName}
              autoComplete="off"
              disabled={remove.isPending}
              onChange={(e) => setConfirmName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && deleteConfirmed && pendingDelete && !remove.isPending) {
                  e.preventDefault();
                  remove.mutate(pendingDelete.id);
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={!deleteConfirmed || remove.isPending}
              onClick={(e) => {
                // El diálogo se cierra al terminar la petición, no al hacer clic.
                e.preventDefault();
                if (!deleteConfirmed || !pendingDelete || remove.isPending) return;
                remove.mutate(pendingDelete.id);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlmacenModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSaved={() => {
          setOpenModal(false);
          invalidateRelatedCaches();
          void queryClient.invalidateQueries({ queryKey });
          void refreshInventories(); // Sincronizar estado global
        }}
      />
    </div>
  );
};

export default GestionAlmacenes;
