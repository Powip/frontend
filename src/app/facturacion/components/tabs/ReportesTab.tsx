"use client";

import { Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDownloadTaxDocument } from "@/hooks/sunat/sunat-document/use-download-tax-document";
import type { ComprobanteRow } from "@/hooks/useComprobantesSunat";
import type { Guia, Nota } from "@/types/facturacion";

interface ReporteData {
  title: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}

type ReporteKey = "ventas" | "sire" | "notas" | "guias";
type DownloadType = "xls" | "csv" | "pdf";

function downloadXLS(filename: string, headers: string[], rows: (string | number)[][]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

function escapeCsvValue(value: string | number): string {
  const stringValue = String(value ?? "");

  return /[;"\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [
    headers.map(escapeCsvValue).join(";"),
    ...rows.map((row) => row.map(escapeCsvValue).join(";")),
  ];

  const csvContent = `﻿${lines.join("\r\n")}`;
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${filename}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

function escapeHtml(value: string | number): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function abrirImpresionPDF(title: string, headers: string[], rows: (string | number)[][]) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    toast.error("Habilita las ventanas emergentes para generar el PDF");
    return;
  }

  const tableHeaders = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");

  const tableRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 24px;
            color: #101828;
          }

          h1 {
            font-size: 18px;
            margin-bottom: 2px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 14px;
          }

          th {
            background: #6D4FE0;
            color: #fff;
            text-align: left;
            padding: 7px 9px;
            font-size: 11px;
          }

          td {
            padding: 7px 9px;
            font-size: 11.5px;
            border-bottom: 1px solid #eee;
          }
        </style>
      </head>

      <body>
        <h1>${escapeHtml(title)}</h1>

        <div style="color:#667085;font-size:12px">
          Powip · Generado el ${escapeHtml(new Date().toLocaleDateString("es-PE"))}
        </div>

        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>

          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 400);
}

interface ReportesTabProps {
  comprobanteRows: ComprobanteRow[];
  notas: Nota[];
  guias: Guia[];
}

export function ReportesTab({ comprobanteRows, notas, guias }: ReportesTabProps) {
  const { downloadPdf, downloadXml, isDownloading } = useDownloadTaxDocument();

  const aceptados = comprobanteRows.filter(
    (row) => row.estado === "ACEPTADO" || row.estado === "ACEPTADO_CON_OBS",
  );

  const getReporte = (key: ReporteKey): ReporteData => {
    if (key === "ventas") {
      return {
        title: "Registro de Ventas",
        filename: "powip_registro_ventas",
        headers: [
          "Fecha",
          "Tipo",
          "Serie-Correlativo",
          "Cliente",
          "Doc. Cliente",
          "Op. Gravada",
          "IGV",
          "Total",
          "Estado",
        ],
        rows: aceptados.map((row) => {
          const total = Number(row.sale.grandTotal);
          const baseImponible = total / 1.18;
          const igv = total - baseImponible;

          return [
            new Date(row.sale.createdAt).toLocaleDateString("es-PE"),
            row.tipo === "01" ? "Factura" : "Boleta",
            row.fullNumber || "",
            row.sale.customer.fullName,
            row.sale.customer.documentNumber || "",
            baseImponible.toFixed(2),
            igv.toFixed(2),
            total.toFixed(2),
            row.estado,
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
        rows: aceptados.map((row) => {
          const total = Number(row.sale.grandTotal);
          const baseImponible = total / 1.18;
          const igv = total - baseImponible;
          const [serie = "", numero = ""] = (row.fullNumber || "-").split("-");

          return [
            new Date(row.sale.createdAt).toLocaleDateString("es-PE"),
            row.tipo || "03",
            serie,
            numero,
            row.tipo === "01" ? "6" : "1",
            row.sale.customer.documentNumber || "",
            row.sale.customer.fullName,
            baseImponible.toFixed(2),
            igv.toFixed(2),
            total.toFixed(2),
          ];
        }),
      };
    }

    if (key === "notas") {
      return {
        title: "Registro de Notas de Crédito y Débito",
        filename: "powip_notas_credito",
        headers: [
          "Fecha",
          "N° Nota",
          "Comprobante Original",
          "Cliente",
          "Motivo",
          "Monto",
          "Estado",
        ],
        rows: notas.map((nota) => [
          nota.fecha,
          nota.num,
          nota.original,
          nota.cliente,
          nota.motivo,
          nota.monto.toFixed(2),
          nota.estado,
        ]),
      };
    }

    return {
      title: "Registro de Guías de Remisión",
      filename: "powip_guias_remision",
      headers: ["Fecha", "N° Guía", "Pedido", "Destino", "Estado"],
      rows: guias.map((guia) => [
        guia.fecha,
        guia.fullNumber || "—",
        guia.pedido,
        guia.destino,
        guia.estado,
      ]),
    };
  };

  const handleDescargar = (key: ReporteKey, tipo: DownloadType) => {
    const reporte = getReporte(key);

    if (!reporte.rows.length) {
      toast.error("No hay datos disponibles para este reporte todavía");
      return;
    }

    switch (tipo) {
      case "xls":
        downloadXLS(reporte.filename, reporte.headers, reporte.rows);
        break;

      case "csv":
        downloadCSV(reporte.filename, reporte.headers, reporte.rows);
        break;

      case "pdf":
        abrirImpresionPDF(reporte.title, reporte.headers, reporte.rows);
        break;
    }
  };

  const cards: {
    key: ReporteKey;
    title: string;
    desc: string;
    beta?: boolean;
  }[] = [
    {
      key: "ventas",
      title: "Registro de Ventas",
      desc: "Boletas y facturas aceptadas — listo para tu contador.",
    },
    {
      key: "sire",
      title: "Libro Electrónico (formato SIRE/RVIE)",
      desc: "Las mismas ventas en el formato columnar que exige el registro de ventas e ingresos electrónico.",
    },
    {
      key: "notas",
      title: "Notas de Crédito y Débito",
      desc: "Todas las NC/ND emitidas en esta sesión de vista previa.",
      beta: true,
    },
    {
      key: "guias",
      title: "Guías de Remisión",
      desc: "Trazabilidad de los traslados emitidos en esta sesión de vista previa.",
      beta: true,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Reportes</h2>

        <p className="text-sm text-muted-foreground">
          Descarga en Excel, CSV o PDF todo lo que tu contador necesita, sin salir de Powip.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.key}>
            <CardContent className="pt-6">
              <h4 className="flex items-center gap-2 font-bold">
                {card.title}

                {card.beta && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Beta
                  </span>
                )}
              </h4>

              <p className="mb-4 mt-1 text-xs text-muted-foreground">{card.desc}</p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => handleDescargar(card.key, "xls")}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                  Excel
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => handleDescargar(card.key, "csv")}
                >
                  <FileText className="h-3.5 w-3.5" />
                  CSV
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => handleDescargar(card.key, "pdf")}
                >
                  <Printer className="h-3.5 w-3.5 text-red-600" />
                  PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comprobantes individuales</CardTitle>

          <CardDescription>
            Descarga el PDF o el XML firmado tal como fue enviado a SUNAT para cada comprobante
            aceptado.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Descargas</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {aceptados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      Aún no hay comprobantes aceptados para descargar
                    </TableCell>
                  </TableRow>
                ) : (
                  aceptados.map((row) => {
                    const document = row.document;

                    return (
                      <TableRow key={row.sale.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(row.sale.createdAt).toLocaleDateString("es-PE")}
                        </TableCell>

                        <TableCell className="font-medium">{row.fullNumber || "—"}</TableCell>

                        <TableCell>{row.sale.customer.fullName}</TableCell>

                        <TableCell className="text-right font-bold">
                          S/ {Number(row.sale.grandTotal).toFixed(2)}
                        </TableCell>

                        <TableCell className="text-right">
                          {document ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={isDownloading(row.sale.id, "pdf")}
                                onClick={() => downloadPdf(document)}
                              >
                                {isDownloading(row.sale.id, "pdf") ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5 text-red-600" />
                                )}
                                PDF
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={isDownloading(row.sale.id, "xml")}
                                onClick={() => downloadXml(document)}
                              >
                                {isDownloading(row.sale.id, "xml") ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5 text-blue-600" />
                                )}
                                XML
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
