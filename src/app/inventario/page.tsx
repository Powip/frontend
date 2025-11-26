"use client";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Label from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import {
  Download,
  Edit,
  Eye,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface InventoryItem {
  id: string;
  inventory_id: string;
  product_id: string;
  quantity: number;
}

interface Inventory {
  id: string;
  name: string;
  store_id: string;
  items: InventoryItem[];
  status: boolean;
}

export default function InventarioPage() {
  const { auth, selectedStoreId, logout } = useAuth();
  const [inventories, setInventories] = useState<Inventory[]>([]); // falta tipo
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  const stores = auth?.company?.stores || [];

  const currentStore =
    stores.find((s) => s.id === selectedStoreId) || stores[0];

  useEffect(() => {
    const storeId = selectedStoreId ?? null;

    if (!storeId) return;

    const fetchInventories = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory/store/${storeId}`
        );
        setInventories(response.data);
      } catch (error) {
        console.log("Error al obtener inventarios", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInventories();
  }, [selectedStoreId]);

  useEffect(() => {
    if (inventories.length > 0 && !selectedInventoryId) {
      setSelectedInventoryId(inventories[0].id); // ⭐ primer inventario por defecto
    }
  }, [inventories]);

  const paginatedProducts: InventoryItem[] = [];

  return (
    <div className="h-screen flex flex-col px-6">
      <HeaderConfig
        title="Inventario"
        description="Gestión de productos y control de stock por tienda"
      />
      <Card>
        <CardContent className="p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row ms:items-center sm:gap-4">
            <div className="flex-1 sm:max-w-xs">
              <Label
                htmlFor="inventory-select"
                className="mb-2 block text-sm font-medium"
              >
                Seleccionar Inventario
              </Label>

              <Select
                value={selectedInventoryId || undefined}
                onValueChange={(value) => setSelectedInventoryId(value)}
              >
                <SelectTrigger id="inventory-select">
                  <SelectValue placeholder="Seleccionar inventario" />
                </SelectTrigger>
                <SelectContent>
                  {inventories.map((inventory) => (
                    <SelectItem key={inventory.id} value={inventory.id}>
                      {inventory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Tienda:</p>
                <p className="font-medium">
                  {currentStore?.name || "Sin tienda"}
                </p>
              </div>
            </div>
          </div>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o SKU..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar producto
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Agregar Nuevo Producto</DialogTitle>
                    <DialogDescription>
                      Completa la información del producto
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="productName">Nombre del Producto</Label>
                        <Input
                          id="productName"
                          placeholder="Ej: Camiseta Básica"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="productDescription">Descripcion</Label>
                        <Textarea
                          id="productDescription"
                          placeholder="Ej: SKU-001"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="category">Categoría</Label>
                        <Select>
                          <SelectTrigger id="category">
                            <SelectValue placeholder="Selecciona categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ropa">Ropa</SelectItem>
                            <SelectItem value="Calzado">Calzado</SelectItem>
                            <SelectItem value="Electrónica">
                              Electrónica
                            </SelectItem>
                            <SelectItem value="Accesorios">
                              Accesorios
                            </SelectItem>
                            <SelectItem value="Hogar">Hogar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="subcategory">Subcategorías</Label>
                        <Select>
                          <SelectTrigger id="subcategory">
                            <SelectValue placeholder="Selecciona categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ropa">Ropa</SelectItem>
                            <SelectItem value="Calzado">Calzado</SelectItem>
                            <SelectItem value="Electrónica">
                              Electrónica
                            </SelectItem>
                            <SelectItem value="Accesorios">
                              Accesorios
                            </SelectItem>
                            <SelectItem value="Hogar">Hogar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="costPrice">Precio de Costo</Label>
                        <Input id="costPrice" type="number" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="salePrice">Precio de Venta</Label>
                        <Input id="salePrice" type="number" placeholder="0" />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="stock">Stock</Label>
                        <Input id="stock" type="number" placeholder="0.00" />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline">Cancelar</Button>
                      <Button>Crear Producto</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Products Table */}
          <div className="mb-6 rounded-md border min-h-[18rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Precio de Venta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.length > 0 ? (
                  paginatedProducts.map((product) => {
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">REM-2001</TableCell>
                        <TableCell>REMERA</TableCell>
                        <TableCell>ROPA</TableCell>
                        <TableCell className="font-medium">40</TableCell>
                        <TableCell>$9.10</TableCell>
                        <TableCell>
                          <Badge variant="default">Disponible</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Editar">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
