"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ExportButtonProps {
  label?: string;
  filename: string;
  rows: Record<string, unknown>[];
  variant?: "outline" | "default";
}

/** Exporta a .xls (HTML table) siguiendo el contrato de la Sección 10 de la especificación. */
export function ExportButton({ label = "Exportar", filename, rows, variant = "outline" }: ExportButtonProps) {
  function handleExport() {
    if (!rows.length) {
      toast.error("No hay datos para exportar con los filtros actuales.");
      return;
    }
    const headers = Object.keys(rows[0]);
    const table = `
      <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows
            .map((r) => `<tr>${headers.map((h) => `<td>${String(r[h] ?? "")}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>`;
    const blob = new Blob(["﻿" + table], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `${filename}_${today}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${label} generado: ${rows.length} filas`);
  }

  return (
    <Button variant={variant} size="sm" className="gap-1.5" onClick={handleExport}>
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
