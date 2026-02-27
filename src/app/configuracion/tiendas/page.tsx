"use client";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";
import { Edit2, Plus, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";

interface Store {
  id?: string;
  name: string;
  description: string;
  url_web: string;
  created_at?: Date;
}

interface NewStore {
  name: string;
  description: string;
  url_web: string;
}

export default function TiendasPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [newStore, setNewStore] = useState<NewStore>({
    name: "",
    description: "",
    url_web: "",
  });
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { auth, logout } = useAuth();
  const [shopifyConnectedShops, setShopifyConnectedShops] = useState<any[]>([]);

  const fetchStore = useCallback(async () => {
    setLoading(true);
    try {
      if (!auth?.company?.id) return;

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_COMPANY}/company/${auth.company.id}`,
      );

      setStores(response.data?.stores);
    } catch (error) {
      console.error("Error obteniendo tiendas:", error);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  const fetchShopifyStatus = useCallback(async () => {
    try {
      if (!auth?.company?.id) return;
      const integrationApiUrl =
        process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3007";
      const response = await axios.get(
        `${integrationApiUrl}/shopify/status/${auth.company.id}`,
      );
      setShopifyConnectedShops(response.data);
    } catch (error) {
      console.error("Error checking shopify status:", error);
    }
  }, [auth]);

  useEffect(() => {
    if (auth?.company?.id) {
      fetchStore();
      fetchShopifyStatus();
    }
  }, [auth, fetchStore, fetchShopifyStatus]);

  const handleAddStore = async () => {
    try {
      if (!newStore.name) return;
      if (!auth?.company?.id) return;

      await axios.post(`${process.env.NEXT_PUBLIC_API_COMPANY}/stores`, {
        ...newStore,
        company_id: auth.company.id,
      });
      toast.success("Tienda agregada correctamente");

      await fetchStore();

      // Reset formulario
      setNewStore({ name: "", description: "", url_web: "" });
    } catch (error) {
      console.error("Error creando tienda:", error);
    }
  };

  const handleEditStore = (store: Store) => {
    setEditingStore(store);
  };

  const handleUpdateStore = async () => {
    if (!editingStore) return;

    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COMPANY}/stores/${editingStore.id}`,
        {
          name: editingStore.name,
          description: editingStore.description,
          url_web: editingStore.url_web,
        },
      );
      toast.success("Tienda Actualizada correctamente!");

      await fetchStore();

      setEditingStore(null);
    } catch (error) {
      console.error("Error editando tienda:", error);
    }
  };

  const handleDeleteStore = async (id: string) => {
    try {
      const response = await axios.delete(
        `${process.env.NEXT_PUBLIC_API_COMPANY}/stores/${id}`,
      );

      if (response.status === 200) {
        toast.success("Tienda Eliminada");
      }

      await fetchStore();
    } catch (error: any) {
      if (error?.response.data.statusCode === 400) {
        toast.error("No podemos borrar la ultima compañia");
      }
    }
  };

  if (!auth) return null;

  if (loading) {
    return (
      <div>
        {/* Header skeleton */}
        <div className="mb-6 px-10">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Card skeleton */}
        <Card className="mx-10">
          <CardHeader className="flex flex-row items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Store items skeleton */}
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-9 w-9 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <HeaderConfig
        title="Gestión de Tiendas"
        description="Crea y administra tus tiendas"
      />
      <Card className="mx-10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tus tiendas</CardTitle>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-teal-600 text-teal-600 hover:bg-teal-50"
                >
                  <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center text-[10px] text-white">
                    S
                  </div>
                  Conectar Shopify
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Conectar con Shopify Partner</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  {shopifyConnectedShops.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-amber-800 font-medium">
                        <AlertTriangle className="h-5 w-5" />
                        Sin integraciones activas
                      </div>
                      <p className="text-sm text-amber-700 leading-relaxed">
                        No hay tiendas de Shopify vinculadas a tu cuenta de
                        Powip. Para habilitar la sincronización automática, por
                        favor solicita a soporte tus{" "}
                        <strong>enlaces de instalación</strong> para cada
                        sucursal.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-teal-800 font-medium px-1">
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                        Tiendas vinculadas ({shopifyConnectedShops.length})
                      </div>
                      <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                        {shopifyConnectedShops.map((s, idx) => (
                          <div
                            key={idx}
                            className="bg-green-50 border border-green-200 rounded-lg p-3"
                          >
                            <p className="text-[10px] text-green-700 uppercase font-bold tracking-wider mb-1">
                              Dominio Shopify:
                            </p>
                            <p className="text-xs font-mono text-green-900 bg-white/50 p-1.5 rounded border border-green-100 truncate">
                              {s.shop_url}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-700 mb-3">
                      ¿Necesitas conectar una nueva sucursal o tienda adicional?
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-blue-300 text-blue-800 hover:bg-blue-100"
                      onClick={() => {
                        window.open(
                          "https://wa.me/tu-numero-de-soporte",
                          "_blank",
                        );
                      }}
                    >
                      Contactar a Soporte
                    </Button>
                  </div>

                  <div className="pt-2 border-t text-center">
                    <p className="text-[10px] text-gray-400">
                      ID Compañía: {auth?.company?.id}
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="gap-2 bg-teal-600 hover:bg-teal-700"
                >
                  <Plus className="h-4 w-4" />
                  Nueva tienda
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Crear nueva tienda</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="store-name">Nombre de la tienda</Label>
                    <Input
                      id="store-name"
                      placeholder="Ej: Tienda Centro"
                      value={newStore.name}
                      onChange={(e) =>
                        setNewStore({ ...newStore, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-city">Descripción</Label>
                    <Textarea
                      value={newStore.description}
                      onChange={(e) =>
                        setNewStore({
                          ...newStore,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-url">
                      URL de la tienda (opcional)
                    </Label>
                    <Input
                      id="store-url"
                      placeholder="Ej: www.sitioweb.com"
                      value={newStore.url_web ?? ""}
                      onChange={(e) =>
                        setNewStore({ ...newStore, url_web: e.target.value })
                      }
                    />
                  </div>

                  <Button
                    onClick={handleAddStore}
                    className="w-full bg-teal-600 hover:bg-teal-700"
                  >
                    Crear tienda
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stores.map((store) => (
              <div
                key={store.id}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div>
                  <h4 className="font-medium">{store.name}</h4>
                  <p className="text-sm text-gray-500">{store.description}</p>
                  <span className="inline-block mt-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                    Activa
                  </span>
                  {shopifyConnectedShops.some(
                    (s) => s.store_id === store.id,
                  ) && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-teal-600 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      Vinculada con Shopify (
                      {
                        shopifyConnectedShops.find(
                          (s) => s.store_id === store.id,
                        )?.shop_url
                      }
                      )
                    </div>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  {shopifyConnectedShops.some(
                    (s) => s.store_id === store.id,
                  ) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                      onClick={() => {
                        const shopInfo = shopifyConnectedShops.find(
                          (s) => s.store_id === store.id,
                        );
                        if (!shopInfo) return;

                        toast.info(
                          `Iniciando sincronización de ${shopInfo.shop_url}...`,
                        );
                        const integrationApiUrl =
                          process.env.NEXT_PUBLIC_API_INTEGRATIONS ||
                          "http://localhost:3007";
                        axios
                          .post(
                            `${integrationApiUrl}/shopify/sync/${shopInfo.shop_url}`,
                            {
                              accessToken: "dynamic",
                            },
                          )
                          .then(() =>
                            toast.success("Sincronización finalizada"),
                          )
                          .catch(() => toast.error("Error sincronizando"));
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Sincronizar
                    </Button>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditStore(store)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Editar tienda</DialogTitle>
                      </DialogHeader>
                      {editingStore && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-store-name">
                              Nombre de la tienda
                            </Label>
                            <Input
                              id="edit-store-name"
                              value={editingStore.name}
                              onChange={(e) =>
                                setEditingStore({
                                  ...editingStore,
                                  name: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-store-url">
                              URL de la tienda
                            </Label>
                            <Input
                              id="edit-store-url"
                              value={editingStore.url_web ?? ""}
                              onChange={(e) =>
                                setEditingStore({
                                  ...editingStore,
                                  url_web: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-store-desc">Descripción</Label>
                            <Input
                              id="edit-store-desc"
                              value={editingStore.description}
                              onChange={(e) =>
                                setEditingStore({
                                  ...editingStore,
                                  description: e.target.value,
                                })
                              }
                            />
                          </div>
                          <Button
                            onClick={handleUpdateStore}
                            className="w-full bg-teal-600 hover:bg-teal-700"
                          >
                            Guardar cambios
                          </Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={stores.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          ¿Eliminar tienda?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-3">
                            <p>
                              Estás a punto de eliminar la tienda{" "}
                              <strong>&quot;{store.name}&quot;</strong>. Esta
                              acción no se puede deshacer.
                            </p>
                            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-3">
                              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                                Al eliminar esta tienda perderás:
                              </p>
                              <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                                <li>Todos los inventarios asociados</li>
                                <li>Productos registrados en la tienda</li>
                                <li>Historial de ventas</li>
                                <li>Estadísticas y trazabilidad</li>
                              </ul>
                            </div>
                            {stores.length <= 1 && (
                              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                                ⚠️ No puedes eliminar la última tienda de tu
                                empresa.
                              </p>
                            )}
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() =>
                            store.id && handleDeleteStore(store.id)
                          }
                        >
                          Eliminar tienda
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
