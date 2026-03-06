"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Home, Loader2, AlertTriangle } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import AlmacenModal from "../modals/AlmacenModal";
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

interface Inventory {
  id: string;
  name: string;
  is_active: boolean;
  store_id: string;
}

const GestionAlmacenes = () => {
  const [almacenes, setAlmacenes] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const { auth } = useAuth();
  const companyId = auth?.company?.id;

  const fetchAlmacenes = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_LOGISTICS}/inventory/company/${companyId}`,
      );
      setAlmacenes(response.data);
    } catch (error) {
      console.error("Error fetching almacenes:", error);
      toast.error("Error al cargar los almacenes");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchAlmacenes();
  }, [fetchAlmacenes]);

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory/${id}`,
      );
      toast.success("Almacén eliminado correctamente");
      fetchAlmacenes();
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.response?.data?.message || "Error al eliminar el almacén",
      );
    }
  };

  if (!companyId) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-6 rounded-lg border">
        <div>
          <h3 className="text-lg font-medium">Gestión de Almacenes</h3>
          <p className="text-sm text-muted-foreground">
            Administra los puntos de almacenamiento de tu empresa
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
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 w-32 bg-muted rounded mb-2" />
                <div className="h-4 w-48 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : almacenes.length > 0 ? (
          almacenes.map((almacen) => (
            <Card
              key={almacen.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">{almacen.name}</h4>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Activo
                      </p>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          ¿Eliminar almacén?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará el almacén{" "}
                          <strong>{almacen.name}</strong> y todo su stock
                          asociado. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => handleDelete(almacen.id)}
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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

      <AlmacenModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSaved={() => {
          setOpenModal(false);
          fetchAlmacenes();
        }}
      />
    </div>
  );
};

export default GestionAlmacenes;
