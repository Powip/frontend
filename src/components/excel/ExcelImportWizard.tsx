"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { HeaderConfig } from "@/components/header/HeaderConfig";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Download,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Save,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";

/* ───────── types ───────── */
interface Category {
  id: string;
  name: string;
}
interface Subcategory {
  id: string;
  name: string;
}
interface ParsedRow {
  categoryName?: string;
  subcategoryName?: string;
  subcategoryId?: string;
  name: string;
  description: string;
  companySku: string;
  attributes: Record<string, string>;
  priceBase: number;
  priceVta: number;
  quantity: number;
  min_stock: number;
  error?: string;
}

interface ExcelImportWizardProps {
  onBack: () => void;
}

/* ═══════ COMPONENTE ═══════ */
export default function ExcelImportWizard({ onBack }: ExcelImportWizardProps) {
  const { auth, inventories } = useAuth();
  const [step, setStep] = useState(1);

  /* ─── Step 1 state ─── */
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [templateDownloaded, setTemplateDownloaded] = useState(false);
  const skipSubcategoryResetRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [allSubcategories, setAllSubcategories] = useState<
    Record<string, Subcategory[]>
  >({});

  const updateRow = (index: number, updates: Partial<ParsedRow>) => {
    setParsedRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };

      // Re-validate if subcategoryId changed
      if (updates.subcategoryId) {
        copy[index].error = undefined;
      }

      return copy;
    });
  };

  const fetchSubcategoriesForCategory = async (categoryId: string) => {
    if (allSubcategories[categoryId]) return allSubcategories[categoryId];

    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/subcategories/category/${categoryId}`,
      );
      setAllSubcategories((prev) => ({ ...prev, [categoryId]: res.data }));
      return res.data;
    } catch (err) {
      console.error("Error cargando subcategorías:", err);
      return [];
    }
  };

  /* ─── Step 3 state ─── */
  const [isSaving, setIsSaving] = useState(false);

  /* ─── Computed ─── */
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedSubcategory = subcategories.find(
    (s) => s.id === selectedSubcategoryId,
  );
  const validRows = parsedRows.filter((r) => !r.error);
  const errorRows = parsedRows.filter((r) => !!r.error);
  const invalidCount = errorRows.length;

  /* ─── Load categories ─── */
  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_API_PRODUCTOS}/categories`)
      .then((res) => setCategories(res.data))
      .catch((err) => console.error("Error cargando categorías:", err));
  }, []);

  /* ─── Load subcategories when category changes ─── */
  useEffect(() => {
    if (!selectedCategoryId) {
      setSubcategories([]);
      setSelectedSubcategoryId("");
      return;
    }
    axios
      .get(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/subcategories/category/${selectedCategoryId}`,
      )
      .then((res) => {
        setSubcategories(res.data);
        // Don't reset subcategory when loading from file metadata
        if (skipSubcategoryResetRef.current) {
          skipSubcategoryResetRef.current = false;
        } else {
          setSelectedSubcategoryId("");
        }
      })
      .catch((err) => console.error("Error cargando subcategorías:", err));
  }, [selectedCategoryId]);

  /* ─── Auto-select single inventory ─── */
  useEffect(() => {
    if (inventories.length === 1 && !selectedInventoryId) {
      setSelectedInventoryId(inventories[0].id);
    }
  }, [inventories]);

  /* ════════════════════════════════════
     STEP 1: Generate & Download Template
     ════════════════════════════════════ */
  const handleDownloadTemplate = async (isBaseTemplate: boolean = false) => {
    const workbook = new ExcelJS.Workbook();
    const workbookName = isBaseTemplate
      ? "Plantilla_Base_Importacion.xlsx"
      : `Plantilla_${selectedCategory?.name || "Cat"}_${selectedSubcategory?.name || "Sub"}.xlsx`;

    /* ── Hoja de metadata (oculta) ── */
    const metaSheet = workbook.addWorksheet("_metadata");
    metaSheet.state = "hidden";
    metaSheet.addRow([
      "inventoryId",
      isBaseTemplate ? "" : selectedInventoryId,
    ]);

    /* ── Hoja de productos ── */
    const sheet = workbook.addWorksheet("Productos");
    sheet.columns = [
      { header: "Categoría *", key: "categoryName", width: 25 },
      { header: "Subcategoría *", key: "subcategoryName", width: 25 },
      { header: "Nombre *", key: "name", width: 30 },
      { header: "Descripción", key: "description", width: 40 },
      { header: "SKU Empresa", key: "companySku", width: 20 },
      {
        header: "Atributos (Color:Rojo,Talle:M)",
        key: "attributes",
        width: 32,
      },
      { header: "Precio Compra *", key: "priceBase", width: 16 },
      { header: "Precio Venta *", key: "priceVta", width: 16 },
      { header: "Stock Inicial *", key: "quantity", width: 16 },
      { header: "Stock Mínimo", key: "min_stock", width: 16 },
    ];

    /* Header styling */
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A5F" },
    };
    headerRow.alignment = { horizontal: "center" };

    /* Fila de ejemplo base */
    if (isBaseTemplate) {
      sheet.addRow({
        categoryName: "Vestimenta",
        subcategoryName: "Camperas",
        name: "Producto Ejemplo",
        description: "Campera de abrigo térmica",
        companySku: "SKU-001",
        attributes: "Color:Azul,Talle:L",
        priceBase: 5000,
        priceVta: 12500,
        quantity: 20,
        min_stock: 5,
      });
      sheet.addRow({
        categoryName: "Calzado",
        subcategoryName: "Zapatillas",
        name: "Zapatillas Urbanas",
        description: "Zapatillas blancas de cuero",
        companySku: "SKU-002",
        attributes: "Talle:42",
        priceBase: 3500,
        priceVta: 8900,
        quantity: 15,
        min_stock: 3,
      });
    } else {
      /* Fila de ejemplo personalizada */
      const catName = selectedCategory?.name || "Producto";
      const subName = selectedSubcategory?.name || "";
      sheet.addRow({
        categoryName: selectedCategory?.name || "Ropa",
        subcategoryName: selectedSubcategory?.name || "Camisas",
        name: `${subName || catName} Ejemplo`,
        description: `Producto de ejemplo de ${subName || catName}`,
        companySku: `SKU-PROD-001`,
        attributes: "Color:Blanco",
        priceBase: 100,
        priceVta: 250,
        quantity: 10,
        min_stock: 5,
      });

      /* Info banner row */
      sheet.addRow([]);
      sheet.addRow([
        `📋 Categoría: ${selectedCategory?.name}  |  Subcategoría: ${selectedSubcategory?.name}`,
      ]);
    }

    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = workbookName;
    anchor.click();
    window.URL.revokeObjectURL(url);

    setTemplateDownloaded(true);
    toast.success("Plantilla descargada correctamente");
  };

  /* ════════════════════════════
     STEP 2: Upload & Parse File
     ════════════════════════════ */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsParsing(true);

    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await f.arrayBuffer();
      await workbook.xlsx.load(buffer);

      /* Read products */
      const sheet =
        workbook.getWorksheet("Productos") || workbook.worksheets[0];
      if (!sheet) throw new Error("No se encontró la hoja 'Productos'");

      const rawRows: any[] = [];
      const uniqueCategoryNames = new Set<string>();

      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return; // skip header

        const categoryName = row.getCell(1).value?.toString()?.trim() || "";
        const subcategoryName = row.getCell(2).value?.toString()?.trim() || "";
        const name = row.getCell(3).value?.toString()?.trim() || "";
        const description = row.getCell(4).value?.toString()?.trim() || "";
        const companySku = row.getCell(5).value?.toString()?.trim() || "";
        const rawAttrs = row.getCell(6).value?.toString()?.trim() || "";
        const priceBase = Number(row.getCell(7).value) || 0;
        const priceVta = Number(row.getCell(8).value) || 0;
        const quantity = Number(row.getCell(9).value) || 0;
        const min_stock = Number(row.getCell(10).value) || 0;

        if (!name && !categoryName) return;

        if (categoryName) uniqueCategoryNames.add(categoryName);

        rawRows.push({
          categoryName,
          subcategoryName,
          name,
          description,
          companySku,
          rawAttrs,
          priceBase,
          priceVta,
          quantity,
          min_stock,
        });
      });

      // Pre-fetch subcategories for all mentioned categories
      const categoryMap: Record<string, string> = {};
      for (const catName of Array.from(uniqueCategoryNames)) {
        const matchingCat = categories.find(
          (c) => c.name.toLowerCase() === catName.toLowerCase(),
        );
        if (matchingCat) {
          categoryMap[catName.toLowerCase()] = matchingCat.id;
          await fetchSubcategoriesForCategory(matchingCat.id);
        }
      }

      const rows: ParsedRow[] = rawRows.map((raw) => {
        let subcategoryId = "";
        let error: string | undefined;

        const catId = categoryMap[raw.categoryName.toLowerCase()];
        if (catId) {
          const subcats = allSubcategories[catId] || [];
          const matchingSub = subcats.find(
            (s) => s.name.toLowerCase() === raw.subcategoryName.toLowerCase(),
          );
          if (matchingSub) {
            subcategoryId = matchingSub.id;
          } else {
            error = `Subcategoría "${raw.subcategoryName}" no encontrada`;
          }
        } else {
          error = `Categoría "${raw.categoryName}" no encontrada`;
        }

        /* Parse attributes */
        const attributes: Record<string, string> = {};
        if (raw.rawAttrs) {
          raw.rawAttrs.split(",").forEach((pair: string) => {
            const [k, v] = pair.split(":");
            if (k?.trim() && v?.trim()) attributes[k.trim()] = v.trim();
          });
        }

        if (!raw.name) error = "Nombre vacío";
        if (raw.priceBase < 0) error = "Precio Compra inválido";
        if (raw.priceVta < 0) error = "Precio Venta inválido";
        if (raw.quantity < 0) error = "Stock inválido";

        return {
          ...raw,
          attributes,
          subcategoryId,
          error,
        };
      });

      setParsedRows(rows);
      if (rows.length === 0) {
        toast.warning("No se encontraron filas de productos válidas");
      } else {
        toast.success(`Se encontraron ${rows.length} filas`);
        setStep(3); // Auto-advance to preview
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error al leer el archivo");
    } finally {
      setIsParsing(false);
    }
  };

  /* ════════════════════════
     STEP 3: Save to backend
     ════════════════════════ */
  const handleSave = async () => {
    if (validRows.length === 0) {
      toast.error("No hay productos válidos para guardar");
      return;
    }
    if (!selectedInventoryId) {
      toast.error("Seleccioná un inventario antes de guardar");
      return;
    }

    const tenantId = auth?.company?.id;
    if (!tenantId) {
      toast.error("Sesión inválida — recargá la página");
      return;
    }

    const payload = {
      tenantId,
      inventoryId: selectedInventoryId,
      rows: validRows.map((r) => ({
        name: r.name,
        description: r.description,
        companySku: r.companySku,
        attributes: r.attributes,
        priceBase: r.priceBase,
        priceVta: r.priceVta,
        quantity: r.quantity,
        min_stock: r.min_stock,
        subcategoryId: r.subcategoryId, // Enviamos el ID resuelto
      })),
    };

    console.log("📦 Payload bulk-import:", JSON.stringify(payload, null, 2));
    const apiUrl = `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/products/bulk-import`;
    console.log("🌐 API URL:", apiUrl);

    setIsSaving(true);
    try {
      const res = await axios.post(apiUrl, payload);

      console.log("✅ Respuesta bulk-import:", res.data);

      if (res.data.created === 0 && res.data.errors > 0) {
        toast.error(
          `No se crearon productos. ${res.data.errors} errores — revisá la consola`,
        );
      } else if (res.data.created > 0) {
        toast.success(
          res.data.message ||
            `Importación completada: ${res.data.created} productos creados`,
        );
        onBack();
      } else {
        toast.warning(
          "La respuesta no indica productos creados. Verificá la consola.",
        );
      }
    } catch (err: any) {
      const errorDetail = err.response?.data
        ? JSON.stringify(err.response.data)
        : err.message;
      console.error("❌ Error bulk-import:", errorDetail);
      console.error("❌ Status:", err.response?.status);
      toast.error(
        `Error (${err.response?.status || "red"}): ${err.response?.data?.message || err.message}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* ═══════════ RENDER ═══════════ */
  const stepLabels = ["Generar Plantilla", "Subir Archivo", "Vista Previa"];

  return (
    <div className="w-full px-6 pb-6">
      <HeaderConfig
        title="Importar Productos"
        description="Carga masiva de productos vía Excel"
      />

      {/* ─── Step indicator ─── */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {stepLabels.map((label, i) => {
          const num = i + 1;
          const isActive = step === num;
          const isDone = step > num;
          return (
            <div key={num} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-0.5 w-12 rounded ${isDone ? "bg-green-500" : "bg-muted"}`}
                />
              )}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    isDone
                      ? "bg-green-500 text-white"
                      : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : num}
                </div>
                <span
                  className={`text-xs font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════
           STEP 1: Generate Template
         ═══════════════════════════ */}
      {step === 1 && (
        <Card className="max-w-2xl mx-auto shadow-lg border-primary/10">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl font-bold text-primary">
                  <FileSpreadsheet className="h-6 w-6" />
                  Paso 1 — Obtener Plantilla
                </CardTitle>
                <CardDescription>
                  Descargá el archivo Excel para completar con tus productos.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="bg-primary/5 text-primary border-primary/20"
              >
                Paso Inicial
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Opción 1: Plantilla Rápida / Base */}
            <div className="rounded-xl border bg-secondary/30 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-full bg-primary/10 p-2">
                  <Download className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">
                    Plantilla Base (Recomendado para nuevos clientes)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Descargá una estructura limpia con ejemplos de cómo llenar
                    las categorías y subcategorías.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full bg-background hover:bg-primary hover:text-white transition-all duration-300"
                onClick={() => handleDownloadTemplate(true)}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Descargar Plantilla Base de Ejemplo
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-medium text-[10px] tracking-widest">
                  Opcional: Plantilla Personalizada
                </span>
              </div>
            </div>

            {/* Opción 2: Plantilla filtrada */}
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Categoría
                  </Label>
                  <Select
                    value={selectedCategoryId}
                    onValueChange={setSelectedCategoryId}
                  >
                    <SelectTrigger className="h-10 bg-muted/50 border-none shadow-none ring-0 focus:ring-1">
                      <SelectValue placeholder="Elegí categoría..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Subcategoría
                  </Label>
                  <Select
                    value={selectedSubcategoryId}
                    onValueChange={setSelectedSubcategoryId}
                    disabled={!selectedCategoryId}
                  >
                    <SelectTrigger className="h-10 bg-muted/50 border-none shadow-none ring-0 focus:ring-1">
                      <SelectValue placeholder="Elegí subcategoría..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Inventory */}
              {inventories.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Inventario destino
                  </Label>
                  <Select
                    value={selectedInventoryId}
                    onValueChange={setSelectedInventoryId}
                  >
                    <SelectTrigger className="h-10 bg-muted/50 border-none shadow-none ring-0 focus:ring-1">
                      <SelectValue placeholder="Seleccionar inventario..." />
                    </SelectTrigger>
                    <SelectContent>
                      {inventories.map((inv: any) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                className="w-full h-11 shadow-md transition-all active:scale-[0.98]"
                onClick={() => handleDownloadTemplate(false)}
                disabled={!selectedSubcategoryId || !selectedInventoryId}
              >
                <Download className="mr-2 h-5 w-5" />
                Generar Plantilla Personalizada
              </Button>
            </div>

            {templateDownloaded && (
              <p className="text-xs text-green-600 flex items-center justify-center gap-1 font-medium bg-green-50 dark:bg-green-950/20 py-2 rounded-lg">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Plantilla descargada con éxito — Completala y subila en el Paso
                2
              </p>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStep(2)}
                className="font-semibold shadow-sm"
              >
                Ya tengo mi archivo, ir al Paso 2
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════
           STEP 2: Upload file
         ═══════════════════════════ */}
      {step === 2 && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5" />
              Paso 2 — Subir Archivo
            </CardTitle>
            <CardDescription>
              Subí el archivo Excel con tus productos. El sistema leerá
              automáticamente la categoría y subcategoría de la plantilla.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedCategory && selectedSubcategory && (
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <span className="font-medium">Destino:</span>{" "}
                {selectedCategory.name} → {selectedSubcategory.name}
              </div>
            )}

            <Label
              htmlFor="excel-upload"
              className="cursor-pointer group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 p-10 hover:bg-muted/50 transition-colors text-center"
            >
              {isParsing ? (
                <>
                  <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    Leyendo archivo...
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="mb-3 h-10 w-10 text-muted-foreground group-hover:text-primary transition" />
                  <span className="text-sm font-medium">
                    Hacé clic para seleccionar o arrastrá tu archivo aquí
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {file ? file.name : "Solo archivos .xlsx"}
                  </span>
                </>
              )}
              <Input
                id="excel-upload"
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
                disabled={isParsing}
              />
            </Label>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════
           STEP 3: Preview & Confirm
         ═══════════════════════════ */}
      {step === 3 && (
        <Card className="max-w-[95vw] lg:max-w-7xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Paso 3 — Vista Previa y Edición
            </CardTitle>
            <CardDescription>
              Revisá y corregí las categorías de los productos si es necesario.
              Aseguráte de que todos tengan una subcategoría asignada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary & Globals */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-2 text-sm">
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {validRows.length}
                  </span>{" "}
                  productos listos
                </div>
                {errorRows.length > 0 && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-2 text-sm">
                    <span className="font-semibold text-red-700 dark:text-red-400">
                      {errorRows.length}
                    </span>{" "}
                    pendientes de corregir
                  </div>
                )}
              </div>

              {/* Inventory selector */}
              <div className="flex-1 rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col md:flex-row items-center gap-4">
                <div className="space-y-1 flex-1">
                  <Label className="text-sm font-semibold">
                    Inventario destino *
                  </Label>
                  <Select
                    value={selectedInventoryId}
                    onValueChange={setSelectedInventoryId}
                  >
                    <SelectTrigger className="bg-white dark:bg-background">
                      <SelectValue placeholder="Seleccioná el inventario..." />
                    </SelectTrigger>
                    <SelectContent>
                      {inventories.map((inv: any) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!selectedInventoryId && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-6">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Seleccioná un inventario
                  </p>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-secondary z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="min-w-[150px]">Nombre</TableHead>
                      <TableHead className="min-w-[180px]">Categoría</TableHead>
                      <TableHead className="min-w-[180px]">
                        Subcategoría
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Venta</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="w-24">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, i) => {
                      const currentCategoryId =
                        categories.find(
                          (c) =>
                            c.name.toLowerCase() ===
                            row.categoryName?.toLowerCase(),
                        )?.id || "";

                      return (
                        <TableRow
                          key={i}
                          className={
                            row.error ? "bg-red-50/30 dark:bg-red-950/5" : ""
                          }
                        >
                          <TableCell className="text-muted-foreground text-xs">
                            {i + 1}
                          </TableCell>
                          <TableCell
                            className="font-medium text-xs max-w-[150px] truncate"
                            title={row.name}
                          >
                            {row.name}
                          </TableCell>

                          {/* Categoría Selector */}
                          <TableCell>
                            <Select
                              value={currentCategoryId}
                              onValueChange={(newCatId) => {
                                const catName =
                                  categories.find((c) => c.id === newCatId)
                                    ?.name || "";
                                updateRow(i, {
                                  categoryName: catName,
                                  subcategoryId: "",
                                  subcategoryName: "",
                                  error: "Seleccioná subcategoría",
                                });
                                fetchSubcategoriesForCategory(newCatId);
                              }}
                            >
                              <SelectTrigger
                                className={`h-8 text-xs ${!currentCategoryId ? "border-red-500" : ""}`}
                              >
                                <SelectValue placeholder="Cat..." />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Subcategoría Selector */}
                          <TableCell>
                            <Select
                              value={row.subcategoryId}
                              onValueChange={(newSubId) => {
                                const subName =
                                  allSubcategories[currentCategoryId]?.find(
                                    (s) => s.id === newSubId,
                                  )?.name || "";
                                updateRow(i, {
                                  subcategoryId: newSubId,
                                  subcategoryName: subName,
                                });
                              }}
                              disabled={!currentCategoryId}
                            >
                              <SelectTrigger
                                className={`h-8 text-xs ${!row.subcategoryId ? "border-red-500" : ""}`}
                              >
                                <SelectValue placeholder="Sub..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(
                                  allSubcategories[currentCategoryId] || []
                                ).map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground">
                            {row.companySku || "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            ${row.priceVta.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {row.quantity}
                          </TableCell>
                          <TableCell>
                            {row.error ? (
                              <span
                                className="flex items-center justify-center"
                                title={row.error}
                              >
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              </span>
                            ) : (
                              <span className="flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                disabled={isSaving}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>

              <div className="flex items-center gap-3">
                {errorRows.length > 0 && (
                  <p className="text-xs text-red-500 font-medium">
                    Corregí los errores para continuar
                  </p>
                )}
                <Button
                  size="lg"
                  onClick={handleSave}
                  disabled={
                    invalidCount > 0 || isSaving || !selectedInventoryId
                  }
                  className="min-w-[180px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Importar {validRows.length} productos
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
