"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileCode2, FileDown, FileText, Plus, RefreshCw, Search, Send, Truck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import GreIssueDialog from "@/components/gre/GreIssueDialog";
import { GreModeBanner } from "@/components/gre/GreModeBanner";
import {
  downloadDespatchAdviceCdrApi,
  downloadDespatchAdviceXmlApi,
  refreshDespatchAdviceStatusApi,
  sendDespatchAdviceApi,
} from "@/features/sunat/despatch-advice/api/despatch-advice.api";
import { greKeys, useDespatchAdvices, useGreSettings } from "@/features/sunat/despatch-advice/hooks/use-despatch-advices";
import type {
  DespatchAdvice,
  DespatchAdviceStatus,
  DespatchTransferReason,
} from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import {
  GRE_MODE_LABEL,
  GRE_REASON_LABEL,
  GRE_STATUS_CLASS,
  GRE_STATUS_LABEL,
  greEmissionBlockReason,
  greErrorMessage,
  greLastErrorText,
  greRejectionText,
  isGreEligibleOrderStatus,
} from "@/features/sunat/despatch-advice/utils/gre-form";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { usePdfDownload } from "@/hooks/usePdfDownload";
import { type DespatchAdviceIssuer, despatchAdvicePdfSpec } from "@/lib/pdf/despatchAdvice";
import { downloadFile } from "@/utils/http/download-file";

// FEAT-24 H12 — Facturación › Guías de remisión, real (reemplaza el mock en
// memoria, H12-D6): lista de las GRE de la empresa con su estado SUNAT,
// consultar el estado o el CDR, reenviar las pendientes, descargar XML, CDR y
// PDF, filtros por fecha, estado y motivo; y emitir una guía desde un pedido.

const PAGE_SIZE = 20;
const STATUSES: DespatchAdviceStatus[] = ["PENDING", "SENT", "ACCEPTED", "ACCEPTED_WITH_OBSERVATION", "REJECTED"];
const SELECT_CLASS = "h-9 rounded-md border border-input bg-background px-2 text-sm";

interface GuiasTabProps {
  comprobanteRows: TaxDocumentRow[];
  /**
   * Emisor de la guía impresa: el RUC elegido en la barra «RUC emisor» (con un solo RUC, ese RUC).
   * Sin emisor no se imprime la guía (multi-RUC, «Todos los RUC»).
   */
  issuer?: DespatchAdviceIssuer;
}

const day = (value: string) => {
  const [year, month, date] = value.split("-");
  return year && month && date ? `${date}/${month}/${year}` : value;
};

export function GuiasTab({ comprobanteRows, issuer }: GuiasTabProps) {
  const queryClient = useQueryClient();
  const downloadPdf = usePdfDownload();
  const settingsQuery = useGreSettings();
  const settings = settingsQuery.data;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<DespatchAdviceStatus | "">("");
  const [reason, setReason] = useState<DespatchTransferReason | "">("");
  const [page, setPage] = useState(1);
  const [picking, setPicking] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rangeProblem = dateFrom && dateTo && dateFrom > dateTo ? "La fecha «desde» no puede ser posterior a «hasta»." : null;
  const query = useDespatchAdvices(
    {
      ...(status ? { status } : {}),
      ...(reason ? { transferReason: reason } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      page,
      pageSize: PAGE_SIZE,
    },
    !rangeProblem,
  );
  const rows = query.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));
  const blockReason = greEmissionBlockReason(settings);

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const refresh = () => void queryClient.invalidateQueries({ queryKey: greKeys.lists() });

  const checkStatus = useMutation({
    mutationFn: (advice: DespatchAdvice) => refreshDespatchAdviceStatusApi(advice.id),
    onMutate: (advice) => setBusyId(advice.id),
    onSuccess: (advice) => {
      if (advice.status === "SENT") toast.info(`${advice.number}: SUNAT todavía la está procesando. Vuelve a consultar en unos minutos.`);
      else toast.success(`${advice.number}: ${GRE_STATUS_LABEL[advice.status].toLowerCase()}`);
      refresh();
    },
    onError: (error) => toast.error(greErrorMessage(error, "No se pudo consultar el estado.")),
    onSettled: () => setBusyId(null),
  });

  const resend = useMutation({
    mutationFn: (advice: DespatchAdvice) => sendDespatchAdviceApi(advice.id),
    onMutate: (advice) => setBusyId(advice.id),
    onSuccess: (advice) => {
      if (advice.status === "PENDING") toast.error(`${advice.number} sigue pendiente. ${greLastErrorText(advice.lastError) ?? ""}`.trim());
      else toast.success(`${advice.number}: ${GRE_STATUS_LABEL[advice.status].toLowerCase()}`);
      refresh();
    },
    onError: (error) => toast.error(greErrorMessage(error, "No se pudo reenviar la guía.")),
    onSettled: () => setBusyId(null),
  });

  const downloadSunatFile = async (advice: DespatchAdvice, file: "xml" | "cdr") => {
    try {
      const result = await (file === "xml" ? downloadDespatchAdviceXmlApi(advice.id) : downloadDespatchAdviceCdrApi(advice.id));
      downloadFile({ blob: result.blob, filename: result.filename ?? `${advice.rucIssuer}-09-${advice.number}.${file === "xml" ? "xml" : "zip"}` });
    } catch (error) {
      toast.error(greErrorMessage(error, file === "xml" ? "No se pudo descargar el XML." : "No se pudo descargar el CDR."));
    }
  };

  const downloadGrePdf = async (advice: DespatchAdvice) => {
    // Sin ningún RUC activo no se imprime (#310, #314): el PDF no adivina el RUC.
    if (!issuer) {
      toast.error("Agrega un RUC emisor en la pestaña Emisores (RUC) para imprimir la guía");
      return;
    }
    // Multi-RUC: el encabezado no puede ser de otro RUC que el de la guía.
    if (issuer.ruc !== advice.rucIssuer) {
      toast.error(`La guía ${advice.number} es del RUC ${advice.rucIssuer}. Para imprimirla, elige ese RUC en el filtro «RUC emisor».`);
      return;
    }
    try {
      let qrDataUrl: string | null = null;
      if (advice.qrUrl) {
        const QRCode = await import("qrcode");
        qrDataUrl = await QRCode.toDataURL(advice.qrUrl, { margin: 1, width: 256 });
      }
      await downloadPdf(despatchAdvicePdfSpec(advice, { issuer, qrDataUrl }));
    } catch {
      toast.error("No se pudo generar el PDF de la guía.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-bold">Guías de Remisión Electrónica</h2>
          <p className="text-sm text-muted-foreground">
            GRE remitente: sustenta el traslado de mercadería desde tu almacén hasta el cliente (motivo 01) o entre tus almacenes (motivo 04, desde
            Inventario › Traslados).
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setPicking(true)} disabled={Boolean(blockReason)} title={blockReason ?? undefined}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Emitir guía de remisión
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <span className="font-semibold">Se emite ANTES de que el paquete salga del almacén. </span>
          No al momento de la entrega. SUNAT sanciona su omisión desde el 1 de julio de 2026.
        </div>
      </div>

      <GreModeBanner settings={settings} />
      {settingsQuery.isError ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          No se pudo cargar la configuración de guías de remisión.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Guías emitidas</CardTitle>
          <CardDescription>
            {query.data ? `${query.data.total} guía(s)` : "Las guías del RUC o los RUC de tu empresa"}. El estado se actualiza al consultarlo: SUNAT contesta por ticket.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Desde
              <Input type="date" aria-label="Desde" className="h-9 w-40" value={dateFrom} onChange={(event) => resetPage(setDateFrom)(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Hasta
              <Input type="date" aria-label="Hasta" className="h-9 w-40" value={dateTo} onChange={(event) => resetPage(setDateTo)(event.target.value)} />
            </label>
            <select aria-label="Estado" className={`${SELECT_CLASS} w-52`} value={status} onChange={(event) => resetPage(setStatus)(event.target.value as DespatchAdviceStatus | "")}>
              <option value="">Todos los estados</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {GRE_STATUS_LABEL[value]}
                </option>
              ))}
            </select>
            <select aria-label="Motivo" className={`${SELECT_CLASS} w-60`} value={reason} onChange={(event) => resetPage(setReason)(event.target.value as DespatchTransferReason | "")}>
              <option value="">Todos los motivos</option>
              <option value="01">01 · {GRE_REASON_LABEL["01"]}</option>
              <option value="04">04 · {GRE_REASON_LABEL["04"]}</option>
            </select>
            <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={refresh} disabled={query.isFetching}>
              <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden="true" /> Actualizar
            </Button>
          </div>
          {rangeProblem ? <p className="text-xs text-destructive">{rangeProblem}</p> : null}
          {query.isError ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              No se pudieron cargar las guías de remisión.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Estado SUNAT</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isPending && !rangeProblem ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Cargando guías…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      <Truck className="mx-auto mb-2 h-6 w-6 opacity-40" aria-hidden="true" />
                      No hay guías de remisión con estos filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((advice) => {
                    const busy = busyId === advice.id;
                    const detail =
                      advice.status === "REJECTED"
                        ? greRejectionText(advice.sunatCode, advice.sunatDescription)
                        : advice.status === "PENDING"
                          ? greLastErrorText(advice.lastError)
                          : advice.status === "ACCEPTED_WITH_OBSERVATION" && advice.observations.length
                            ? advice.observations.join(" · ")
                            : null;
                    return (
                      <TableRow key={advice.id} data-testid={`gre-${advice.number}`}>
                        <TableCell className="whitespace-nowrap text-xs">{day(advice.issueDate)}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs font-semibold">{advice.number}</TableCell>
                        <TableCell className="text-xs">
                          {advice.externalReference ?? "—"}
                          {advice.payload.recipient?.name ? <div className="text-[11px] text-muted-foreground">{advice.payload.recipient.name}</div> : null}
                        </TableCell>
                        <TableCell className="text-xs">
                          {advice.transferReason} · {GRE_REASON_LABEL[advice.transferReason]}
                          <div className="text-[11px] text-muted-foreground">{GRE_MODE_LABEL[advice.transportMode]}</div>
                        </TableCell>
                        <TableCell className="max-w-[16rem] text-xs">{advice.payload.destination?.address ?? "—"}</TableCell>
                        <TableCell className="min-w-[14rem] max-w-[16rem] whitespace-normal">
                          <Badge variant="outline" className={`border-transparent font-semibold ${GRE_STATUS_CLASS[advice.status]}`}>
                            {GRE_STATUS_LABEL[advice.status]}
                          </Badge>
                          {detail ? <p className="mt-1 whitespace-normal break-words text-[11px] leading-snug text-muted-foreground">{detail}</p> : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {advice.status === "SENT" ? (
                              <Button type="button" size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => checkStatus.mutate(advice)}>
                                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Consultar estado
                              </Button>
                            ) : null}
                            {advice.status === "PENDING" ? (
                              <Button type="button" size="sm" variant="outline" className="h-8 gap-1" disabled={busy || Boolean(blockReason)} onClick={() => resend.mutate(advice)}>
                                <Send className="h-3.5 w-3.5" aria-hidden="true" /> Reenviar
                              </Button>
                            ) : null}
                            {advice.hasSignedXml ? (
                              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1" aria-label={`XML de ${advice.number}`} onClick={() => void downloadSunatFile(advice, "xml")}>
                                <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" /> XML
                              </Button>
                            ) : null}
                            {advice.hasCdr ? (
                              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1" aria-label={`CDR de ${advice.number}`} onClick={() => void downloadSunatFile(advice, "cdr")}>
                                <FileDown className="h-3.5 w-3.5" aria-hidden="true" /> CDR
                              </Button>
                            ) : null}
                            <Button type="button" size="sm" variant="ghost" className="h-8 gap-1" aria-label={`PDF de ${advice.number}`} onClick={() => void downloadGrePdf(advice)}>
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" /> PDF
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Anterior
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                Siguiente
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {picking ? (
        <GreOrderPicker
          rows={comprobanteRows}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPicking(false);
            setOrderId(id);
          }}
        />
      ) : null}

      {orderId ? <GreIssueDialog source={{ kind: "order", orderId }} onClose={() => setOrderId(null)} /> : null}
    </div>
  );
}

function GreOrderPicker({ rows, onClose, onPick }: { rows: TaxDocumentRow[]; onClose: () => void; onPick: (orderId: string) => void }) {
  const [search, setSearch] = useState("");
  const orders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .map((row) => row.sale)
      .filter((sale) => isGreEligibleOrderStatus(sale.status))
      .filter(
        (sale) =>
          !term ||
          sale.orderNumber?.toLowerCase().includes(term) ||
          sale.customer?.fullName?.toLowerCase().includes(term) ||
          sale.externalOrderNumber?.toLowerCase().includes(term),
      )
      .slice(0, 50);
  }, [rows, search]);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>¿Para qué pedido es la guía?</DialogTitle>
          <DialogDescription>Pedidos preparados o en camino. Para un traslado entre almacenes, emítela desde Inventario › Traslados.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Buscar pedido" placeholder="Buscar por pedido o cliente…" className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          {orders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No hay pedidos preparados o en camino con esa búsqueda.</p>
          ) : (
            <ul>
              {orders.map((sale) => (
                <li key={sale.id} className="border-b last:border-0">
                  <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50" onClick={() => onPick(sale.id)}>
                    <span>
                      <span className="font-semibold">{sale.orderNumber}</span>
                      <span className="ml-2 text-muted-foreground">{sale.customer?.fullName}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{sale.customer?.district || sale.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
