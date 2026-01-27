"use client";

import { useEffect, useState, Fragment } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Truck,
  FileText,
  Phone,
  Mail,
  Calendar,
} from "lucide-react";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  fetchCouriers,
  fetchCourierGuides,
  createCourier,
  updateCourier,
  deleteCourier,
  Courier,
  ShippingGuide,
} from "@/services/courierService";

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  CREADA: "secondary",
  ASIGNADA: "default",
  EN_RUTA: "default",
  ENTREGADA: "outline",
  FALLIDA: "destructive",
  CANCELADA: "destructive",
};

export default function CouriersPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;

  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [expandedCouriers, setExpandedCouriers] = useState<Set<string>>(
    new Set(),
  );
  const [courierGuides, setCourierGuides] = useState<
    Record<string, ShippingGuide[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingGuides, setLoadingGuides] = useState<Record<string, boolean>>(
    {},
  );

  // Modals
  const [courierModalOpen, setCourierModalOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    if (companyId) {
      loadCouriers();
    }
  }, [companyId]);

  const loadCouriers = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const data = await fetchCouriers(companyId);
      setCouriers(data);
    } catch (error) {
      console.error("Error loading couriers", error);
      toast.error("Error al cargar couriers");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = async (courierId: string) => {
    const newExpanded = new Set(expandedCouriers);
    if (newExpanded.has(courierId)) {
      newExpanded.delete(courierId);
    } else {
      newExpanded.add(courierId);
      // Load guides if not loaded
      if (!courierGuides[courierId]) {
        loadGuides(courierId);
      }
    }
    setExpandedCouriers(newExpanded);
  };

  const loadGuides = async (courierId: string) => {
    setLoadingGuides((prev) => ({ ...prev, [courierId]: true }));
    try {
      const guides = await fetchCourierGuides(courierId);
      setCourierGuides((prev) => ({ ...prev, [courierId]: guides }));
    } catch (error) {
      console.error("Error loading guides", error);
      toast.error("Error al cargar guías del courier");
    } finally {
      setLoadingGuides((prev) => ({ ...prev, [courierId]: false }));
    }
  };

  const handleOpenModal = (courier?: Courier) => {
    if (courier) {
      setEditingCourier(courier);
      setForm({
        name: courier.name,
        phone: courier.phone || "",
        email: courier.email || "",
      });
    } else {
      setEditingCourier(null);
      setForm({ name: "", phone: "", email: "" });
    }
    setCourierModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!companyId) return;

    setIsSaving(true);
    try {
      if (editingCourier) {
        await updateCourier(editingCourier.id, form);
        toast.success("Courier actualizado");
      } else {
        await createCourier({ ...form, companyId });
        toast.success("Courier creado");
      }
      setCourierModalOpen(false);
      loadCouriers();
    } catch (error) {
      console.error("Error saving courier", error);
      toast.error("Error al guardar courier");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (courier: Courier) => {
    if (!confirm(`¿Estás seguro de desactivar al courier "${courier.name}"?`))
      return;

    try {
      await deleteCourier(courier.id);
      toast.success("Courier desactivado");
      loadCouriers();
    } catch (error) {
      console.error("Error deleting courier", error);
      toast.error("Error al desactivar courier");
    }
  };

  return (
    <div className="w-full px-6 pb-6">
      <HeaderConfig
        title="Gestión de Couriers"
        description="Administra los repartidores y empresas de envío de tu flota"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Repartidores / Couriers
          </CardTitle>
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Courier
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando couriers...
            </div>
          ) : couriers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tienes couriers registrados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {couriers.map((courier) => {
                  const isExpanded = expandedCouriers.has(courier.id);
                  const guides = courierGuides[courier.id] || [];

                  return (
                    <Fragment key={courier.id}>
                      <TableRow
                        className={!courier.isActive ? "opacity-60" : ""}
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(courier.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{courier.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ID: {courier.id.slice(0, 8)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {courier.phone && (
                              <div className="flex items-center gap-1 text-xs">
                                <Phone className="h-3 w-3" /> {courier.phone}
                              </div>
                            )}
                            {courier.email && (
                              <div className="flex items-center gap-1 text-xs">
                                <Mail className="h-3 w-3" /> {courier.email}
                              </div>
                            )}
                            {!courier.phone && !courier.email && "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              courier.isActive ? "default" : "destructive"
                            }
                          >
                            {courier.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenModal(courier)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {courier.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(courier)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Guías expandidas */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            <div className="px-12 py-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  Guías de envío asignadas
                                </h4>
                              </div>

                              {loadingGuides[courier.id] ? (
                                <p className="text-sm text-muted-foreground">
                                  Cargando guías...
                                </p>
                              ) : guides.length > 0 ? (
                                <div className="border rounded-md bg-background overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableHead className="h-8 text-xs">
                                          Nº Guía
                                        </TableHead>
                                        <TableHead className="h-8 text-xs">
                                          Fecha
                                        </TableHead>
                                        <TableHead className="h-8 text-xs">
                                          Estado
                                        </TableHead>
                                        <TableHead className="h-8 text-xs">
                                          Dirección
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {guides.map((guide) => (
                                        <TableRow
                                          key={guide.id}
                                          className="hover:bg-muted/20"
                                        >
                                          <TableCell className="py-2 text-xs font-medium">
                                            {guide.guideNumber}
                                          </TableCell>
                                          <TableCell className="py-2 text-xs">
                                            {new Date(
                                              guide.created_at,
                                            ).toLocaleDateString()}
                                          </TableCell>
                                          <TableCell className="py-2">
                                            <Badge
                                              variant={
                                                STATUS_VARIANTS[guide.status] ||
                                                "default"
                                              }
                                              className="text-[10px] px-1.5 py-0 h-5"
                                            >
                                              {guide.status}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="py-2 text-xs truncate max-w-[200px]">
                                            {guide.deliveryAddress || "N/A"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">
                                  No hay guías registradas para este courier.
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal CRUD Courier */}
      <Dialog open={courierModalOpen} onOpenChange={setCourierModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCourier ? "Editar Courier" : "Nuevo Courier"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre / Razón Social *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Juan Pérez o Courier Express"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="999 999 999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="courier@ejemplo.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCourierModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
