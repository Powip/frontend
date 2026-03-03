"use client";

import { useEffect, useState } from "react";
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

  /* ─── Step 2 state ─── */
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  /* ─── Step 3 state ─── */
  const [isSaving, setIsSaving] = useState(false);

  /* ─── Computed ─── */
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedSubcategory = subcategories.find(
    (s) => s.id === selectedSubcategoryId,
  );
  const validRows = parsedRows.filter((r) => !r.error);
  const errorRows = parsedRows.filter((r) => !!r.error);

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
        setSelectedSubcategoryId("");
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
  const handleDownloadTemplate = async () => {
    if (!selectedSubcategoryId || !selectedCategoryId) {
      toast.error("Seleccioná una categoría y subcategoría primero");
      return;
    }

    const workbook = new ExcelJS.Workbook();

    /* ── Hoja de metadata (oculta) ── */
    const metaSheet = workbook.addWorksheet("_metadata");
    metaSheet.state = "hidden";
    metaSheet.addRow(["categoryId", selectedCategoryId]);
    metaSheet.addRow(["categoryName", selectedCategory?.name || ""]);
    metaSheet.addRow(["subcategoryId", selectedSubcategoryId]);
    metaSheet.addRow(["subcategoryName", selectedSubcategory?.name || ""]);
    metaSheet.addRow(["inventoryId", selectedInventoryId]);

    /* ── Hoja de productos ── */
    const sheet = workbook.addWorksheet("Productos");
    sheet.columns = [
      { header: "Nombre *", key: "name", width: 30 },
      { header: "Descripción", key: "description", width: 40 },
      { header: "SKU Empresa", key: "companySku", width: 20 },
      { header: "Atributos (Color:Rojo,Talle:M)", key: "attributes", width: 32 },
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

    /* Fila de ejemplo */
    sheet.addRow({
      name: "Remera Básica",
      description: "Remera de algodón 100%",
      companySku: "REM-001",
      attributes: "Color:Rojo,Talle:M",
      priceBase: 1000,
      priceVta: 2500,
      quantity: 50,
      min_stock: 5,
    });

    /* Info banner row */
    const infoRow = sheet.addRow([]);
    sheet.addRow([
      `📋 Categoría: ${selectedCategory?.name}  |  Subcategoría: ${selectedSubcategory?.name}`,
    ]);

    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Plantilla_${selectedCategory?.name}_${selectedSubcategory?.name}.xlsx`;
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

      /* Read metadata */
      const metaSheet = workbook.getWorksheet("_metadata");
      if (metaSheet) {
        const catId = metaSheet.getRow(1).getCell(2).value?.toString() || "";
        const subId = metaSheet.getRow(3).getCell(2).value?.toString() || "";
        const invId = metaSheet.getRow(5).getCell(2).value?.toString() || "";
        if (catId) setSelectedCategoryId(catId);
        if (subId) setSelectedSubcategoryId(subId);
        if (invId) setSelectedInventoryId(invId);
      }

      /* Read products */
      const sheet = workbook.getWorksheet("Productos") || workbook.worksheets[0];
      if (!sheet) throw new Error("No se encontró la hoja 'Productos'");

      const rows: ParsedRow[] = [];
      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return; // skip header

        const name = row.getCell(1).value?.toString()?.trim() || "";
        const description = row.getCell(2).value?.toString()?.trim() || "";
        const companySku = row.getCell(3).value?.toString()?.trim() || "";
        const rawAttrs = row.getCell(4).value?.toString()?.trim() || "";
        const priceBase = Number(row.getCell(5).value) || 0;
        const priceVta = Number(row.getCell(6).value) || 0;
        const quantity = Number(row.getCell(7).value) || 0;
        const min_stock = Number(row.getCell(8).value) || 0;

        if (!name) return; // skip empty rows

        /* Parse attributes */
        const attributes: Record<string, string> = {};
        if (rawAttrs) {
          rawAttrs.split(",").forEach((pair) => {
            const [k, v] = pair.split(":");
            if (k?.trim() && v?.trim()) attributes[k.trim()] = v.trim();
          });
        }

        /* Validate */
        let error: string | undefined;
        if (!name) error = "Nombre vacío";
        else if (priceBase <= 0) error = "Precio Compra inválido";
        else if (priceVta <= 0) error = "Precio Venta inválido";
        else if (quantity <= 0) error = "Stock inválido";

        rows.push({
          name,
          description,
          companySku,
          attributes,
          priceBase,
          priceVta,
          quantity,
          min_stock,
          error,
        });
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

    const tenantId = auth?.company?.id;
    if (!tenantId) {
      toast.error("Sesión inválida — recargá la página");
      return;
    }

    setIsSaving(true);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/products/bulk-import`,
        {
          tenantId,
          inventoryId: selectedInventoryId,
          subcategoryId: selectedSubcategoryId,
          rows: validRows.map((r) => ({
            name: r.name,
            description: r.description,
            companySku: r.companySku,
            attributes: r.attributes,
            priceBase: r.priceBase,
            priceVta: r.priceVta,
            quantity: r.quantity,
            min_stock: r.min_stock,
          })),
        },
      );

      toast.success(
        res.data.message ||
          `Importación completada: ${res.data.created} productos creados`,
      );
      onBack(); // Return to the selector
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Error al guardar los productos",
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* ═══════════ RENDER ═══════════ */
  const stepLabels = [
    "Generar Plantilla",
    "Subir Archivo",
    "Vista Previa",
  ];

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
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Paso 1 — Generar Plantilla
            </CardTitle>
            <CardDescription>
              Seleccioná la categoría, subcategoría e inventario para generar la
              plantilla Excel personalizada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Category */}
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí una categoría..." />
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

            {/* Subcategory */}
            <div className="space-y-1.5">
              <Label>Subcategoría</Label>
              <Select
                value={selectedSubcategoryId}
                onValueChange={setSelectedSubcategoryId}
                disabled={!selectedCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí una subcategoría..." />
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

            {/* Inventory */}
            {inventories.length > 1 && (
              <div className="space-y-1.5">
                <Label>Inventario</Label>
                <Select
                  value={selectedInventoryId}
                  onValueChange={setSelectedInventoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí un inventario..." />
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

            {/* Download button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleDownloadTemplate}
              disabled={!selectedSubcategoryId || !selectedInventoryId}
            >
              <Download className="mr-2 h-5 w-5" />
              Descargar Plantilla Excel
            </Button>

            {templateDownloaded && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Plantilla descargada — completala y subila en el paso 2.
              </p>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedSubcategoryId || !selectedInventoryId}
              >
                Siguiente
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Paso 3 — Vista Previa
            </CardTitle>
            <CardDescription>
              Revisá los productos antes de guardarlos. Podés volver al paso
              anterior para corregir el archivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Summary */}
            <div className="flex flex-wrap gap-4">
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
                  con errores
                </div>
              )}
              {selectedCategory && selectedSubcategory && (
                <div className="rounded-lg bg-muted/60 px-4 py-2 text-sm">
                  {selectedCategory.name} → {selectedSubcategory.name}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-auto max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>SKU Empresa</TableHead>
                    <TableHead>Atributos</TableHead>
                    <TableHead className="text-right">P. Compra</TableHead>
                    <TableHead className="text-right">P. Venta</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Mín.</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow
                      key={i}
                      className={row.error ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                    >
                      <TableCell className="text-muted-foreground text-xs">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.companySku || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                        {Object.entries(row.attributes)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        ${row.priceBase.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ${row.priceVta.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.min_stock}
                      </TableCell>
                      <TableCell>
                        {row.error ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {row.error}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            OK
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(2);
                  setFile(null);
                  setParsedRows([]);
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a subir
              </Button>
              <Button
                size="lg"
                onClick={handleSave}
                disabled={isSaving || validRows.length === 0}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar {validRows.length} productos
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
