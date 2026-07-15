"use client";

import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EstadoBadge } from "@/app/facturacion/components/EstadoBadge";
import { ESTADOS_COMPROBANTE, EstadoComprobante } from "@/types/facturacion";
import { ComprobanteRow, useComprobantesSunat } from "@/hooks/useComprobantesSunat";
import EmitirComprobanteModal from "@/app/facturacion/components/modals/EmitirComprobanteModal";
import DetalleComprobanteModal from "@/app/facturacion/components/modals/DetalleComprobanteModal";
import RechazadoModal from "@/app/facturacion/components/modals/RechazadoModal";
import LoteEmisionModal from "@/app/facturacion/components/modals/LoteEmisionModal";

const PIPELINE_ORDER: EstadoComprobante[] = [
  "SIN_EMITIR",
  "PENDIENTE_FIRMA",
  "ENVIADO_OSE",
  "ACEPTADO",
  "RECHAZADO",
  "BAJA",
];

interface ComprobantesTabProps {
  comprobantes: ReturnType<typeof useComprobantesSunat>;
  onGenerarNota: (row: ComprobanteRow) => void;
}

export function ComprobantesTab({ comprobantes, onGenerarNota }: ComprobantesTabProps) {
  const {
    rows,
    loading,
    kpis,
    selectedIds,
    emitInvoice,
    refreshLog,
    fetchSales,
    toggleSelected,
    selectAllPendientes,
    clearSelection,
  } = comprobantes;

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("");
  const [filterTipo, setFilterTipo] = useState<string>("");
  const [showPipeline, setShowPipeline] = useState(false);
  const [sentMap, setSentMap] = useState<Record<string, { wa?: boolean; print?: boolean }>>({});

  const [emitirRow, setEmitirRow] = useState<ComprobanteRow | null>(null);
  const [detalleRow, setDetalleRow] = useState<ComprobanteRow | null>(null);
  const [rechazadoRow, setRechazadoRow] = useState<ComprobanteRow | null>(null);
  const [loteOpen, setLoteOpen] = useState(false);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterEstado && r.estado !== filterEstado) return false;
      if (filterTipo && r.tipo !== filterTipo) return false;
      if (q) {
        const hay = `${r.sale.customer.fullName} ${r.sale.orderNumber} ${r.fullNumber || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, filterEstado, filterTipo]);

  const selectedRows = rows.filter((r) => selectedIds.has(r.sale.id));
  const pendientesVisibles = filteredRows.filter((r) => r.estado === "SIN_EMITIR");
  const allPendientesSelected =
    pendientesVisibles.length > 0 && pendientesVisibles.every((r) => selectedIds.has(r.sale.id));

  const tipoChip = (row: ComprobanteRow) => {
    if (row.tipo === "03") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300">Boleta B001</Badge>;
    if (row.tipo === "01") return <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Factura F001</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">Sin definir</Badge>;
  };

  const distribIcons = (row: ComprobanteRow) => {
    if (row.estado !== "ACEPTADO" && row.estado !== "ACEPTADO_CON_OBS") {
      return <span className="text-muted-foreground text-xs">—</span>;
    }
    const sent = sentMap[row.sale.id] || {};
    return (
      <div className="flex items-center gap-1.5">
        <MessageCircle className={cn("h-4 w-4", sent.wa ? "text-green-600" : "text-muted-foreground/30")} />
        <Printer className={cn("h-4 w-4", sent.print ? "text-blue-600" : "text-muted-foreground/30")} />
      </div>
    );
  };

  const accionBtn = (row: ComprobanteRow) => {
    switch (row.estado) {
      case "SIN_EMITIR":
        return (
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-white" onClick={() => setEmitirRow(row)}>
            Gestionar
          </Button>
        );
      case "PENDIENTE_FIRMA":
      case "ENVIADO_OSE":
        return (
          <Button size="sm" disabled variant="secondary">
            Procesando
          </Button>
        );
      case "ACEPTADO":
      case "ACEPTADO_CON_OBS":
        return (
          <Button size="sm" variant="outline" onClick={() => setDetalleRow(row)}>
            Ver / Compartir
          </Button>
        );
      case "RECHAZADO":
        return (
          <Button size="sm" variant="destructive" onClick={() => setRechazadoRow(row)}>
            Resolver
          </Button>
        );
      default:
        return (
          <Button size="sm" variant="outline" onClick={() => setDetalleRow(row)}>
            Ver detalle
          </Button>
        );
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-green-600" /> Emitidos Hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.emitidosHoy}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Boletas + facturas aceptadas hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Pendientes de Envío
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.pendientes}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Ventas por regularizar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" /> Rechazados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.rechazados}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Requieren atención</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Facturado este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {kpis.facturadoMes.toFixed(2)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Boletas + Facturas aceptadas</p>
          </CardContent>
        </Card>
      </div>

      <button
        type="button"
        onClick={() => setShowPipeline((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", showPipeline && "rotate-180")} />
        {showPipeline ? "Ocultar pipeline de facturación" : "Ver cómo funciona el pipeline de facturación"}
      </button>

      {showPipeline && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ciclo de vida de un comprobante</CardTitle>
            <CardDescription>Desde que una venta pasa a ENTREGADO hasta que SUNAT confirma su validez.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {PIPELINE_ORDER.map((key) => {
                const meta = ESTADOS_COMPROBANTE[key];
                return (
                  <div key={key} className="min-w-[160px] flex-1 rounded-lg border bg-muted/30 p-3">
                    <div className="text-[11px] font-bold tracking-wide uppercase">{meta.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{meta.description}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedRows.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary">
          <span>{selectedRows.length} seleccionado{selectedRows.length === 1 ? "" : "s"}</span>
          <Button size="sm" className="ml-auto bg-primary hover:bg-primary/90 text-white gap-1.5" onClick={() => setLoteOpen(true)}>
            <Zap className="h-3.5 w-3.5" /> Emitir seleccionados
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Ventas Entregadas</CardTitle>
              <CardDescription>Mostrando ventas listas para facturar y su estado ante SUNAT.</CardDescription>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, correlativo, N° venta..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterEstado || "all"} onValueChange={(v) => setFilterEstado(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(ESTADOS_COMPROBANTE).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTipo || "all"} onValueChange={(v) => setFilterTipo(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="03">Boleta (B001)</SelectItem>
                <SelectItem value="01">Factura (F001)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allPendientesSelected}
                      onCheckedChange={(v) => selectAllPendientes(!!v)}
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
                    <TableCell colSpan={9} className="text-center h-40 text-muted-foreground">
                      {loading ? "Cargando ventas..." : "No hay comprobantes que coincidan con el filtro"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.sale.id}>
                      <TableCell>
                        {row.estado === "SIN_EMITIR" && (
                          <Checkbox
                            checked={selectedIds.has(row.sale.id)}
                            onCheckedChange={(v) => toggleSelected(row.sale.id, !!v)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(row.sale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.sale.orderNumber}</div>
                        <div className="text-[10px] text-muted-foreground">{row.fullNumber || `ID ${row.sale.id.substring(0, 8)}`}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.sale.customer.fullName}</div>
                        <div className="text-[10px] text-muted-foreground">{row.sale.customer.documentNumber || "Sin documento"}</div>
                      </TableCell>
                      <TableCell>{tipoChip(row)}</TableCell>
                      <TableCell className="text-right font-bold">S/ {Number(row.sale.grandTotal).toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <EstadoBadge estado={row.estado} />
                      </TableCell>
                      <TableCell className="text-center">{distribIcons(row)}</TableCell>
                      <TableCell className="text-right">{accionBtn(row)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="text-xs text-muted-foreground mt-3">
            Mostrando {filteredRows.length} de {rows.length} comprobantes
          </div>
        </CardContent>
      </Card>

      {emitirRow && (
        <EmitirComprobanteModal
          isOpen={!!emitirRow}
          onClose={() => setEmitirRow(null)}
          sale={emitirRow.sale}
          onSuccess={() => refreshLog(emitirRow.sale.id)}
        />
      )}

      <DetalleComprobanteModal
        isOpen={!!detalleRow}
        onClose={() => setDetalleRow(null)}
        row={detalleRow}
        onGenerarNota={(row) => {
          setDetalleRow(null);
          onGenerarNota(row);
        }}
        onAction={(saleId, type) =>
          setSentMap((prev) => ({ ...prev, [saleId]: { ...prev[saleId], [type]: true } }))
        }
      />

      <RechazadoModal
        isOpen={!!rechazadoRow}
        onClose={() => setRechazadoRow(null)}
        row={rechazadoRow}
        onReintentar={(row) => setEmitirRow(row)}
      />

      <LoteEmisionModal
        isOpen={loteOpen}
        onClose={() => setLoteOpen(false)}
        rows={selectedRows}
        emitInvoice={emitInvoice}
        onDone={() => {
          clearSelection();
          fetchSales();
        }}
      />
    </div>
  );
}
