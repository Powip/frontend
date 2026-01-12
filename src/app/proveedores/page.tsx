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
  Building2,
  Tag,
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
import { useRouter } from "next/navigation";

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  brands?: Brand[];
}

interface Brand {
  id: string;
  name: string;
  supplier: { id: string; name: string };
  isActive: boolean;
}

export default function ProveedoresPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [selectedSupplierForBrand, setSelectedSupplierForBrand] =
    useState<Supplier | null>(null);
  
  // Loading states for save buttons
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [isSavingBrand, setIsSavingBrand] = useState(false);

  // Forms
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
  });

  const [brandForm, setBrandForm] = useState({
    name: "",
    supplierId: "",
  });
    
  useEffect(() => {
    if (companyId) {
      fetchSuppliers();
    }
  }, [companyId]);

  const fetchSuppliers = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const res = await axios.get<Supplier[]>(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/suppliers/company/${companyId}`
      );
      setSuppliers(res.data);
    } catch (error) {
      console.error("Error fetching suppliers", error);
      toast.error("Error al cargar proveedores");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (supplierId: string) => {
    const newExpanded = new Set(expandedSuppliers);
    if (newExpanded.has(supplierId)) {
      newExpanded.delete(supplierId);
    } else {
      newExpanded.add(supplierId);
    }
    setExpandedSuppliers(newExpanded);
  };

  // ==================== SUPPLIER CRUD ====================
  const handleOpenSupplierModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setSupplierForm({
        name: supplier.name,
        contactPerson: supplier.contactPerson || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
      });
    } else {
      setEditingSupplier(null);
      setSupplierForm({ name: "", contactPerson: "", phone: "", email: "" });
    }
    setSupplierModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name) {
      toast.error("El nombre es requerido");
      return;
    }

    setIsSavingSupplier(true);
    try {
      if (editingSupplier) {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/suppliers/${editingSupplier.id}`,
          supplierForm
        );
        toast.success("Proveedor actualizado");
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/suppliers`,
          { ...supplierForm, companyId }
        );
        toast.success("Proveedor creado");
      }
      setSupplierModalOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error("Error saving supplier", error);
      toast.error("Error al guardar proveedor");
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (!confirm(`¿Eliminar proveedor "${supplier.name}"?`)) return;

    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/suppliers/${supplier.id}`
      );
      toast.success("Proveedor eliminado");
      fetchSuppliers();
    } catch (error) {
      console.error("Error deleting supplier", error);
      toast.error("Error al eliminar proveedor");
    }
  };

  // ==================== BRAND CRUD ====================
  const handleOpenBrandModal = (supplier: Supplier, brand?: Brand) => {
    setSelectedSupplierForBrand(supplier);
    
    if (brand) {
      setEditingBrand(brand);
      setBrandForm({
        name: brand.name,
        supplierId: brand.supplier.id,
      });
    } else {
      setEditingBrand(null);
      setBrandForm({
        name: "",
        supplierId: supplier.id,
      });
    }
    setBrandModalOpen(true);
  };

  const handleSaveBrand = async () => {
    if (!brandForm.name || !brandForm.supplierId) {
      toast.error("Nombre y proveedor son requeridos");
      return;
    }

    setIsSavingBrand(true);
    try {
      if (editingBrand) {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/brands/${editingBrand.id}`,
          brandForm
        );
        toast.success("Marca actualizada");
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/brands`,
          brandForm
        );
        toast.success("Marca creada");
      }
      setBrandModalOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error("Error saving brand", error);
      toast.error("Error al guardar marca");
    } finally {
      setIsSavingBrand(false);
    }
  };

  const handleDeleteBrand = async (brand: Brand) => {
    if (!confirm(`¿Eliminar marca "${brand.name}"?`)) return;

    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/brands/${brand.id}`
      );
      toast.success("Marca eliminada");
      fetchSuppliers();
    } catch (error) {
      console.error("Error deleting brand", error);
      toast.error("Error al eliminar marca");
    }
  };

  return (
    <div className="w-full px-6 pb-6">
      <HeaderConfig
        title="Proveedores"
        description="Gestiona proveedores y sus marcas"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Proveedores
          </CardTitle>
          <Button onClick={() => handleOpenSupplierModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Proveedor
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando proveedores...
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay proveedores registrados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Marcas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => {
                  const isExpanded = expandedSuppliers.has(supplier.id);
                  const brandsCount = supplier.brands?.length || 0;

                  return (
                    <Fragment key={supplier.id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(supplier.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">
                          {supplier.name}
                        </TableCell>
                        <TableCell>{supplier.contactPerson || "—"}</TableCell>
                        <TableCell>{supplier.phone || "—"}</TableCell>
                        <TableCell>{supplier.email || "—"}</TableCell>
                        <TableCell className="text-center">{brandsCount}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenSupplierModal(supplier)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSupplier(supplier)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Marcas expandidas */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30">
                            <div className="pl-12 py-4 space-y-2">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  <Tag className="h-4 w-4" />
                                  Marcas de {supplier.name}
                                </h4>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenBrandModal(supplier)}
                                  className="gap-1"
                                >
                                  <Plus className="h-3 w-3" />
                                  Agregar Marca
                                </Button>
                              </div>

                              {supplier.brands && supplier.brands.length > 0 ? (
                                <div className="space-y-1">
                                  {supplier.brands.map((brand) => (
                                    <div
                                      key={brand.id}
                                      className="flex items-center justify-between bg-background rounded-md p-2 border"
                                    >
                                      <span className="text-sm">{brand.name}</span>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            handleOpenBrandModal(supplier, brand)
                                          }
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteBrand(brand)}
                                        >
                                          <Trash2 className="h-3 w-3 text-red-500" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">
                                  No hay marcas registradas para este proveedor
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

      {/* Modal Proveedor */}
      <Dialog open={supplierModalOpen} onOpenChange={setSupplierModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Editar Proveedor" : "Nuevo Proveedor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Nombre *</Label>
              <Input
                id="supplier-name"
                value={supplierForm.name}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, name: e.target.value })
                }
                placeholder="Nombre del proveedor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-contact">Persona de Contacto</Label>
              <Input
                id="supplier-contact"
                value={supplierForm.contactPerson}
                onChange={(e) =>
                  setSupplierForm({
                    ...supplierForm,
                    contactPerson: e.target.value,
                  })
                }
                placeholder="Nombre del contacto"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-phone">Teléfono</Label>
                <Input
                  id="supplier-phone"
                  value={supplierForm.phone}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, phone: e.target.value })
                  }
                  placeholder="999999999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier-email">Email</Label>
                <Input
                  id="supplier-email"
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, email: e.target.value })
                  }
                  placeholder="email@ejemplo.com"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSupplierModalOpen(false)}
              disabled={isSavingSupplier}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveSupplier} disabled={isSavingSupplier}>
              {isSavingSupplier ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Marca */}
      <Dialog open={brandModalOpen} onOpenChange={setBrandModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? "Editar Marca" : "Nueva Marca"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Nombre *</Label>
              <Input
                id="brand-name"
                value={brandForm.name}
                onChange={(e) =>
                  setBrandForm({ ...brandForm, name: e.target.value })
                }
                placeholder="Nombre de la marca"
              />
            </div>

            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input
                value={selectedSupplierForBrand?.name || ""}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBrandModalOpen(false)} disabled={isSavingBrand}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBrand} disabled={isSavingBrand}>
              {isSavingBrand ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
