"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { largeQuantityConfirmText, needsQuantityConfirmation } from "@/lib/stockLimits";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import {
  LEGACY_TEMPLATE_MESSAGE,
  REQUIRED_HEADERS,
  buildColumnIndexMap,
  buildParsedRow,
  buildTemplateWorkbook,
  canonicalProductNames,
  describeRowError,
  fold,
  formatAttributes,
  isLegacyHeader,
  productGroupKey,
  readHeaderTexts,
  readSheetRows,
  templateFileName,
  validateRows,
  type ParsedRow,
  type RawSheetRow,
  type TemplateOptions,
} from "./importTemplate";

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
interface SubcategoryWithCategory {
  id: string;
  name: string;
  category?: {
    id: string;
    name: string;
  };
}

interface ExcelImportWizardProps {
  onBack: () => void;
  inventoryId?: string;
}

/* ═══════ COMPONENTE ═══════ */
export default function ExcelImportWizard({ onBack, inventoryId }: ExcelImportWizardProps) {
  const { auth } = useAuth();
  const warehouseQuery = useBusinessInventories();
  const inventories = warehouseQuery.inventories;
  const [step, setStep] = useState(1);

  /* ─── Step 1 state ─── */
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState(inventoryId || "");
  const [templateDownloaded, setTemplateDownloaded] = useState(false);
  const skipSubcategoryResetRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [legacyTemplateError, setLegacyTemplateError] = useState(false);
  const [allSubcategories, setAllSubcategories] = useState<
    Record<string, Subcategory[]>
  >({});

  const updateRow = (index: number, updates: Partial<ParsedRow>) => {
    setParsedRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      // Se vuelve a validar todo: corregir una fila puede cambiar las reglas del producto.
      return validateRows(copy);
    });
  };

  const fetchSubcategoriesForCategory = async (categoryId: string) => {
    if (allSubcategories[categoryId]) return allSubcategories[categoryId];

    try {
      const res = await axiosAuth.get(
        `${(process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products)}/subcategories/category/${categoryId}`,
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
  const [confirmLargeQuantity, setConfirmLargeQuantity] = useState(false);

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
    axiosAuth
      .get(`${(process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products)}/categories`)
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
    axiosAuth
      .get(
        `${(process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products)}/subcategories/category/${selectedCategoryId}`,
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
  }, [inventories, selectedInventoryId]);

  /* ════════════════════════════════════
     STEP 1: Generate & Download Template
     ════════════════════════════════════ */
  const handleDownloadTemplate = async (isBaseTemplate: boolean = false) => {
    const options: TemplateOptions = {
      isBase: isBaseTemplate,
      inventoryId: selectedInventoryId,
      categoryName: selectedCategory?.name,
      subcategoryName: selectedSubcategory?.name,
    };

    /* Referencia de categorías válidas (hoja y listas desplegables). Si falla el fetch, la
       plantilla se descarga igual: no debe bloquear al usuario. */
    try {
      const res = await axiosAuth.get<SubcategoryWithCategory[]>(
        `${(process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products)}/subcategories`,
      );
      options.validCategories = res.data.map((sub) => ({
        category: sub.category?.name || "",
        subcategory: sub.name,
      }));
    } catch {
      // sin hoja de referencia
    }

    const workbook = buildTemplateWorkbook(options);
    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = templateFileName(options);
    anchor.click();
    window.URL.revokeObjectURL(url);

    setTemplateDownloaded(true);
    toast.success("Plantilla descargada correctamente");
  };

  /* ════════════════════════════
     STEP 2: Upload & Parse File
     ════════════════════════════ */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    setFile(f);
    setIsParsing(true);
    setLegacyTemplateError(false);

    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await f.arrayBuffer();
      await workbook.xlsx.load(buffer);

      /* Read products */
      const sheet =
        workbook.getWorksheet("Productos") || workbook.worksheets[0];
      if (!sheet) throw new Error("No se encontró la hoja 'Productos'");

      /* Plantilla anterior: sus tallas y colores iban en una sola columna "Atributos" y se
         perdían sin avisar. No se carga nada: se pide bajar la plantilla nueva. */
      if (readHeaderTexts(sheet.getRow(1)).some(isLegacyHeader)) {
        setLegacyTemplateError(true);
        setFile(null);
        toast.error(
          "Esta plantilla es de una versión anterior y no se puede cargar. Descarga la plantilla nueva.",
        );
        return;
      }

      const columnIndexMap = buildColumnIndexMap(sheet.getRow(1));
      const missingHeaders = REQUIRED_HEADERS.filter(
        (h) => !columnIndexMap[h.key],
      );
      if (missingHeaders.length > 0) {
        throw new Error(
          `Faltan columnas obligatorias en el archivo: ${missingHeaders
            .map((h) => h.header)
            .join(", ")}`,
        );
      }

      const { rows: rawRows, ignoredExamples } = readSheetRows(sheet, columnIndexMap);

      // Subcategorías de todas las categorías mencionadas (se guardan en un mapa local: el
      // estado aún no se actualizó cuando se arman las filas).
      const subsByCategory: Record<string, Subcategory[]> = {};
      const mentioned = new Set(rawRows.map((r) => r.categoryName).filter(Boolean));
      for (const catName of Array.from(mentioned)) {
        const matchingCat = categories.find((c) => fold(c.name) === fold(catName));
        if (matchingCat && !subsByCategory[matchingCat.id]) {
          subsByCategory[matchingCat.id] = await fetchSubcategoriesForCategory(matchingCat.id);
        }
      }

      const resolveDestination = (raw: RawSheetRow) => {
        if (!raw.categoryName) return { problem: "Falta la categoría." };
        const category = categories.find((c) => fold(c.name) === fold(raw.categoryName));
        if (!category) return { problem: `Categoría "${raw.categoryName}" no encontrada` };
        if (!raw.subcategoryName) return { category, problem: "Falta la subcategoría." };
        const sub = (subsByCategory[category.id] || []).find(
          (s) => fold(s.name) === fold(raw.subcategoryName),
        );
        if (!sub) return { category, problem: `Subcategoría "${raw.subcategoryName}" no encontrada` };
        return { category, sub };
      };

      const rows = validateRows(
        rawRows.map((raw) => {
          const destination = resolveDestination(raw);
          const row = buildParsedRow(raw, {
            subcategoryId: destination.sub?.id,
            problem: destination.problem,
          });
          return {
            ...row,
            categoryName: destination.category?.name ?? raw.categoryName,
            subcategoryName: destination.sub?.name ?? raw.subcategoryName,
          };
        }),
      );

      setParsedRows(rows);
      setConfirmLargeQuantity(false);
      if (rows.length === 0) {
        toast.warning(
          ignoredExamples > 0
            ? "Solo hay filas de ejemplo ((EJEMPLO)): reemplázalas por tus productos y vuelve a subir el archivo."
            : "No se encontraron filas de productos válidas",
        );
      } else {
        toast.success(
          ignoredExamples > 0
            ? `Se encontraron ${rows.length} filas (se ignoraron ${ignoredExamples} de ejemplo)`
            : `Se encontraron ${rows.length} filas`,
        );
        setStep(3); // Auto-advance to preview
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al leer el archivo";
      toast.error(message);
    } finally {
      setIsParsing(false);
      try {
        input.value = ""; // permite volver a elegir el mismo archivo tras corregirlo
      } catch {
        // algunos entornos no permiten escribir el valor de un input file
      }
    }
  };

  /* ════════════════════════
     STEP 3: Save to backend
     ════════════════════════ */
  const largestQuantity = Math.max(0, ...validRows.map((r) => r.quantity));

  const handleSave = async (confirmed = false) => {
    if (validRows.length === 0) {
      toast.error("No hay productos válidos para guardar");
      return;
    }
    if (!inventories.some((inv) => inv.id === selectedInventoryId)) {
      toast.error("Selecciona un almacén antes de guardar");
      return;
    }

    const tenantId = auth?.company?.id;
    if (!tenantId) {
      toast.error("Sesión inválida — recarga la página");
      return;
    }
    if (needsQuantityConfirmation(largestQuantity) && !confirmed) {
      setConfirmLargeQuantity(true);
      return;
    }
    setConfirmLargeQuantity(false);

    // Todas las filas de un producto viajan con el mismo nombre (el servidor agrupa por nombre).
    const canonicalNames = canonicalProductNames(validRows);
    const payload = {
      tenantId,
      inventoryId: selectedInventoryId,
      rows: validRows.map((r) => ({
        name: canonicalNames.get(productGroupKey(r.name)) ?? r.name,
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

    const apiUrl = `${(process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products)}/products/bulk-import`;

    setIsSaving(true);
    try {
      const res = await axiosAuth.post(apiUrl, payload);

      if (res.data.created === 0 && res.data.errors > 0) {
        toast.error(
          `No se crearon productos. ${res.data.errors} errores — revisa el detalle`,
        );
      } else if (res.data.created > 0) {
        toast.success(
          res.data.message ||
            `Importación completada: ${res.data.created} productos creados`,
        );
        onBack();
      } else {
        toast.warning(
          "La respuesta no indica productos creados. Verifica el resultado de la importación.",
        );
      }
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? `Error (${err.response?.status || "red"}): ${err.response?.data?.message || err.message}`
        : "Error al importar productos";
      toast.error(message);
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

      {warehouseQuery.isError ? <div role="alert">No se pudieron cargar los almacenes del negocio. <Button variant="outline" onClick={() => void warehouseQuery.refetch()}>Reintentar</Button></div> : null}
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
                  Descarga el archivo Excel para completar con tus productos.
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
                    Descarga una plantilla con instrucciones y ejemplos (un polo en
                    S, M, L y XL; zapatillas con talla y color). Una fila por talla
                    o color, con el mismo nombre para el mismo producto.
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
                      <SelectValue placeholder="Elige categoría..." />
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
                      <SelectValue placeholder="Elige subcategoría..." />
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

              {warehouseQuery.isPending ? <p>Cargando almacenes...</p> : warehouseQuery.isError ? <p role="alert">No se pudieron cargar los almacenes. <Button type="button" variant="outline" onClick={() => void warehouseQuery.refetch()}>Reintentar</Button></p> : null}
              {/* Inventory */}
              {inventories.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Almacén destino
                  </Label>
                  <Select
                    value={selectedInventoryId}
                    onValueChange={setSelectedInventoryId}
                    disabled={Boolean(inventoryId) || warehouseQuery.isPending || warehouseQuery.isError}
                  >
                    <SelectTrigger className="h-10 bg-muted/50 border-none shadow-none ring-0 focus:ring-1">
                      <SelectValue placeholder="Seleccionar almacén..." />
                    </SelectTrigger>
                    <SelectContent>
                      {inventories.map((inv: any) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.name}{inv.storeName ? ` · ${inv.storeName}` : ""}
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
              Sube el archivo Excel con tus productos. El sistema leerá
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

            {legacyTemplateError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 text-sm space-y-3"
              >
                <p className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  Plantilla de una versión anterior
                </p>
                <p className="text-red-800 dark:text-red-300">{LEGACY_TEMPLATE_MESSAGE}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDownloadTemplate(true)}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Descargar plantilla nueva
                </Button>
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
                    Haz clic para seleccionar o arrastra tu archivo aquí
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
              Revisa y corrige las categorías de los productos si es necesario.
              Asegúrate de que todos tengan una subcategoría asignada.
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
                    Almacén destino *
                  </Label>
                  <Select
                    value={selectedInventoryId}
                    onValueChange={setSelectedInventoryId}
                    disabled={Boolean(inventoryId) || warehouseQuery.isPending || warehouseQuery.isError}
                  >
                    <SelectTrigger className="bg-white dark:bg-background">
                      <SelectValue placeholder="Selecciona el almacén..." />
                    </SelectTrigger>
                    <SelectContent>
                      {inventories.map((inv: any) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.name}{inv.storeName ? ` · ${inv.storeName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!selectedInventoryId && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-6">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Selecciona un almacén
                  </p>
                )}
              </div>
            </div>

            {errorRows.length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 space-y-2"
              >
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  No se creó nada todavía. Corrige estas filas en tu Excel y vuelve a subirlo
                  (la categoría y subcategoría también se pueden elegir en la tabla):
                </p>
                <ul className="max-h-48 overflow-auto list-disc pl-5 space-y-1 text-xs text-red-800 dark:text-red-300">
                  {errorRows.map((row) => (
                    <li key={row.rowNumber}>{describeRowError(row)}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Table */}
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-secondary z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="min-w-[150px]">Nombre</TableHead>
                      <TableHead className="min-w-[130px]">Variante</TableHead>
                      <TableHead className="min-w-[180px]">Categoría</TableHead>
                      <TableHead className="min-w-[180px]">
                        Subcategoría
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Venta</TableHead>
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
                            {row.rowNumber}
                          </TableCell>
                          <TableCell
                            className="font-medium text-xs max-w-[150px] truncate"
                            title={row.name}
                          >
                            {row.name}
                          </TableCell>
                          <TableCell className="text-xs" title="Talla, color y otros atributos de esta variante">
                            {formatAttributes(row.attributes)}
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
                                  subcategoryProblem: "Selecciona la subcategoría.",
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
                    Corrige los errores para continuar
                  </p>
                )}
                {confirmLargeQuantity && (
                  <div className="flex items-center gap-2 text-xs">
                    <p>{largeQuantityConfirmText(largestQuantity)}</p>
                    <Button size="sm" variant="outline" onClick={() => void handleSave(true)} disabled={isSaving}>Sí, confirmar</Button>
                  </div>
                )}
                <Button
                  size="lg"
                  onClick={() => void handleSave()}
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
