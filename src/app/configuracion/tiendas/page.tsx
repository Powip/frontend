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
import Label from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/src/components/ui/skeleton";
import axios from "axios";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

  useEffect(() => {
    console.log(auth);

    if (auth?.company?.id) {
      fetchStore();
    }
  }, [auth]);

  const fetchStore = async () => {
    setLoading(true);
    try {
      if (!auth?.company?.id) return;

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_COMPANY}/company/${auth.company.id}`
      );
      console.log(response.data?.stores);

      setStores(response.data?.stores);
    } catch (error) {
      console.error("Error obteniendo tiendas:", error);
    } finally {
      setLoading(false);
    }
  };

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
        }
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
        `${process.env.NEXT_PUBLIC_API_COMPANY}/stores/${id}`
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

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))}
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
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 bg-teal-600 hover:bg-teal-700">
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
                      setNewStore({ ...newStore, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-url">URL de la tienda (opcional)</Label>
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
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stores.map((store) => (
              <div
                key={store.id}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
              >
                <div>
                  <h4 className="font-medium">{store.name}</h4>
                  <p className="text-sm text-gray-500">{store.description}</p>
                  <span className="inline-block mt-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                    Activa
                  </span>
                </div>
                <div className="flex gap-2">
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
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => store.id && handleDeleteStore(store.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
