"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, UploadCloud, Download } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

interface ImportExcelModalProps {
    open: boolean;
    onClose: () => void;
    inventoryId: string;
    onSuccess: () => void;
}

export default function ImportExcelModal({ open, onClose, inventoryId, onSuccess }: ImportExcelModalProps) {
    const { auth } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Categoría / subcategoría
    const [categories, setCategories] = useState<any[]>([]);
    const [subcategories, setSubcategories] = useState<any[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
    const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");

    // Cargar categorías al abrir
    useEffect(() => {
        if (!open) return;
        axios
            .get(`${process.env.NEXT_PUBLIC_API_PRODUCTOS}/categories`)
            .then((res) => setCategories(res.data))
            .catch((err) => console.error("Error cargando categorías:", err));
    }, [open]);

    // Cargar subcategorías al cambiar categoría
    useEffect(() => {
        if (!selectedCategoryId) {
            setSubcategories([]);
            setSelectedSubcategoryId("");
            return;
        }
        axios
            .get(`${process.env.NEXT_PUBLIC_API_PRODUCTOS}/subcategories/category/${selectedCategoryId}`)
            .then((res) => {
                setSubcategories(res.data);
                setSelectedSubcategoryId("");
            })
            .catch((err) => console.error("Error cargando subcategorías:", err));
    }, [selectedCategoryId]);

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Productos");

        worksheet.columns = [
            { header: "Nombre", key: "name", width: 30 },
            { header: "Descripción", key: "description", width: 40 },
            { header: "SKU Empresa", key: "companySku", width: 25 },
            { header: "Atributos", key: "attributes", width: 30 },
            { header: "Precio Compra", key: "priceBase", width: 15 },
            { header: "Precio Venta", key: "priceVta", width: 15 },
            { header: "Stock Inicial", key: "quantity", width: 15 },
            { header: "Stock Mínimo", key: "min_stock", width: 15 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF02A8E1" },
        };

        worksheet.addRow({
            name: "Remera Básica",
            description: "Remera de algodón",
            companySku: "REM-001",
            attributes: "Color:Rojo,Talle:M",
            priceBase: 1000,
            priceVta: 2500,
            quantity: 50,
            min_stock: 5,
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Plantilla_Importar_Productos.xlsx";
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error("Por favor selecciona un archivo");
            return;
        }
        if (!inventoryId) {
            toast.error("No hay un inventario seleccionado válido");
            return;
        }
        if (!selectedSubcategoryId) {
            toast.error("Debes seleccionar una categoría y subcategoría");
            return;
        }

        setIsUploading(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);

            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                throw new Error("El archivo no contiene hojas visibles");
            }

            const rows: any[] = [];

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;

                const name = row.getCell(1).value?.toString()?.trim();
                const description = row.getCell(2).value?.toString()?.trim();
                const companySku = row.getCell(3).value?.toString()?.trim();
                const rawAttributes = row.getCell(4).value?.toString()?.trim();
                const priceBase = Number(row.getCell(5).value) || 0;
                const priceVta = Number(row.getCell(6).value) || 0;
                const quantity = Number(row.getCell(7).value) || 0;
                const min_stock = Number(row.getCell(8).value) || 0;

                if (!name) return;

                const attributes: Record<string, string> = {};
                if (rawAttributes) {
                    const pairs = rawAttributes.split(",");
                    pairs.forEach((pair) => {
                        const [k, v] = pair.split(":");
                        if (k && v) attributes[k.trim()] = v.trim();
                    });
                }

                rows.push({
                    name,
                    description,
                    companySku,
                    attributes,
                    priceBase,
                    priceVta,
                    quantity,
                    min_stock,
                });
            });

            if (rows.length === 0) {
                toast.warning("No se encontraron productos válidos en el archivo");
                setIsUploading(false);
                return;
            }

            const tenantId = auth?.company?.id;
            if (!tenantId) throw new Error("Compañía no definida en la sesión");

            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/products/bulk-import`,
                {
                    tenantId,
                    inventoryId,
                    subcategoryId: selectedSubcategoryId,
                    rows,
                },
            );

            toast.success(
                res.data.message ||
                `Importación completada: ${res.data.created || rows.length} productos`,
            );
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error(
                error.response?.data?.message ||
                error.message ||
                "Error al procesar el archivo Excel",
            );
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(val) => {
                if (isUploading) return;
                if (!val) onClose();
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Importar Productos</DialogTitle>
                    <DialogDescription>
                        Seleccioná la categoría, subcategoría, descargá la plantilla y subí tu archivo.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-5 py-3">
                    {/* Paso 1: Categoría y Subcategoría */}
                    <div className="flex flex-col gap-3 rounded-lg border p-4 bg-muted/50">
                        <h4 className="text-sm font-medium">1. Seleccionar categoría</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs mb-1 block">Categoría</Label>
                                <Select
                                    value={selectedCategoryId}
                                    onValueChange={setSelectedCategoryId}
                                    disabled={isUploading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Categoría..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((cat: any) => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs mb-1 block">Subcategoría</Label>
                                <Select
                                    value={selectedSubcategoryId}
                                    onValueChange={setSelectedSubcategoryId}
                                    disabled={!selectedCategoryId || isUploading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Subcategoría..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subcategories.map((sub: any) => (
                                            <SelectItem key={sub.id} value={sub.id}>
                                                {sub.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Paso 2: Plantilla */}
                    <div className="flex flex-col gap-2 rounded-lg border p-4 bg-muted/50">
                        <h4 className="text-sm font-medium">2. Descargar plantilla</h4>
                        <p className="text-xs text-muted-foreground">
                            Usá nuestro archivo con las columnas exactas para evitar fallos.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-fit mt-1"
                            onClick={handleDownloadTemplate}
                            disabled={isUploading}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Plantilla.xlsx
                        </Button>
                    </div>

                    {/* Paso 3: Subir archivo */}
                    <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-medium">3. Subir archivo completo</h4>
                        <Label
                            htmlFor="file-upload"
                            className="cursor-pointer group flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-5 hover:bg-muted/50 transition duration-200 text-center"
                        >
                            <UploadCloud className="mb-2 h-7 w-7 text-muted-foreground group-hover:text-primary transition" />
                            <span className="text-sm font-medium">Click para buscar</span>
                            <span className="text-xs text-muted-foreground mt-1">
                                {file ? file.name : "Solo archivos .xlsx"}
                            </span>
                            <Input
                                id="file-upload"
                                type="file"
                                accept=".xlsx"
                                className="hidden"
                                onChange={handleFileChange}
                                disabled={isUploading}
                            />
                        </Label>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={isUploading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={isUploading || !file || !selectedSubcategoryId}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            "Importar Datos"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
