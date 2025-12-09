"use client";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Download, Edit, Eye, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";
import { Badge } from "@/components/ui/badge";

interface InventoryItem {
  id: string;
  variant_id: string;
  quantity: number;
  min_stock: number;
}

interface Inventory {
  id: string;
  name: string;
  store_id: string;
  items: InventoryItem[];
  status: boolean;
}

interface ProductVariantDetail {
  id: string;
  sku: string;
  priceVta: number;
  attributeValues: Record<string, string>;
  product: {
    id: string;
    name: string;
    description: string;
    sku: string;
    companyId: string;
    inventory_id: string;
    status: boolean;
    hasVariants: boolean;
  };
}

export default function InventarioPage() {
  const { auth, selectedStoreId, logout } = useAuth();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [productsWithDetails, setProductsWithDetails] = useState<any[]>([]);

  const stores = auth?.company?.stores || [];

  const currentStore =
    stores.find((s) => s.id === selectedStoreId) || stores[0];

  useEffect(() => {
    /* const storeId = selectedStoreId ?? null;

    if (!storeId) return; */

    const fetchInventories = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/inventory/17bb91d3-8dfb-4f8a-8f3e-93ad2498b5f4`
        );

        console.log("📦 Inventory items:", response.data);

        setInventories([
          {
            id: "virtual",
            name: "Inventario",
            store_id: currentStore?.id ?? "virtual-store",
            status: true,
            items: response.data,
          },
        ]);
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

  useEffect(() => {
    const loadVariantDetails = async () => {
      if (!inventories || inventories.length === 0) return;

      const inventory = inventories[0]; // o el seleccionado por el usuario
      const items = inventory.items || [];

      const results = [];

      for (const item of items) {
        try {
          const { data: variant } = await axios.get(
            `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/product-variant/${item.variant_id}`
          );

          results.push({
            inventoryItemId: item.id,
            variantId: item.variant_id,
            quantity: item.quantity,
            min_stock: item.min_stock,

            // Datos de la variante desde ms-products
            sku: variant.sku,
            name: variant.product.name,
            attributes: variant.attributeValues,
            priceVta: Number(variant.priceVta),
          });
        } catch (err) {
          console.log("❌ Error obteniendo detalle de variante:", err);
        }
      }

      setProductsWithDetails(results);
    };

    loadVariantDetails();
  }, [inventories]);

  const paginatedProducts = productsWithDetails;

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
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
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
                {productsWithDetails.length > 0 ? (
                  productsWithDetails.map((product) => (
                    <TableRow key={product.inventoryItemId}>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>
                        {Object.entries(product.attributes)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(" / ")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.quantity}
                      </TableCell>
                      <TableCell>${product.priceVta}</TableCell>

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
                          <Button variant="ghost" size="icon" title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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
