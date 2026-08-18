"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  ChevronDown,
  Clock,
  DollarSign,
  FileCheck,
  MessageCircle,
  Printer,
  Search,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import DetalleComprobanteModal from "@/app/facturacion/components/modals/DetalleComprobanteModal";
import EmitirComprobanteModal from "@/app/facturacion/components/modals/EmitirComprobanteModal";
import LoteEmisionModal from "@/app/facturacion/components/modals/LoteEmisionModal";
import RechazadoModal from "@/app/facturacion/components/modals/RechazadoModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

import type { SunatDocumentCdrStatus } from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import type { TaxDocumentRow, useTaxDocuments } from "@/hooks/useTaxDocuments";

import { cn } from "@/lib/utils";

type TaxDocumentStatus = SunatDocumentCdrStatus | "SIN_EMITIR";

const PIPELINE_ORDER: TaxDocumentStatus[] = [
  "SIN_EMITIR",
  "PENDING",
  "ACCEPTED",
  "ACCEPTED_WITH_OBSERVATION",
  "REJECTED",
  "RETRY_EXCEEDED",
];

const STATUS_META: Record<
  TaxDocumentStatus,
  {
    label: string;
    description: string;
  }
> = {
  SIN_EMITIR: {
    label: "Sin emitir",
    description: "La venta todavía no tiene un documento SUNAT.",
  },
  PENDING: {
    label: "Pendiente",
    description: "El documento está siendo procesado por SUNAT/OSE.",
  },
  ACCEPTED: {
    label: "Aceptado",
    description: "SUNAT/OSE aceptó el comprobante.",
  },
  ACCEPTED_WITH_OBSERVATION: {
    label: "Aceptado con observación",
    description: "El comprobante fue aceptado pero contiene observaciones.",
  },
  REJECTED: {
    label: "Rechazado",
    description: "SUNAT/OSE rechazó el comprobante.",
  },
  RETRY_EXCEEDED: {
    label: "Reintentos agotados",
    description: "El documento agotó los intentos de procesamiento.",
  },
};

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
  switch (status) {
    case "ACCEPTED":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300">
          Aceptado
        </Badge>
      );

    case "ACCEPTED_WITH_OBSERVATION":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300">
          Aceptado con obs.
        </Badge>
      );

    case "PENDING":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300">
          Pendiente
        </Badge>
      );

    case "REJECTED":
      return <Badge variant="destructive">Rechazado</Badge>;

    case "RETRY_EXCEEDED":
      return <Badge variant="destructive">Reintentos agotados</Badge>;

    case "SIN_EMITIR":
    default:
      return <Badge variant="outline">Sin emitir</Badge>;
  }
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
    selectAllPending,
    clearSelection,
  } = comprobantes;

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<TaxDocumentStatus | "">("");
  const [filterTipo, setFilterTipo] = useState("");
  const [showPipeline, setShowPipeline] = useState(false);

  const [sentMap, setSentMap] = useState<
    Record<
      string,
      {
        wa?: boolean;
        print?: boolean;
      }
    >
  >({});

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

  const pendientesVisibles = filteredRows.filter((row) => !row.taxDocument);

  const allPendientesSelected =
    pendientesVisibles.length > 0 &&
    pendientesVisibles.every((row) => selectedIds.has(row.sale.id));

  const getDistributionIcons = (row: TaxDocumentRow) => {
    const status = getRowStatus(row);

    if (!isAcceptedStatus(status)) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }

    const sent = sentMap[row.sale.id] ?? {};

    return (
      <div className="flex items-center justify-center gap-1.5">
        <MessageCircle
          className={cn("h-4 w-4", sent.wa ? "text-green-600" : "text-muted-foreground/30")}
        />

        <Printer
          className={cn("h-4 w-4", sent.print ? "text-blue-600" : "text-muted-foreground/30")}
        />
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
                const meta = STATUS_META[status];

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

      {/* Selection */}
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary">
          <span>
            {selectedRows.length} seleccionado
            {selectedRows.length === 1 ? "" : "s"}
          </span>

          <Button
            size="sm"
            className="ml-auto gap-1.5 bg-primary text-white hover:bg-primary/90"
            onClick={() => setLoteOpen(true)}
          >
            <Zap className="h-3.5 w-3.5" />
            Emitir seleccionados
          </Button>
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

                {Object.entries(STATUS_META).map(([status, meta]) => (
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
                      checked={allPendientesSelected}
                      onCheckedChange={(value) => selectAllPending(!!value)}
                      disabled={pendientesVisibles.length === 0}
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
                          {!taxDocument && (
                            <Checkbox
                              checked={selectedIds.has(row.sale.id)}
                              onCheckedChange={(value) => toggleSelected(row.sale.id, !!value)}
                            />
                          )}
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
          onEmissionFinished={() => {
            refreshListDocuments();
          }}
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
        rows={selectedRows}
        onDone={() => {
          clearSelection();
          refreshListDocuments();
        }}
      />
    </div>
  );
}
