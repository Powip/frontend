"use client";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ExcelJS from "exceljs";
import JsBarcode from "jsbarcode";
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
import { Download, Search } from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";

import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface InventoryItem {
  id: string;
  variant_id: string;
  quantity: number;
  min_stock: number;
}

interface VariantBatchItem {
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
  const { auth, selectedStoreId, inventories: storeInventories } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(
    null
  );
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [productsWithDetails, setProductsWithDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const stores = auth?.company?.stores || [];
  const currentStore =
    stores.find((s) => s.id === selectedStoreId) || stores[0];

  // ------------------------------------------------------
  // 1) Seleccionar inventario automáticamente
  // ------------------------------------------------------
  useEffect(() => {
    if (!storeInventories || storeInventories.length === 0) return;

    if (storeInventories.length === 1) {
      // Solo un inventario → seleccionarlo
      setSelectedInventoryId(storeInventories[0].id);
    } else {
      // Más de uno → mantener el seleccionado o usar el primero
      if (!selectedInventoryId) {
        setSelectedInventoryId(storeInventories[0].id);
      }
    }
  }, [storeInventories]);

  // ------------------------------------------------------
  // 2) Cargar items del inventario seleccionado
  // ------------------------------------------------------
  useEffect(() => {
    if (!selectedInventoryId) return;

    const loadInventoryItems = async () => {
      setIsLoading(true);

      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/inventory/${selectedInventoryId}`
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
        return;
      }

      try {
        const variantIds = inventoryItems.map((item) => item.variant_id);

        // 📌 LLAMADA REAL AL NUEVO ENDPOINT
        const { data: variants } = await axios.post<VariantBatchItem[]>(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/product-variant/multiple/by-ids`,
          { ids: variantIds }
        );
        console.log(variants);
        // VARIABLE: unir items + variants
        const merged = inventoryItems.map((item) => {
          const variant = variants.find((v) => v.id === item.variant_id);

          return {
            inventoryItemId: item.id,
            variantId: item.variant_id,
            quantity: item.quantity,
            min_stock: item.min_stock,

            // Datos del variant
            descripcion: variant?.product.description,
            sku: variant?.sku ?? "N/A",
            name: variant?.product?.name ?? "Sin nombre",
            attributes: variant?.attributeValues ?? {},
            priceVta: Number(variant?.priceVta ?? 0),
          };
        });

        setProductsWithDetails(merged);
      } catch (err) {
        console.error("❌ Error cargando variantes batch:", err);
      }
    };

    loadVariantsBatch();
  }, [inventoryItems]);

  const filteredProducts = productsWithDetails.filter((item) => {
    const q = searchQuery.toLowerCase();

    const sku = item.sku?.toLowerCase() || "";
    const name = item.name?.toLowerCase() || "";

    const attributesString = Object.entries(item.attributes || {})
      .map(([k, v]) => `${String(k).toLowerCase()} ${String(v).toLowerCase()}`)
      .join(" ");

    return sku.includes(q) || name.includes(q) || attributesString.includes(q);
  });

  const handleExportExcel = async () => {
    if (filteredProducts.length === 0) {
      toast.warning("No hay productos para exportar");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventario");

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
    a.download = `Inventario_${currentStore?.name || "Tienda"}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleGenerateBarcode = (sku: string) => {
    // Crear canvas en memoria
    const canvas = document.createElement("canvas");

    // Generar código de barras
    JsBarcode(canvas, sku, {
      format: "CODE128",
      width: 2,
      height: 100,
      displayValue: true,
    });

    // Convertir a imagen
    const dataUrl = canvas.toDataURL("image/png");

    // Abrir en nueva pestaña
    const win = window.open();
    if (win) {
      win.document.write(`
      <html>
        <head><title>Código de barras - ${sku}</title></head>
        <body style="text-align: center; padding: 20px;">
          <h2>${sku}</h2>
          <img src="${dataUrl}" />
        </body>
      </html>
    `);
      win.document.close();
    }
  };

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------

  return (
    <div className="h-screen flex flex-col px-6">
      <HeaderConfig
        title="Inventario"
        description="Gestión de productos y control de stock por tienda"
      />

      <Card>
        <CardContent className="p-6">
          {/* INVENTORY SELECT */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 sm:max-w-xs">
              <Label className="mb-2 block">Seleccionar Inventario</Label>

              <Select
                value={selectedInventoryId || undefined}
                onValueChange={(value) => setSelectedInventoryId(value)}
                disabled={storeInventories.length <= 1} // 🟢 solo si hay más de uno
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar inventario" />
                </SelectTrigger>
                <SelectContent>
                  {storeInventories.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <TableHead>SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Variantes</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      Cargando inventario...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      No hay productos en este inventario
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((prod) => (
                    <TableRow key={prod.inventoryItemId}>
                      <TableCell>{prod.sku}</TableCell>
                      <TableCell>{prod.name}</TableCell>
                      <TableCell>{prod.descripcion}</TableCell>
                      <TableCell>
                        {Object.entries(prod.attributes)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" / ")}
                      </TableCell>
                      <TableCell>{prod.quantity}u</TableCell>
                      <TableCell>${prod.priceVta}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateBarcode(prod.sku)}
                        >
                          Generar código de barras
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
