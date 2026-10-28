"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Home } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  listWarehouses,
  setMainWarehouse,
  setStoreDefaultWarehouse,
  setWarehouseType,
  type WarehouseType,
} from "@/services/warehousesService";
import AlmacenModal from "../modals/AlmacenModal";
import { WAREHOUSE_TYPE_OPTIONS, warehouseErrorMessage } from "./warehouseUi";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const LOAD_ERROR = "No se pudieron cargar los almacenes. Inténtalo de nuevo.";

interface WarehouseChange {
  run: () => Promise<void>;
  success: string;
}

const GestionAlmacenes = () => {
  const [openModal, setOpenModal] = useState(false);
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

  const change = useMutation({
    mutationFn: ({ run }: WarehouseChange) => run(),
    onSuccess: async (_data, { success }) => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success(success);
    },
    onError: (error) => {
      toast.error(warehouseErrorMessage(error, "No se pudo guardar el cambio. Inténtalo de nuevo."));
    },
  });

  // Activos primero; el orden del backend se conserva dentro de cada grupo.
  const warehouses = useMemo(() => {
    const all = query.data?.warehouses ?? [];
    return [...all.filter((w) => w.status), ...all.filter((w) => !w.status)];
  }, [query.data]);
  const links = query.data?.links ?? [];
  const storeName = (id: string) => stores.find((store) => store.id === id)?.name ?? "—";
  const busy = change.isPending;

  if (!companyId) return null;

  const defaultFor = (storeId: string) =>
    links.find((link) => link.store_id === storeId && link.is_default)?.inventory_id ?? "";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-6 rounded-lg border">
        <div>
          <h3 className="text-lg font-medium">Gestión de Almacenes</h3>
          <p className="text-sm text-muted-foreground">
            Los almacenes son de tu empresa y se pueden compartir entre tiendas
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {query.isPending ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 w-32 bg-muted rounded mb-2" />
                <div className="h-4 w-48 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : loadError ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center gap-3 border border-dashed rounded-lg">
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
          warehouses.map((almacen) => (
            <Card
              key={almacen.id}
              data-testid={`warehouse-${almacen.id}`}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="space-y-4 px-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                    <Home className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium">{almacen.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {`Tienda de origen: ${storeName(almacen.store_id)}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {almacen.is_main && <Badge>Principal</Badge>}
                    {!almacen.status && <Badge variant="outline">Inactivo</Badge>}
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <span className="text-xs text-muted-foreground" aria-hidden="true">
                      Tipo
                    </span>
                    <select
                      aria-label={`Tipo de ${almacen.name}`}
                      className={SELECT_CLASS}
                      value={almacen.type}
                      disabled={busy || !almacen.status}
                      onChange={(e) => {
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
                  </div>
                  {almacen.status && !almacen.is_main && (
                    <Button
                      variant="outline"
                      disabled={busy}
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
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 flex flex-col items-center justify-center border border-dashed rounded-lg">
            <Home className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground">
              No tienes almacenes creados aún
            </p>
          </div>
        )}
      </div>

      {!query.isPending && !loadError && stores.length > 0 && warehouses.length > 0 && (
        <div className="space-y-3 bg-card p-6 rounded-lg border">
          <div>
            <h3 className="text-lg font-medium">Almacén por defecto de cada tienda</h3>
            <p className="text-sm text-muted-foreground">
              Las ventas de la tienda salen de este almacén, salvo que se elija otro al
              confirmar el pedido.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => {
              const current = defaultFor(store.id);
              // Un almacén inactivo no se ofrece, salvo que sea el actual (para no mostrar un valor vacío).
              const options = warehouses.filter((w) => w.status || w.id === current);
              return (
                <div key={store.id} className="space-y-1">
                  <p className="text-sm font-medium">{store.name}</p>
                  <span className="text-xs text-muted-foreground" aria-hidden="true">
                    Almacén por defecto
                  </span>
                  <select
                    aria-label={`Almacén por defecto de ${store.name}`}
                    className={SELECT_CLASS}
                    value={current}
                    disabled={busy}
                    onChange={(e) => {
                      // Se lee ya: el select controlado vuelve a su valor antes de que corra la mutación.
                      const inventoryId = e.target.value;
                      change.mutate({
                        run: () => setStoreDefaultWarehouse(store.id, inventoryId),
                        success: "Almacén por defecto actualizado",
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

      <AlmacenModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSaved={() => {
          setOpenModal(false);
          void queryClient.invalidateQueries({ queryKey });
          void refreshInventories(); // Sincronizar estado global
        }}
      />
    </div>
  );
};

export default GestionAlmacenes;
