"use client";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ExcelJS from "exceljs";
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
  Loader2,
  Search,
  Plus,
  Pencil,
  Trash2,
  ShoppingCart,
  ShoppingBag,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import AlmacenModal from "@/components/modals/AlmacenModal";

import AddStockModal from "@/components/modals/AddStockModal";
import DeleteInventoryItemModal from "@/components/modals/DeleteInventoryItemModal";
import ImportExcelModal from "@/components/modals/ImportExcelModal";
import { Pagination } from "@/components/ui/pagination";
import ShopifySyncWizard from "../productos/shopify-sync-wizard";

const ITEMS_PER_PAGE = 10;

interface VariantBatchItem {
  id: string;
  sku: string;
  priceVta: number;
  priceBase: number;
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

interface ProductWithInventoryDetails {
  inventoryItemId: string;
  variantId: string;
  quantity: number;
  min_stock: number;

  descripcion: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  priceBase: number;
  priceVta: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  companyId: string;
  inventory_id: string;
  status: boolean;
  hasVariants: boolean;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface InventoryItem {
  id: string;
  variant_id: string;
  product: Product;
  sku: string;
  attributeValues: Record<string, string>; // ej. { Color: "Rojo", Talle: "S" }
  priceBase: string; // "200.00"
  priceVta: string; // "350.00"
  images: string[]; // lista de URLs o paths
  quantity: number;
  min_stock: number;
  max_stock: number;
  isActive: boolean;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export default function AlmacenPage() {
  const { auth, selectedStoreId, inventories: storeInventories } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(
    null,
  );
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [productsWithDetails, setProductsWithDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [isLoadingInventories, setIsLoadingInventories] = useState(true);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteInventoryConfirm, setDeleteInventoryConfirm] = useState(false);
  const [isDeletingInventory, setIsDeletingInventory] = useState(false);
  const [mode, setMode] = useState<"table" | "shopify">("table");

  const stores = auth?.company?.stores || [];
  const currentStore =
    stores.find((s) => s.id === selectedStoreId) || stores[0];

  const router = useRouter();

  // Estados para modales de acciones
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<ProductWithInventoryDetails | null>(null);

  // ------------------------------------------------------
  // 1) Seleccionar almacén automáticamente
  // ------------------------------------------------------
  useEffect(() => {
    if (!storeInventories || storeInventories.length === 0) {
      setIsLoadingInventories(true);
      return;
    }

    setIsLoadingInventories(false);

    if (storeInventories.length === 1) {
      // Solo un inventario → seleccionarlo
      setSelectedInventoryId(storeInventories[0].id);
    } else {
      // Más de uno → mantener el seleccionado o usar el primero
      if (!selectedInventoryId) {
        setSelectedInventoryId(storeInventories[0].id);
      }
    }
  }, [storeInventories, selectedInventoryId]);

  // ------------------------------------------------------
  // 2) Cargar items del almacén seleccionado
  // ------------------------------------------------------
  useEffect(() => {
    if (!selectedInventoryId) return;

    const loadInventoryItems = async () => {
      setIsLoading(true);

      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/inventory/${selectedInventoryId}`,
        );

        setInventoryItems(response.data);
      } catch (err) {
        console.error("Error loading inventory items:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInventoryItems();
  }, [selectedInventoryId]);

  // ------------------------------------------------------
  // 3) Cargar detalles de las variantes (solo cuando tengamos items)
  // ------------------------------------------------------
  useEffect(() => {
    const loadVariantsBatch = async () => {
      if (!inventoryItems || inventoryItems.length === 0) {
        setProductsWithDetails([]);
        setIsLoadingVariants(false);
        return;
      }

      setIsLoadingVariants(true);

      try {
        const variantIds = inventoryItems.map((item) => item.variant_id);

        // 📌 LLAMADA REAL AL NUEVO ENDPOINT
        const { data: variants } = await axios.post<VariantBatchItem[]>(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/product-variant/multiple/by-ids`,
          { ids: variantIds },
        );
        // VARIABLE: unir items + variants
        const merged = inventoryItems.map((item) => {
          const variant = variants.find((v) => v.id === item.variant_id);

          return {
            inventoryItemId: item.id,
            variantId: item.variant_id,
            quantity: item.quantity,
            min_stock: item.min_stock,

            descripcion: variant?.product.description,
            sku: variant?.sku ?? "N/A",
            name: variant?.product?.name ?? "Sin nombre",
            attributes: variant?.attributeValues ?? {},
            priceVta: Number(variant?.priceVta ?? 0),
            priceBase: Number(variant?.priceBase ?? 0),
          };
        });

        setProductsWithDetails(merged);
      } catch (err) {
        console.error("❌ Error cargando variantes batch:", err);
      } finally {
        setIsLoadingVariants(false);
      }
    };

    loadVariantsBatch();
  }, [inventoryItems]);

  const filteredProducts: ProductWithInventoryDetails[] =
    productsWithDetails.filter((item) => {
      const q = searchQuery.toLowerCase();

      const sku = item.sku?.toLowerCase() || "";
      const name = item.name?.toLowerCase() || "";

      const attributesString = Object.entries(item.attributes || {})
        .map(
          ([k, v]) => `${String(k).toLowerCase()} ${String(v).toLowerCase()}`,
        )
        .join(" ");

      return (
        sku.includes(q) || name.includes(q) || attributesString.includes(q)
      );
    });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedInventoryId]);

  const handleExportExcel = async () => {
    if (filteredProducts.length === 0) {
      toast.warning("No hay productos para exportar");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Almacén");

    // -------------------------------------------
    // ENCABEZADOS DE LA TABLA
    // -------------------------------------------
    worksheet.columns = [
      { header: "SKU", key: "sku", width: 20 },
      { header: "Nombre", key: "name", width: 30 },
      { header: "Descripción", key: "descripcion", width: 40 },
      { header: "Variantes", key: "variantes", width: 35 },
      { header: "Stock", key: "stock", width: 12 },
      { header: "Precio", key: "precio", width: 15 },
    ];

    // Estilo del header
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).alignment = { horizontal: "center" };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF02A8E1" },
    };

    // -------------------------------------------
    // FILAS
    // -------------------------------------------
    filteredProducts.forEach((prod) => {
      const variantesText = Object.entries(prod.attributes || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(" / ");

      worksheet.addRow({
        sku: prod.sku,
        name: prod.name,
        descripcion: prod.descripcion ?? "",
        variantes: variantesText,
        stock: prod.quantity,
        precio: prod.priceVta,
        precioBase: prod.priceBase,
      });
    });

    // -------------------------------------------
    // ESTILO DE BORDES
    // -------------------------------------------
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // -------------------------------------------
    // DESCARGAR ARCHIVO
    // -------------------------------------------
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Almacen_${currentStore?.name || "Tienda"}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------

  if (!auth) return null;

  return (
    <div className="h-screen flex flex-col px-6">
      <HeaderConfig
        title="Almacén"
        description="Gestión de productos y control de stock por tienda"
      />

      {mode === "shopify" ? (
        <div className="flex flex-col items-center justify-center py-10">
          <ShopifySyncWizard onBack={() => setMode("table")} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex justify-end gap-2">
              <Link href="/compras">
                <Button variant="outline">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Compras
                </Button>
              </Link>
              <Link href="/productos">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Producto
                </Button>
              </Link>
              <Button
                variant="outline"
                className="border-teal-100 dark:border-teal-900/30 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/20"
                onClick={() => setMode("shopify")}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                Sincronizar Shopify
              </Button>
            </div>
            {/* INVENTORY SELECT */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 sm:max-w-xs">
                <Label className="mb-2 block">Seleccionar Almacén</Label>

                {isLoadingInventories ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Cargando almacenes...
                    </span>
                  </div>
                ) : (
                  <Select
                    value={selectedInventoryId || undefined}
                    onValueChange={(value) => setSelectedInventoryId(value)}
                    disabled={storeInventories.length <= 1}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar almacén" />
                    </SelectTrigger>
                    <SelectContent>
                      {storeInventories.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-end">
                <div>
                  <p className="text-sm text-muted-foreground">Tienda:</p>
                  <p className="font-medium">
                    {currentStore?.name ?? "Sin tienda"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* SEARCH */}
              <div className="relative flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por SKU, nombre o variante..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* EXTRA ACTIONS (EXPORTAR, FILTROS, ETC) */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportOpen(true)}
                >
                  <Download className="mr-2 h-4 w-4 rotate-180" />
                  Importar Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar en Excel
                </Button>
              </div>
            </div>

            {/* TABLE */}
            <div className="rounded-md border min-h-[18rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="border-r">SKU</TableHead>
                    <TableHead className="border-r">Nombre</TableHead>
                    <TableHead className="border-r">Descripcion</TableHead>
                    <TableHead className="border-r">Variantes</TableHead>
                    <TableHead className="border-r">Stock</TableHead>
                    <TableHead className="border-r">Precio base</TableHead>
                    <TableHead className="border-r">Precio venta</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading || isLoadingVariants ? (
                    // Skeleton rows
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="border-r">
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell className="border-r">
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell className="border-r">
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell className="border-r">
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="border-r">
                          <Skeleton className="h-4 w-12" />
                        </TableCell>
                        <TableCell className="border-r">
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell className="border-r">
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-6 text-muted-foreground"
                      >
                        No hay productos en este almacén
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedProducts.map((prod) => (
                      <TableRow key={prod.inventoryItemId}>
                        <TableCell className="border-r">{prod.sku}</TableCell>
                        <TableCell className="border-r">{prod.name}</TableCell>
                        <TableCell className="border-r">
                          {prod.descripcion}
                        </TableCell>
                        <TableCell className="border-r">
                          {Object.entries(prod.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" / ")}
                        </TableCell>
                        <TableCell className="border-r">
                          {prod.quantity}
                        </TableCell>
                        <TableCell className="border-r">
                          ${prod.priceBase}
                        </TableCell>
                        <TableCell className="border-r">
                          ${prod.priceVta}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="icon"
                            variant="outline"
                            title="Editar Producto"
                            onClick={() => {
                              router.push(`/productos?edit=${prod.variantId}`);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            title="Eliminar"
                            onClick={() => {
                              setSelectedItem(prod);
                              setDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          {/* Pagination */}
          {!(isLoading || isLoadingVariants) && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredProducts.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemName="productos"
            />
          )}
        </Card>
      )}

      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        inventoryId={selectedInventoryId || ""}
        onSuccess={() => {
          // Recargar items del inventario
          if (selectedInventoryId) {
            axios
              .get(
                `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/inventory/${selectedInventoryId}`,
              )
              .then((res) => setInventoryItems(res.data))
              .catch((err) => console.error(err));
          }
        }}
      />

      <AddStockModal
        open={addStockOpen}
        inventoryItemId={selectedItem?.inventoryItemId || null}
        productName={selectedItem?.name || ""}
        currentStock={selectedItem?.quantity || 0}
        onClose={() => setAddStockOpen(false)}
        onSuccess={() => {
          // Recargar items del inventario
          if (selectedInventoryId) {
            axios
              .get(
                `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/inventory/${selectedInventoryId}`,
              )
              .then((res) => setInventoryItems(res.data))
              .catch((err) => console.error(err));
          }
        }}
      />

      <DeleteInventoryItemModal
        open={deleteOpen}
        inventoryItemId={selectedItem?.inventoryItemId || null}
        productName={selectedItem?.name || ""}
        sku={selectedItem?.sku || ""}
        onClose={() => setDeleteOpen(false)}
        onSuccess={() => {
          // Recargar items del inventario
          if (selectedInventoryId) {
            axios
              .get(
                `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/inventory/${selectedInventoryId}`,
              )
              .then((res) => setInventoryItems(res.data))
              .catch((err) => console.error(err));
          }
        }}
      />
    </div>
  );
}
