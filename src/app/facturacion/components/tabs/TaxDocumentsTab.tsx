"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  Clock,
  DollarSign,
  FileCheck,
  Loader2,
  MessageCircle,
  Printer,
  Search,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import DetalleComprobanteModal from "@/app/facturacion/components/modals/DetalleComprobanteModal";
import EmitirComprobanteModal from "@/app/facturacion/components/modals/EmitirComprobanteModal";
import LoteEmisionModal from "@/app/facturacion/components/modals/LoteEmisionModal";
import RechazadoModal from "@/app/facturacion/components/modals/RechazadoModal";
import { PdfPreviewDialog } from "@/components/pdf/PdfPreviewDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
  TAX_DOCUMENT_STATUSES,
  type TaxDocumentStatus,
} from "@/features/sunat/shared/types/sunat.types";
import { useSunatDocumentPdf } from "@/features/sunat/sunat-document/hooks/use-sunat-document-pdf";
import { useSunatDocumentsBulkPdf } from "@/features/sunat/sunat-document/hooks/use-sunat-documents-bulk-pdf";
import { useSunatDocumentsBulkPdfZip } from "@/features/sunat/sunat-document/hooks/use-sunat-documents-bulk-pdf-zip";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import type { useTaxDocuments } from "@/hooks/useTaxDocuments";
import { cn } from "@/lib/utils";
import type { DownloadFileResult } from "@/types/download-file.types";
import { downloadFile } from "@/utils/http/download-file";

type SentMap = Record<string, { wa?: boolean; print?: boolean }>;

const PIPELINE_ORDER: TaxDocumentStatus[] = [
  "SIN_EMITIR",
  "PENDING",
  "ACCEPTED",
  "ACCEPTED_WITH_OBSERVATION",
  "REJECTED",
  "RETRY_EXCEEDED",
];

interface TaxDocumentsTabProps {
  comprobantes: ReturnType<typeof useTaxDocuments>;
  onGenerarNota: (row: TaxDocumentRow) => void;
}

function getRowStatus(row: TaxDocumentRow): TaxDocumentStatus {
  return row.taxDocument?.cdrStatus ?? "SIN_EMITIR";
}

function isAcceptedStatus(status: TaxDocumentStatus): boolean {
  return status === "ACCEPTED" || status === "ACCEPTED_WITH_OBSERVATION";
}

function getDocumentNumber(row: TaxDocumentRow): string | null {
  const taxDocument = row.taxDocument;

  if (!taxDocument) {
    return null;
  }

  return `${taxDocument.series}-${taxDocument.correlative}`;
}

function getDocumentTypeLabel(taxDocument: TaxDocumentRow["taxDocument"]): string {
  if (!taxDocument) {
    return "Sin definir";
  }

  switch (taxDocument.taxDocumentType) {
    case "01":
      return `Factura ${taxDocument.series}`;

    case "03":
      return `Boleta ${taxDocument.series}`;

    default:
      return taxDocument.taxDocumentType;
  }
}

function getDocumentTypeBadge(taxDocument: TaxDocumentRow["taxDocument"]) {
  if (!taxDocument) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Sin definir
      </Badge>
    );
  }

  switch (taxDocument.taxDocumentType) {
    case "03":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300">
          Boleta {taxDocument.series}
        </Badge>
      );

    case "01":
      return (
        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
          Factura {taxDocument.series}
        </Badge>
      );

    default:
      return <Badge variant="outline">{getDocumentTypeLabel(taxDocument)}</Badge>;
  }
}

function getStatusBadge(status: TaxDocumentStatus) {
  const meta = TAX_DOCUMENT_STATUSES[status];

  return <Badge className={meta.badgeClassName}>{meta.label}</Badge>;
}

function buildWhatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");

  let fullNumber = "";

  if (digits.length === 9 && digits.startsWith("9")) {
    fullNumber = `51${digits}`;
  } else if (digits.length === 11 && digits.startsWith("519")) {
    fullNumber = digits;
  } else {
    return null;
  }

  const baseUrl = `https://api.whatsapp.com/send?phone=${fullNumber}`;
  return message ? `${baseUrl}&text=${encodeURIComponent(message)}` : baseUrl;
}

export function TaxDocumentsTab({ comprobantes, onGenerarNota }: TaxDocumentsTabProps) {
  const {
    rows,
    loading,
    kpis,
    selectedIds,
    selectedRows,
    refreshListDocuments,
    toggleSelected,
    clearSelection,
  } = comprobantes;

  const { mutateAsync: fetchTaxDocumentPdf } = useSunatDocumentPdf();
  const { mutateAsync: fetchBulkPdf, isPending: isBulkPdfLoading } = useSunatDocumentsBulkPdf();
  const { mutateAsync: fetchBulkZip, isPending: isBulkZipLoading } = useSunatDocumentsBulkPdfZip();

  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<DownloadFileResult | null>(null);

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<TaxDocumentStatus | "">("");
  const [filterTipo, setFilterTipo] = useState("");
  const [showPipeline, setShowPipeline] = useState(false);

  const [sentMap, setSentMap] = useState<SentMap>({});
  const [emitirRow, setEmitirRow] = useState<TaxDocumentRow | null>(null);
  const [detalleRow, setDetalleRow] = useState<TaxDocumentRow | null>(null);
  const [rechazadoRow, setRechazadoRow] = useState<TaxDocumentRow | null>(null);
  const [loteOpen, setLoteOpen] = useState(false);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const status = getRowStatus(row);
      const taxDocument = row.taxDocument;

      if (filterEstado && status !== filterEstado) {
        return false;
      }

      if (filterTipo && taxDocument?.taxDocumentType !== filterTipo) {
        return false;
      }

      if (query) {
        const searchable = [
          row.sale.customer.fullName,
          row.sale.customer.documentNumber,
          row.sale.customer.phoneNumber,
          row.sale.orderNumber,
          getDocumentNumber(row),
          row.sale.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [rows, search, filterEstado, filterTipo]);

  const selectedPendientes = useMemo(
    () => selectedRows.filter((r) => !r.taxDocument),
    [selectedRows],
  );

  const selectedEmitidos = useMemo(
    () => selectedRows.filter((r) => r.taxDocument && isAcceptedStatus(getRowStatus(r))),
    [selectedRows],
  );

  const isBulkActionPending = isBulkPdfLoading || isBulkZipLoading;

  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((row) => selectedIds.has(row.sale.id));

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      filteredRows.forEach((row) => {
        toggleSelected(row.sale.id, true);
      });
    } else {
      clearSelection();
    }
  };

  const getSelectedDocumentIds = (): string[] => {
    return selectedEmitidos
      .map((row) => row.taxDocument?.id)
      .filter((id): id is string => Boolean(id));
  };

  const handlePrint = async (row: TaxDocumentRow) => {
    if (!row.taxDocument) return;

    setLoadingPdfId(row.taxDocument.id);

    try {
      const file = await fetchTaxDocumentPdf(row.taxDocument.id);
      setPdfPreview(file);

      setSentMap((previous) => ({
        ...previous,
        [row.sale.id]: {
          ...previous[row.sale.id],
          print: true,
        },
      }));
    } catch (error) {
      console.error("Error fetching SUNAT document PDF:", error);
      toast.error("No se pudo obtener el PDF del comprobante");
    } finally {
      setLoadingPdfId(null);
    }
  };

  const handleBulkPrint = async () => {
    const ids = getSelectedDocumentIds();
    if (ids.length === 0) return;

    try {
      const fileResult = await fetchBulkPdf({ ids });
      setPdfPreview(fileResult);
    } catch (error) {
      console.error("Error creating bulk PDF:", error);
      toast.error("No se pudo generar el documento concatenado para impresión");
    }
  };

  const handleBulkDownloadZip = async () => {
    const ids = getSelectedDocumentIds();
    if (ids.length === 0) return;

    try {
      const fileResult = await fetchBulkZip({ ids });
      downloadFile(fileResult);
      toast.success("Archivo ZIP descargado exitosamente");
    } catch (error) {
      console.error("Error creating bulk ZIP:", error);
      toast.error("No se pudo descargar el archivo ZIP");
    }
  };

  const handleWhatsApp = (row: TaxDocumentRow) => {
    const whatsappUrl = buildWhatsAppUrl(
      row.sale.customer.phoneNumber,
      `Hola ${row.sale.customer.fullName}, adjuntamos su comprobante ${getDocumentNumber(row)}.`,
    );

    if (!whatsappUrl) {
      toast.error("El cliente no tiene un teléfono celular válido (9 dígitos)");
      return;
    }

    setSentMap((previous) => ({
      ...previous,
      [row.sale.id]: {
        ...previous[row.sale.id],
        wa: true,
      },
    }));

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const getDistributionIcons = (row: TaxDocumentRow) => {
    const status = getRowStatus(row);

    if (!isAcceptedStatus(status)) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }

    const sent = sentMap[row.sale.id] ?? {};
    const isThisRowLoadingPdf = loadingPdfId === row.taxDocument?.id;
    const hasValidPhone = Boolean(buildWhatsAppUrl(row.sale.customer.phoneNumber));

    return (
      <div className="flex items-center justify-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={hasValidPhone ? "Enviar por WhatsApp" : "Teléfono no válido"}
          onClick={() => handleWhatsApp(row)}
        >
          <MessageCircle
            className={cn(
              "h-4 w-4",
              sent.wa
                ? "text-green-600"
                : hasValidPhone
                  ? "text-muted-foreground/50"
                  : "text-muted-foreground/20",
            )}
          />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Ver / Imprimir PDF"
          disabled={isThisRowLoadingPdf}
          onClick={() => handlePrint(row)}
        >
          {isThisRowLoadingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Printer
              className={cn("h-4 w-4", sent.print ? "text-blue-600" : "text-muted-foreground/50")}
            />
          )}
        </Button>
      </div>
    );
  };

  const getActionButton = (row: TaxDocumentRow) => {
    const status = getRowStatus(row);

    switch (status) {
      case "SIN_EMITIR":
        return (
          <Button
            size="sm"
            className="bg-primary text-white hover:bg-primary/90"
            onClick={() => setEmitirRow(row)}
          >
            Gestionar
          </Button>
        );

      case "PENDING":
        return (
          <Button size="sm" disabled variant="secondary">
            Procesando
          </Button>
        );

      case "ACCEPTED":
      case "ACCEPTED_WITH_OBSERVATION":
        return (
          <Button size="sm" variant="outline" onClick={() => setDetalleRow(row)}>
            Ver / Compartir
          </Button>
        );

      case "REJECTED":
      case "RETRY_EXCEEDED":
        return (
          <Button size="sm" variant="destructive" onClick={() => setRechazadoRow(row)}>
            Resolver
          </Button>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileCheck className="h-4 w-4 text-green-600" />
              Emitidos Hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.emitidosHoy}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Boletas + facturas aceptadas hoy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-amber-500" />
              Pendientes de Envío
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.pendientes}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Ventas por regularizar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Rechazados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.rechazados}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4 text-primary" />
              Facturado este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {kpis.facturadoMes.toFixed(2)}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Boletas + Facturas aceptadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline */}
      <button
        type="button"
        onClick={() => setShowPipeline((value) => !value)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", showPipeline && "rotate-180")} />
        {showPipeline
          ? "Ocultar pipeline de facturación"
          : "Ver cómo funciona el pipeline de facturación"}
      </button>

      {showPipeline && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ciclo de vida de un comprobante</CardTitle>
            <CardDescription>
              Desde que una venta pasa a ENTREGADO hasta que SUNAT confirma su validez.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {PIPELINE_ORDER.map((status) => {
                const meta = TAX_DOCUMENT_STATUSES[status];

                return (
                  <div
                    key={status}
                    className="min-w-[160px] flex-1 rounded-lg border bg-muted/30 p-3"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wide">
                      {meta.label}
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      {meta.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contextual Bulk Action Toolbar */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary">
          <span>
            {selectedRows.length} seleccionado{selectedRows.length === 1 ? "" : "s"}
          </span>

          <div className="flex items-center gap-2">
            {/* Bulk Emission Button */}
            {selectedPendientes.length > 0 && (
              <Button
                size="sm"
                className="gap-1.5 bg-primary text-white hover:bg-primary/90"
                onClick={() => setLoteOpen(true)}
                disabled={isBulkActionPending}
              >
                <Zap className="h-3.5 w-3.5" />
                Emitir seleccionados ({selectedPendientes.length})
              </Button>
            )}

            {/* Bulk Print / Download Dropdown Menu */}
            {selectedEmitidos.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                    disabled={isBulkActionPending}
                  >
                    {isBulkActionPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Printer className="h-3.5 w-3.5" />
                    )}
                    Comprobantes ({selectedEmitidos.length})
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={handleBulkPrint}
                    disabled={isBulkActionPending}
                    className="gap-2 cursor-pointer"
                  >
                    <Printer className="h-4 w-4 text-primary" />
                    <span>Ver / Imprimir en PDF</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={handleBulkDownloadZip}
                    disabled={isBulkActionPending}
                    className="gap-2 cursor-pointer"
                  >
                    <Archive className="h-4 w-4 text-blue-600" />
                    <span>Descargar Lote (.ZIP)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {/* Documents table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <CardTitle>Ventas Entregadas</CardTitle>
              <CardDescription>
                Mostrando ventas listas para facturar y su estado ante SUNAT.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, correlativo, N° venta..."
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <Select
              value={filterEstado || "all"}
              onValueChange={(value) =>
                setFilterEstado(value === "all" ? "" : (value as TaxDocumentStatus))
              }
            >
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(TAX_DOCUMENT_STATUSES).map(([status, meta]) => (
                  <SelectItem key={status} value={status}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterTipo || "all"}
              onValueChange={(value) => setFilterTipo(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="03">Boleta</SelectItem>
                <SelectItem value="01">Factura</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={(value) => handleToggleSelectAll(!!value)}
                      disabled={filteredRows.length === 0}
                    />
                  </TableHead>

                  <TableHead>Fecha</TableHead>
                  <TableHead>Venta / ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Estado SUNAT</TableHead>
                  <TableHead className="text-center">Distribución</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center text-muted-foreground">
                      {loading
                        ? "Cargando ventas..."
                        : "No hay comprobantes que coincidan con el filtro"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const taxDocument = row.taxDocument;
                    const status = getRowStatus(row);

                    const displayedTotal = Number(
                      taxDocument?.taxDocumentPayload.totals.grandTotal ?? row.sale.grandTotal,
                    );

                    const documentNumber = getDocumentNumber(row);

                    return (
                      <TableRow key={row.sale.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(row.sale.id)}
                            onCheckedChange={(value) => toggleSelected(row.sale.id, !!value)}
                          />
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-xs">
                          {format(new Date(row.sale.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">{row.sale.orderNumber}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {documentNumber ?? `ID ${row.sale.id.substring(0, 8)}`}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">{row.sale.customer.fullName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {row.sale.customer.documentNumber || "Sin documento"}
                          </div>
                        </TableCell>

                        <TableCell>{getDocumentTypeBadge(taxDocument)}</TableCell>

                        <TableCell className="text-right font-bold">
                          S/ {displayedTotal.toFixed(2)}
                        </TableCell>

                        <TableCell className="text-center">{getStatusBadge(status)}</TableCell>

                        <TableCell className="text-center">{getDistributionIcons(row)}</TableCell>

                        <TableCell className="text-right">{getActionButton(row)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Mostrando {filteredRows.length} de {rows.length} comprobantes
          </div>
        </CardContent>
      </Card>

      {/* Emit document */}
      {emitirRow && (
        <EmitirComprobanteModal
          isOpen={!!emitirRow}
          onClose={() => setEmitirRow(null)}
          sale={emitirRow.sale}
          onEmissionFinished={() => refreshListDocuments()}
        />
      )}

      {/* Document detail */}
      <DetalleComprobanteModal
        isOpen={!!detalleRow}
        onClose={() => setDetalleRow(null)}
        row={detalleRow}
        onGenerarNota={(row) => {
          setDetalleRow(null);
          onGenerarNota(row);
        }}
        onAction={(saleId, type) =>
          setSentMap((previous) => ({
            ...previous,
            [saleId]: {
              ...previous[saleId],
              [type]: true,
            },
          }))
        }
      />

      {/* PDF preview modal */}
      <PdfPreviewDialog
        open={pdfPreview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPdfPreview(null);
          }
        }}
        file={pdfPreview}
        title={pdfPreview?.filename ?? undefined}
      />

      {/* Rejected document */}
      <RechazadoModal
        isOpen={!!rechazadoRow}
        onClose={() => setRechazadoRow(null)}
        row={rechazadoRow}
        onReintentar={(row) => setEmitirRow(row)}
      />

      {/* Bulk emission */}
      <LoteEmisionModal
        isOpen={loteOpen}
        onClose={() => setLoteOpen(false)}
        sales={selectedPendientes.map((row) => row.sale)}
        onEmissionFinished={() => {
          clearSelection();
          refreshListDocuments();
        }}
      />
    </div>
  );
}
