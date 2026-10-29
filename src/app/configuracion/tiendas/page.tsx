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
import {
  Edit2,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Info,
  X,
} from "lucide-react";
import { updateCompany } from "@/services/companyService";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { isSuperadmin, hasAdminAccess } from "@/config/permissions.config";

interface Store {
  id: string;
  company_id?: string;
  color?: string | null;
  is_legacy?: boolean;
  is_active?: boolean;
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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CatalogoMarcas from "@/components/brands/CatalogoMarcas";
import GestionAlmacenes from "@/components/forms/GestionAlmacenes";
import GestionCouriers from "@/components/couriers/GestionCouriers";
import StoreSalesChannels from "@/components/stores/StoreSalesChannels";

export default function TiendasPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [newStore, setNewStore] = useState<NewStore>({
    name: "",
    description: "",
    url_web: "",
  });
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncingGlobal, setSyncingGlobal] = useState<boolean>(false);
  const { auth, logout, updateCompany: updateAuthCompany } = useAuth();
  const [shopifyConnectedShops, setShopifyConnectedShops] = useState<any[]>([]);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("tiendas");
  const [channelStoreId, setChannelStoreId] = useState("");
  const [storesError, setStoresError] = useState(false);

  // --- Canales de venta ---
  const [newSalesChannel, setNewSalesChannel] = useState("");

  const defaultChannels = [
    "TIENDA_FISICA",
    "WHATSAPP",
    "INSTAGRAM",
    "FACEBOOK",
    "MARKETPLACE",
    "MERCADOLIBRE",
    "WEB",
    "OTRO",
  ];

  const salesChannels = auth?.company?.sales_channels?.length
    ? auth.company.sales_channels
    : defaultChannels;

  const companyId = auth?.company?.id;
  const currentCompanyId = useRef(companyId);
  currentCompanyId.current = companyId;
  const companyOwnerId = (auth?.company as { userId?: string } | null)?.userId;
  const canManageStoreChannels =
    !!auth?.user &&
    (companyOwnerId === auth.user.id ||
      auth.user.permissions?.includes("MANAGE_ADVERTISING_CONNECTIONS"));
  const canAccess =
    !!auth?.user &&
    (hasAdminAccess(auth.user.role) ||
      isSuperadmin(auth.user.email) ||
      canManageStoreChannels);
  const commercialStores = stores.filter(
    (store) => !store.is_legacy && store.is_active !== false,
  );
  const legacyStoresCount = stores.filter((store) => store.is_legacy).length;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "canales") setActiveTab("canales");
    setChannelStoreId(params.get("storeId") ?? "");
  }, []);

  // Redirigir si no es admin o superadmin
  useEffect(() => {
    if (auth && auth.user && !canAccess) {
      toast.error("No tienes permisos para acceder a esta configuración");
      router.push("/dashboard");
    }
  }, [auth, canAccess, router]);

  const handleAddSalesChannel = async () => {
    const name = newSalesChannel.trim();
    if (!name || !companyId || !auth?.accessToken) return;
    if (salesChannels.includes(name)) {
      toast.error("Ese canal ya existe");
      return;
    }
    try {
      const updated = [...salesChannels, name];
      await updateCompany(companyId, auth.accessToken, {
        sales_channels: updated,
      });
      updateAuthCompany({ ...auth.company!, sales_channels: updated });
      setNewSalesChannel("");
      toast.success("Canal de venta agregado");
    } catch {
      toast.error("Error al agregar canal");
    }
  };

  const handleRemoveSalesChannel = async (channel: string) => {
    if (!companyId || !auth?.accessToken) return;
    try {
      const updated = salesChannels.filter((c) => c !== channel);
      await updateCompany(companyId, auth.accessToken, {
        sales_channels: updated,
      });
      updateAuthCompany({ ...auth.company!, sales_channels: updated });
      toast.success("Canal de venta eliminado");
    } catch {
      toast.error("Error al eliminar canal");
    }
  };

  const handleSyncAll = async () => {
    if (shopifyConnectedShops.length === 0) return;
    setSyncingGlobal(true);

    try {
      toast.info("Iniciando sincronización global...");
      const integrationApiUrl =
        process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3007";

      // Sincronizar todas las tiendas en paralelo
      const syncPromises = shopifyConnectedShops.map((shop) =>
        axios.post(`${integrationApiUrl}/shopify/sync/${shop.shop_url}`, {
          accessToken: "dynamic",
        }),
      );

      const results = await Promise.all(syncPromises);

      let totalOrders = 0;

      results.forEach((res) => {
        totalOrders += res.data.orders_synced || 0;
      });

      if (totalOrders === 0) {
        toast.success(
          "Sincronización finalizada: No se encontraron nuevas órdenes en ninguna tienda.",
        );
      } else {
        toast.success(
          `Sincronización finalizada: ${totalOrders} órdenes importadas de ${shopifyConnectedShops.length} tiendas.`,
        );
      }
    } catch (error) {
      console.error("Error en sincronización global:", error);
      toast.error("Error al sincronizar tiendas Shopify");
    } finally {
      setSyncingGlobal(false);
    }
  };

  const fetchStore = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setStoresError(false);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_COMPANY}/company/${companyId}`,
      );
      if (currentCompanyId.current !== companyId) return;
      if (
        response.data?.id !== companyId ||
        !Array.isArray(response.data.stores) ||
        response.data.stores.some(
          (store: Store) =>
            !store ||
            typeof store.id !== "string" ||
            typeof store.name !== "string" ||
            (store.company_id !== undefined && store.company_id !== companyId),
        )
      ) {
        throw new Error("Invalid store context");
      }
      setStores(response.data.stores);
    } catch {
      if (currentCompanyId.current === companyId) {
        setStores([]);
        setStoresError(true);
      }
    } finally {
      if (currentCompanyId.current === companyId) setLoading(false);
    }
  }, [companyId]);

  const fetchShopifyStatus = useCallback(async () => {
    try {
      if (!companyId) return;
      const integrationApiUrl =
        process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3007";
      const response = await axios.get(
        `${integrationApiUrl}/shopify/status/${companyId}`,
      );
      if (currentCompanyId.current === companyId)
        setShopifyConnectedShops(
          Array.isArray(response.data) ? response.data : [],
        );
    } catch {
      // Shopify no disponible: se omite sin afectar la página
      if (currentCompanyId.current === companyId) setShopifyConnectedShops([]);
    }
  }, [companyId]);

  useEffect(() => {
    setStores([]);
    setShopifyConnectedShops([]);
    if (companyId) {
      void fetchStore();
      void fetchShopifyStatus();
    }
  }, [companyId, fetchStore, fetchShopifyStatus]);

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

  if (!auth || !canAccess) return null;

  if (loading) {
    return (
      <div className="px-10 py-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-10 w-full max-w-md mb-8" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <HeaderConfig
        title="Administración de la Empresa"
        description="Gestiona tiendas, almacenes, marcas, canales de venta y couriers"
      />

      <div className="px-4 sm:px-6 lg:px-10">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="h-auto flex-wrap justify-start bg-muted p-1">
            <TabsTrigger value="tiendas">Tiendas</TabsTrigger>
            <TabsTrigger value="almacenes">Almacenes</TabsTrigger>
            <TabsTrigger value="marcas">Marcas</TabsTrigger>
            <TabsTrigger value="canales">Canales de Venta</TabsTrigger>
            <TabsTrigger value="couriers">Couriers</TabsTrigger>
          </TabsList>

          <TabsContent value="tiendas" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Tus tiendas</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {shopifyConnectedShops.length > 0 ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 border-teal-600 text-teal-600 hover:bg-teal-50 shadow-sm"
                        onClick={handleSyncAll}
                        disabled={syncingGlobal}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${syncingGlobal ? "animate-spin" : ""}`}
                        />
                        {syncingGlobal
                          ? "Sincronizando..."
                          : "Sincronizar con Shopify"}
                      </Button>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0 text-gray-400 hover:text-teal-600"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Conexión Shopify Partner</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-teal-800 font-medium px-1">
                                <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                                Tiendas vinculadas (
                                {shopifyConnectedShops.length})
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

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <p className="text-sm text-blue-700 mb-3">
                                ¿Necesitas conectar una nueva sucursal o tienda
                                adicional?
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
                    </div>
                  ) : (
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
                          <DialogTitle>
                            Conectar con Shopify Partner
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6">
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2 text-amber-800 font-medium">
                              <AlertTriangle className="h-5 w-5" />
                              Sin integraciones activas
                            </div>
                            <p className="text-sm text-amber-700 leading-relaxed">
                              No hay tiendas de Shopify vinculadas a tu cuenta
                              de Powip. Para habilitar la sincronización
                              automática, por favor solicita a soporte tus{" "}
                              <strong>enlaces de instalación</strong> para cada
                              sucursal.
                            </p>
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-700 mb-3">
                              ¿Necesitas conectar una nueva sucursal o tienda
                              adicional?
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
                  )}

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
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
                          <Label htmlFor="store-name">
                            Nombre de la tienda
                          </Label>
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
                          <Label htmlFor="store-description">Descripción</Label>
                          <Textarea
                            id="store-description"
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
                              setNewStore({
                                ...newStore,
                                url_web: e.target.value,
                              })
                            }
                          />
                        </div>

                        <Button onClick={handleAddStore} className="w-full">
                          Crear tienda
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {storesError ? (
                    <div role="alert" className="rounded-lg border p-4 text-sm">
                      No se pudieron cargar las tiendas.
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-3"
                        onClick={() => void fetchStore()}
                      >
                        Reintentar
                      </Button>
                    </div>
                  ) : null}
                  {legacyStoresCount > 0 ? (
                    <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                      La tienda inicial conserva sus ventas y almacenes.
                      {commercialStores.length === 0
                        ? " Crea una tienda comercial para nuevas ventas y asignaciones."
                        : ""}
                    </p>
                  ) : null}
                  {!storesError && commercialStores.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">
                      Aún no hay tiendas comerciales.
                    </p>
                  ) : null}
                  {commercialStores.map((store) => (
                    <div
                      key={store.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h4 className="flex items-center gap-2 font-medium">
                          {store.color &&
                          /^#[0-9a-f]{6}$/i.test(store.color) ? (
                            <span
                              className="size-3 rounded-full"
                              style={{ backgroundColor: store.color }}
                              aria-hidden="true"
                            />
                          ) : null}
                          {store.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {store.description}
                        </p>
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
                      <div className="flex flex-wrap gap-2 items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setChannelStoreId(store.id);
                            setActiveTab("canales");
                          }}
                        >
                          Canales
                        </Button>
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
                                .then((response) => {
                                  const { total_found, orders_synced } =
                                    response.data;
                                  if (total_found === 0) {
                                    toast.success(
                                      "Sincronización finalizada: No se encontraron nuevas órdenes.",
                                    );
                                  } else {
                                    toast.success(
                                      `Sincronización finalizada: ${orders_synced} órdenes importadas.`,
                                    );
                                  }
                                })
                                .catch(() =>
                                  toast.error("Error sincronizando"),
                                );
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
                              aria-label={`Editar ${store.name}`}
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
                                  <Label htmlFor="edit-store-desc">
                                    Descripción
                                  </Label>
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
                                  className="w-full"
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
                              aria-label={`Eliminar ${store.name}`}
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
                                    <strong>&quot;{store.name}&quot;</strong>.
                                    Esta acción no se puede deshacer.
                                  </p>
                                  <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-3">
                                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                                      Al eliminar esta tienda perderás:
                                    </p>
                                    <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                                      <li>Todos los inventarios asociados</li>
                                      <li>
                                        Productos registrados en la tienda
                                      </li>
                                      <li>Historial de ventas</li>
                                      <li>Estadísticas y trazabilidad</li>
                                    </ul>
                                  </div>
                                  {stores.length <= 1 && (
                                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                                      ⚠️ No puedes eliminar la última tienda de
                                      tu empresa.
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
          </TabsContent>

          <TabsContent value="almacenes">
            <GestionAlmacenes />
          </TabsContent>

          <TabsContent value="marcas">
            <CatalogoMarcas />
          </TabsContent>

          <TabsContent value="canales" className="space-y-6">
            <StoreSalesChannels
              key={`${auth.user.id}:${companyId}:${channelStoreId}`}
              stores={commercialStores}
              initialStoreId={channelStoreId}
              canManage={canManageStoreChannels}
              onColorChange={(storeId, color) =>
                setStores((rows) =>
                  rows.map((store) =>
                    store.id === storeId ? { ...store, color } : store,
                  ),
                )
              }
            />
            <Card>
              <CardHeader>
                <CardTitle>Tipos de canal</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Opciones generales para ventas sin un canal de tienda
                  registrado.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {salesChannels.map((channel) => (
                      <span
                        key={channel}
                        className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm text-teal-800"
                      >
                        {channel}
                        <button
                          onClick={() => handleRemoveSalesChannel(channel)}
                          className="ml-1 rounded-full p-0.5 hover:bg-teal-200 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 max-w-md">
                    <Input
                      placeholder="Nuevo canal..."
                      value={newSalesChannel}
                      onChange={(e) => setNewSalesChannel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddSalesChannel();
                      }}
                    />
                    <Button
                      size="sm"
                      className="gap-1 bg-teal-600 hover:bg-teal-700 shrink-0"
                      onClick={handleAddSalesChannel}
                      disabled={!newSalesChannel.trim()}
                    >
                      <Plus className="h-4 w-4" />
                      Agregar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="couriers">
            <GestionCouriers />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
