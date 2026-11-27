"use client";

import { Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { formatMotivoNota } from "@/app/facturacion/lib/motivos-nota-credito";
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
import { useDespatchAdvicesReport } from "@/features/sunat/despatch-advice/hooks/use-despatch-advices";
import type { DespatchAdvice } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import {
  GRE_REASON_LABEL,
  GRE_STATUS_LABEL,
} from "@/features/sunat/despatch-advice/utils/gre-form";
import { useSunatDocumentPdf } from "@/features/sunat/sunat-document/hooks/use-sunat-document-pdf";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import {
  expandPrepaymentRows,
  reportAmountsOf,
} from "@/features/sunat/sunat-document/utils/prepayment-report";
import { filterRowsByIssuerRuc } from "@/features/sunat/sunat-document/utils/tax-document-kpis";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import type { Nota } from "@/types/facturacion";
import { downloadFile } from "@/utils/http/download-file";

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
            background: #4C2FB5;
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
  comprobanteRows: TaxDocumentRow[];
  notas: Nota[];
  /**
   * Multi-RUC: RUC picked in the "RUC emisor" filter. When set, every sales
   * report only contains that issuer, as an accounting book must.
   */
  issuer?: Pick<SunatProfile, "ruc" | "razonSocial">;
  /**
   * Multi-RUC: the company has more than one RUC. Two RUC can share the
   * same series and number, so each row states its issuer.
   */
  showIssuerColumn?: boolean;
}

function getFullNumber(row: TaxDocumentRow): string | null {
  if (!row.taxDocument) {
    return null;
  }

  return `${row.taxDocument.series}-${row.taxDocument.correlative}`;
}

/** Spanish label matching the estado shown elsewhere in Facturación. */
function getEstadoLabel(row: TaxDocumentRow): "ACEPTADO" | "ACEPTADO_CON_OBS" {
  return row.taxDocument?.cdrStatus === "ACCEPTED_WITH_OBSERVATION"
    ? "ACEPTADO_CON_OBS"
    : "ACEPTADO";
}

const isoDay = (value: string) => {
  const [year, month, date] = value.split("-");
  return year && month && date ? `${date}/${month}/${year}` : value;
};

/** RUC elegido en el filtro «RUC emisor» y cómo lo dicen el título y el nombre del archivo. */
interface IssuerScope {
  ruc?: string;
  title: string;
  filename: string;
}

/**
 * FEAT-24 H12 — registro de guías de remisión con las GRE reales de ms-sunat (antes, las del mock en memoria).
 * Multi-RUC: con un RUC elegido solo trae sus guías, igual que los registros de ventas.
 */
function getReporteGuias(allGuias: DespatchAdvice[], scope: IssuerScope): ReporteData {
  const guias = scope.ruc ? allGuias.filter((guia) => guia.rucIssuer === scope.ruc) : allGuias;
  return {
    title: `Registro de Guías de Remisión${scope.title}`,
    filename: `powip_guias_remision${scope.filename}`,
    headers: [
      "Fecha",
      "N° Guía",
      "RUC emisor",
      "Motivo",
      "Referencia",
      "Destinatario",
      "Destino",
      "Ubigeo destino",
      "Estado SUNAT",
      "Código SUNAT",
    ],
    rows: guias.map((guia) => [
      isoDay(guia.issueDate),
      guia.number,
      guia.rucIssuer,
      `${guia.transferReason} ${GRE_REASON_LABEL[guia.transferReason] ?? ""}`.trim(),
      guia.externalReference ?? "",
      guia.payload.recipient?.name ?? "",
      guia.payload.destination?.address ?? "",
      guia.payload.destination?.ubigeo ?? "",
      GRE_STATUS_LABEL[guia.status] ?? guia.status,
      guia.sunatCode ?? "",
    ]),
  };
}

export function ReportesTab({
  comprobanteRows,
  notas,
  issuer,
  showIssuerColumn = false,
}: ReportesTabProps) {
  const guiasReport = useDespatchAdvicesReport();
  const {
    mutate: downloadSunatDocumentPdf,
    isPending: isDownloadingPdf,
    variables: downloadingDocumentId,
  } = useSunatDocumentPdf();

  // Each anticipo is its own comprobante: one line per anticipo, and the final
  // one with its net amounts, so the sale is counted once.
  const aceptados = filterRowsByIssuerRuc(
    expandPrepaymentRows(comprobanteRows),
    issuer?.ruc,
  ).filter(
    (row) =>
      row.taxDocument?.cdrStatus === "ACCEPTED" ||
      row.taxDocument?.cdrStatus === "ACCEPTED_WITH_OBSERVATION",
  );

  const handleDownloadPdf = (row: TaxDocumentRow) => {
    if (!row.taxDocument) {
      return;
    }

    downloadSunatDocumentPdf(row.taxDocument.id, {
      onSuccess: (file) => downloadFile(file),
      onError: () => toast.error("No se pudo descargar el PDF del comprobante"),
    });
  };

  // Issuer scope shared by the sales reports: title and file name say which
  // RUC the book belongs to, and each row carries its RUC when there are several.
  const issuerTitle = issuer ? ` — ${issuer.razonSocial} (RUC ${issuer.ruc})` : "";
  const issuerFilename = issuer ? `_${issuer.ruc}` : "";
  const issuerHeader = showIssuerColumn ? ["RUC Emisor"] : [];
  const issuerCell = (row: TaxDocumentRow) =>
    showIssuerColumn ? [row.taxDocument?.rucIssuer ?? ""] : [];

  const getReporte = (key: Exclude<ReporteKey, "guias">): ReporteData => {
    if (key === "ventas") {
      return {
        title: `Registro de Ventas${issuerTitle}`,
        filename: `powip_registro_ventas${issuerFilename}`,
        headers: [
          ...issuerHeader,
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
          const { total, baseImponible, igv } = reportAmountsOf(row);

          return [
            ...issuerCell(row),
            new Date(row.sale.createdAt).toLocaleDateString("es-PE"),
            row.taxDocument?.taxDocumentType === "01" ? "Factura" : "Boleta",
            getFullNumber(row) || "",
            row.sale.customer.fullName,
            row.sale.customer.documentNumber || "",
            baseImponible.toFixed(2),
            igv.toFixed(2),
            total.toFixed(2),
            getEstadoLabel(row),
          ];
        }),
      };
    }

    if (key === "sire") {
      return {
        title: `Registro de Ventas e Ingresos (formato SIRE)${issuerTitle}`,
        filename: `powip_sire_rvie${issuerFilename}`,
        headers: [
          ...issuerHeader,
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
          const { total, baseImponible, igv } = reportAmountsOf(row);
          const [serie = "", numero = ""] = (getFullNumber(row) || "-").split("-");
          const tipo = row.taxDocument?.taxDocumentType || "03";

          return [
            ...issuerCell(row),
            new Date(row.sale.createdAt).toLocaleDateString("es-PE"),
            tipo,
            serie,
            numero,
            tipo === "01" ? "6" : "1",
            row.sale.customer.documentNumber || "",
            row.sale.customer.fullName,
            baseImponible.toFixed(2),
            igv.toFixed(2),
            total.toFixed(2),
          ];
        }),
      };
    }

    return {
      title: "Registro de Notas de Crédito y Débito",
      filename: "powip_notas_credito",
      headers: ["Fecha", "N° Nota", "Comprobante Original", "Cliente", "Motivo", "Monto", "Estado"],
      rows: notas.map((nota) => [
        nota.fecha,
        nota.num,
        nota.original,
        nota.cliente,
        formatMotivoNota(nota),
        nota.monto.toFixed(2),
        nota.estado,
      ]),
    };
  };

  const handleDescargar = (key: ReporteKey, tipo: DownloadType) => {
    if (key === "guias" && !guiasReport.data) {
      toast.error(
        guiasReport.isError
          ? "No se pudieron cargar las guías de remisión. Inténtalo de nuevo."
          : "Todavía se están cargando las guías de remisión.",
      );
      if (guiasReport.isError) void guiasReport.refetch();
      return;
    }
    const reporte =
      key === "guias"
        ? getReporteGuias(guiasReport.data ?? [], {
            ruc: issuer?.ruc,
            title: issuerTitle,
            filename: issuerFilename,
          })
        : getReporte(key);

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
      desc: "Las guías de remisión electrónicas (GRE) emitidas, con su estado en SUNAT.",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Reportes</h2>

        <p className="text-sm text-muted-foreground">
          Descarga en Excel, CSV o PDF todo lo que tu contador necesita, sin salir de Powip.
        </p>

        {showIssuerColumn && (
          <p className="text-sm">
            {issuer ? (
              <>
                Reportes de <span className="font-semibold">{issuer.razonSocial}</span> · RUC{" "}
                {issuer.ruc}. Cambia de RUC en el filtro &quot;RUC emisor&quot;.
              </>
            ) : (
              <>
                Incluyen todos tus RUC: cada fila indica su RUC emisor. Para el libro de un solo
                RUC, elígelo en el filtro &quot;RUC emisor&quot;.
              </>
            )}
          </p>
        )}
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
            Descarga el PDF del comprobante tal como fue enviado a SUNAT para cada comprobante
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
                    const taxDocument = row.taxDocument;
                    const isDownloading =
                      isDownloadingPdf && downloadingDocumentId === taxDocument?.id;

                    return (
                      <TableRow key={taxDocument?.id ?? row.sale.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(row.sale.createdAt).toLocaleDateString("es-PE")}
                        </TableCell>

                        <TableCell className="font-medium">{getFullNumber(row) || "—"}</TableCell>

                        <TableCell>{row.sale.customer.fullName}</TableCell>

                        <TableCell className="text-right font-bold">
                          S/ {reportAmountsOf(row).total.toFixed(2)}
                        </TableCell>

                        <TableCell className="text-right">
                          {taxDocument ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={isDownloading}
                                onClick={() => handleDownloadPdf(row)}
                              >
                                {isDownloading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5 text-red-600" />
                                )}
                                PDF
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
