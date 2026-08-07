"use client";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FileSpreadsheet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Modal de exportación genérico para las 4 pestañas de Liquidaciones —
 * el caller ya decide qué filas van (selección, filtrado o todo) y con qué
 * columnas; este modal solo confirma y genera el .xlsx. A diferencia del
 * mockup, no ofrece un selector de "Formato" con 3 variantes porque en la
 * práctica cada botón de exportar de este módulo ya sabe qué forma de datos
 * necesita — mostrar 3 radios que todos producen la misma fila hubiera sido
 * una opción falsa.
 */
export function ExportModal({
  open,
  onOpenChange,
  title,
  subtitle,
  rows,
  filename,
  sheetName = "Datos",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  rows: Record<string, string | number>[];
  filename: string;
  sheetName?: string;
}) {
  const handleDownload = () => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {rows.length} fila{rows.length === 1 ? "" : "s"} listas para exportar.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={rows.length === 0} onClick={handleDownload}>
            Descargar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
