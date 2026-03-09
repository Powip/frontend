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
import { searchInventoryItems } from "@/services/inventoryItems.service";
import { InventoryItemForSale } from "@/interfaces/IProduct";

import AddStockModal from "@/components/modals/AddStockModal";
import DeleteInventoryItemModal from "@/components/modals/DeleteInventoryItemModal";
import ImportExcelModal from "@/components/modals/ImportExcelModal";
import { Pagination } from "@/components/ui/pagination";
import ShopifySyncWizard from "../productos/shopify-sync-wizard";

const ITEMS_PER_PAGE = 10;

export default function AlmacenPage() {
  const { auth, selectedStoreId, inventories: storeInventories } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(
    null,
  );
  const [productsWithDetails, setProductsWithDetails] = useState<
    InventoryItemForSale[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInventories, setIsLoadingInventories] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [mode, setMode] = useState<"table" | "shopify">("table");

  const stores = auth?.company?.stores || [];
  const currentStore =
    stores.find((s) => s.id === selectedStoreId) || stores[0];

  const router = useRouter();

  // Estados para modales de acciones
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemForSale | null>(
    null,
  );

  // ------------------------------------------------------
  // 1) Seleccionar almacén automáticamente
  // ------------------------------------------------------
  useEffect(() => {
    // Si todavía no tenemos la data de la empresa cargada, esperamos
    if (!auth?.company) return;

    setIsLoadingInventories(false);

    if (storeInventories.length > 0) {
      if (!selectedInventoryId) {
        // Seleccionar el primero por defecto
        setSelectedInventoryId(storeInventories[0].id);
      } else {
        // Verificar si el seleccionado aún existe
        const exists = storeInventories.some(
          (inv) => inv.id === selectedInventoryId,
        );
        if (!exists) {
          setSelectedInventoryId(storeInventories[0].id);
        }
      }
    } else {
      setSelectedInventoryId(null);
    }
  }, [storeInventories, selectedInventoryId, auth?.company]);

  // ------------------------------------------------------
  // 2) Cargar items del almacén seleccionado (Pagina y Búsqueda)
  // ------------------------------------------------------
  useEffect(() => {
    if (!selectedInventoryId) return;

    const loadInventoryItems = async () => {
      setIsLoading(true);

      try {
        const response = await searchInventoryItems({
          inventoryId: selectedInventoryId,
          q: searchQuery || undefined,
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        });

        setProductsWithDetails(response.data);
        setTotalPages(response.meta.totalPages);
        setTotalItems(response.meta.total);
      } catch (err) {
        console.error("Error loading inventory items:", err);
        toast.error("Error al cargar los productos del inventario");
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      loadInventoryItems();
    }, 300); // Pequeño debounce para la búsqueda

    return () => clearTimeout(timer);
  }, [selectedInventoryId, currentPage, searchQuery]);

  // Reset page when search or inventory changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedInventoryId]);

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------

  if (!auth) return null;

  const refreshItems = async () => {
    if (!selectedInventoryId) return;
    setIsLoading(true);
    try {
      const response = await searchInventoryItems({
        inventoryId: selectedInventoryId,
        q: searchQuery || undefined,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
      setProductsWithDetails(response.data);
      setTotalPages(response.meta.totalPages);
      setTotalItems(response.meta.total);
    } catch (err) {
      console.error("Error refreshing items:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (productsWithDetails.length === 0) {
      toast.warning("No hay productos para exportar");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Almacén");

    worksheet.columns = [
      { header: "SKU", key: "sku", width: 20 },
      { header: "Nombre", key: "name", width: 30 },
      { header: "Stock", key: "stock", width: 12 },
      { header: "Precio", key: "precio", width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).alignment = { horizontal: "center" };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF02A8E1" },
    };

    productsWithDetails.forEach((prod) => {
      worksheet.addRow({
        sku: prod.sku,
        name: prod.productName,
        stock: prod.physicalStock,
        precio: prod.priceVta,
      });
    });

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
                    <TableHead className="border-r">Variantes</TableHead>
                    <TableHead className="border-r">Stock</TableHead>
                    <TableHead className="border-r">Precio base</TableHead>
                    <TableHead className="border-r">Precio venta</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
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
                  ) : productsWithDetails.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-6 text-muted-foreground"
                      >
                        No hay productos en este almacén
                      </TableCell>
                    </TableRow>
                  ) : (
                    productsWithDetails.map((prod) => (
                      <TableRow key={prod.inventoryItemId}>
                        <TableCell className="border-r">{prod.sku}</TableCell>
                        <TableCell className="border-r">
                          {prod.productName}
                        </TableCell>
                        <TableCell className="border-r">
                          {Object.entries(prod.attributes || {})
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" / ")}
                        </TableCell>
                        <TableCell className="border-r">
                          {prod.physicalStock}
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
          {!isLoading && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
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
        onSuccess={refreshItems}
      />

      <AddStockModal
        open={addStockOpen}
        inventoryItemId={selectedItem?.inventoryItemId || null}
        productName={selectedItem?.productName || ""}
        currentStock={selectedItem?.physicalStock || 0}
        onClose={() => setAddStockOpen(false)}
        onSuccess={refreshItems}
      />

      <DeleteInventoryItemModal
        open={deleteOpen}
        inventoryItemId={selectedItem?.inventoryItemId || null}
        productName={selectedItem?.productName || ""}
        sku={selectedItem?.sku || ""}
        onClose={() => setDeleteOpen(false)}
        onSuccess={refreshItems}
      />
    </div>
  );
}
