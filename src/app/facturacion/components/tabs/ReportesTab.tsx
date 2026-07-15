"use client";

import * as XLSX from "xlsx";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ComprobanteRow } from "@/hooks/useComprobantesSunat";
import { Guia, Nota } from "@/types/facturacion";

interface ReporteData {
  title: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}

function downloadXLS(filename: string, headers: string[], rows: (string | number)[][]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(";"), ...rows.map((r) => r.map(escape).join(";"))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function abrirImpresionPDF(title: string, headers: string[], rows: (string | number)[][]) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Habilita las ventanas emergentes para generar el PDF");
    return;
  }
  const th = headers.map((h) => `<th>${h}</th>`).join("");
  const trs = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  w.document.write(`<html><head><title>${title}</title><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#101828}
    h1{font-size:18px;margin-bottom:2px} table{width:100%;border-collapse:collapse;margin-top:14px}
    th{background:#6D4FE0;color:#fff;text-align:left;padding:7px 9px;font-size:11px}
    td{padding:7px 9px;font-size:11.5px;border-bottom:1px solid #eee}
  </style></head><body>
  <h1>${title}</h1><div style="color:#667085;font-size:12px">Powip · Generado el ${new Date().toLocaleDateString("es-PE")}</div>
  <table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

interface ReportesTabProps {
  comprobanteRows: ComprobanteRow[];
  notas: Nota[];
  guias: Guia[];
}

export function ReportesTab({ comprobanteRows, notas, guias }: ReportesTabProps) {
  const aceptados = comprobanteRows.filter((r) => r.estado === "ACEPTADO" || r.estado === "ACEPTADO_CON_OBS");

  const getReporte = (key: "ventas" | "sire" | "notas" | "guias"): ReporteData => {
    if (key === "ventas") {
      return {
        title: "Registro de Ventas",
        filename: "powip_registro_ventas",
        headers: ["Fecha", "Tipo", "Serie-Correlativo", "Cliente", "Doc. Cliente", "Op. Gravada", "IGV", "Total", "Estado"],
        rows: aceptados.map((r) => {
          const total = Number(r.sale.grandTotal);
          return [
            new Date(r.sale.created_at).toLocaleDateString("es-PE"),
            r.tipo === "01" ? "Factura" : "Boleta",
            r.fullNumber || "",
            r.sale.customer.fullName,
            r.sale.customer.documentNumber || "",
            (total / 1.18).toFixed(2),
            (total - total / 1.18).toFixed(2),
            total.toFixed(2),
            r.estado,
          ];
        }),
      };
    }
    if (key === "sire") {
      return {
        title: "Registro de Ventas e Ingresos (formato SIRE)",
        filename: "powip_sire_rvie",
        headers: [
          "Fecha Emisión",
          "Tipo CPE",
          "Serie",
          "Número",
          "Tipo Doc. Cliente",
          "Núm. Doc. Cliente",
          "Cliente",
          "Base Imponible",
          "IGV",
          "Importe Total",
        ],
        rows: aceptados.map((r) => {
          const total = Number(r.sale.grandTotal);
          const [serie, numero] = (r.fullNumber || "-").split("-");
          return [
            new Date(r.sale.created_at).toLocaleDateString("es-PE"),
            r.tipo || "03",
            serie || "",
            numero || "",
            r.tipo === "01" ? "6" : "1",
            r.sale.customer.documentNumber || "",
            r.sale.customer.fullName,
            (total / 1.18).toFixed(2),
            (total - total / 1.18).toFixed(2),
            total.toFixed(2),
          ];
        }),
      };
    }
    if (key === "notas") {
      return {
        title: "Registro de Notas de Crédito y Débito",
        filename: "powip_notas_credito",
        headers: ["Fecha", "N° Nota", "Comprobante Original", "Cliente", "Motivo", "Monto", "Estado"],
        rows: notas.map((n) => [n.fecha, n.num, n.original, n.cliente, n.motivo, n.monto.toFixed(2), n.estado]),
      };
    }
    return {
      title: "Registro de Guías de Remisión",
      filename: "powip_guias_remision",
      headers: ["Fecha", "N° Guía", "Pedido", "Destino", "Estado"],
      rows: guias.map((g) => [g.fecha, g.fullNumber || "—", g.pedido, g.destino, g.estado]),
    };
  };

  const handleDescargar = (key: "ventas" | "sire" | "notas" | "guias", tipo: "xls" | "csv" | "pdf") => {
    const r = getReporte(key);
    if (!r.rows.length) {
      toast.error("No hay datos disponibles para este reporte todavía");
      return;
    }
    if (tipo === "xls") downloadXLS(r.filename, r.headers, r.rows);
    else if (tipo === "csv") downloadCSV(r.filename, r.headers, r.rows);
    else abrirImpresionPDF(r.title, r.headers, r.rows);
  };

  const cards: { key: "ventas" | "sire" | "notas" | "guias"; title: string; desc: string; beta?: boolean }[] = [
    { key: "ventas", title: "Registro de Ventas", desc: "Boletas y facturas aceptadas — listo para tu contador." },
    {
      key: "sire",
      title: "Libro Electrónico (formato SIRE/RVIE)",
      desc: "Las mismas ventas en el formato columnar que exige el registro de ventas e ingresos electrónico.",
    },
    { key: "notas", title: "Notas de Crédito y Débito", desc: "Todas las NC/ND emitidas en esta sesión de vista previa.", beta: true },
    { key: "guias", title: "Guías de Remisión", desc: "Trazabilidad de los traslados emitidos en esta sesión de vista previa.", beta: true },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Reportes</h2>
        <p className="text-sm text-muted-foreground">Descarga en Excel, CSV o PDF todo lo que tu contador necesita, sin salir de Powip.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Card key={c.key}>
            <CardContent className="pt-6">
              <h4 className="font-bold flex items-center gap-2">
                {c.title}
                {c.beta && <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">Beta</span>}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 mb-4">{c.desc}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => handleDescargar(c.key, "xls")}>
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => handleDescargar(c.key, "csv")}>
                  <FileText className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => handleDescargar(c.key, "pdf")}>
                  <Printer className="h-3.5 w-3.5 text-red-600" /> PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
