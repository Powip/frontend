"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePdfDownload, useReportAuthor } from "@/hooks/usePdfDownload";
import { closePeriod, getPeriodClose, listPeriodCloses, reopenPeriod, type PeriodClose } from "@/services/inventoryReportsService";
import { trackingError } from "@/services/inventoryTrackingService";
import { formatMoney, isCompanyAdminRole } from "@/lib/purchaseOrders";
import { formatVariantLabel } from "@/lib/variantAttributes";
import { periodClosePdfSpec } from "@/lib/pdf/documents";
import { downloadWorkbook } from "@/lib/reports/excel";
import { closableFromText, PERIOD_KIND_LABEL, periodCloseWorkbook, periodRows, reopenReasonError, REOPEN_REASON_MAX, type PeriodRow } from "@/lib/reports/periodClose";
import { periodLabel } from "@/lib/reports/periods";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// FEAT-24 H10-D6 — Inventario › Cierre mensual (mockup vCierre): la lista de
// meses con su estado, cerrar el próximo mes y reabrir el último (solo el
// Administrador, con confirmación y motivo), la foto del cierre y su PDF y Excel.

const KIND_CLASS: Record<PeriodRow["kind"], string> = {
  cerrado: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300",
  reabierto: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  por_cerrar: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  en_curso: "border-slate-200 bg-transparent text-muted-foreground",
};

const errorText = (error: unknown, fallback: string) => trackingError(error, fallback);

function CloseDialog({ period, again, onClose }: { period: string; again: boolean; onClose: () => void }) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () => closePeriod(period),
    onSuccess: () => {
      toast.success(`${periodLabel(period)} quedó cerrado.`);
      void queryClient.invalidateQueries({ queryKey: ["period-closes", auth?.company?.id] });
      onClose();
    },
    onError: (failure) => setError(errorText(failure, "No se pudo cerrar el mes.")),
  });
  return (
    <Dialog open onOpenChange={(open) => (!open && !run.isPending ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{again ? "Cerrar de nuevo" : "Cerrar"} {periodLabel(period)}</DialogTitle>
          <DialogDescription>
            Se guarda la foto del stock y del valor al último día del mes. Después, las operaciones con fecha de {periodLabel(period)} (compras, recepciones, ajustes, traslados y anulaciones) quedan bloqueadas: cualquier corrección entra como ajuste en el mes abierto.
          </DialogDescription>
        </DialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={run.isPending} onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            Cerrar {periodLabel(period)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReopenDialog({ period, onClose }: { period: string; onClose: () => void }) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validation = reopenReasonError(reason);
  const run = useMutation({
    mutationFn: () => reopenPeriod(period, reason.trim()),
    onSuccess: () => {
      toast.success(`${periodLabel(period)} quedó reabierto.`);
      void queryClient.invalidateQueries({ queryKey: ["period-closes", auth?.company?.id] });
      onClose();
    },
    onError: (failure) => setError(errorText(failure, "No se pudo reabrir el mes.")),
  });
  return (
    <Dialog open onOpenChange={(open) => (!open && !run.isPending ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reabrir {periodLabel(period)}</DialogTitle>
          <DialogDescription>
            Vuelve a permitir operaciones con fecha de ese mes. La foto del cierre se conserva hasta que lo cierres de nuevo. El motivo queda registrado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reopen-reason">Motivo de la reapertura</Label>
          <Textarea id="reopen-reason" maxLength={REOPEN_REASON_MAX} value={reason} onBlur={() => setTouched(true)} onChange={(event) => setReason(event.target.value)} placeholder="Por ejemplo: faltó registrar una compra del 28" />
          {touched && validation ? <p className="text-xs text-destructive">{validation}</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={run.isPending} onClick={onClose}>Cancelar</Button>
          <Button type="button" variant="destructive" disabled={!!validation || run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reabrir {periodLabel(period)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SnapshotDialog({ close, onClose }: { close: PeriodClose; onClose: () => void }) {
  const { auth } = useAuth();
  const detail = useQuery({
    queryKey: ["period-close", auth?.company?.id, close.period],
    queryFn: ({ signal }) => getPeriodClose(close.period, signal),
    retry: false,
  });
  const showValues = detail.data ? "totalValue" in detail.data : false;
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Foto del cierre · {periodLabel(close.period)}</DialogTitle>
          <DialogDescription>Stock y valor al último instante del mes, por almacén y variante.</DialogDescription>
        </DialogHeader>
        {detail.error ? <p role="alert" className="text-sm text-destructive">{errorText(detail.error, "No se pudo leer la foto del cierre.")}</p> : null}
        {detail.isPending ? <p role="status" className="text-sm text-muted-foreground">Cargando…</p> : null}
        {detail.data ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Almacén</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Físico</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  {showValues ? <TableHead className="text-right">Costo prom.</TableHead> : null}
                  {showValues ? <TableHead className="text-right">Valor</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.data.items.length === 0 ? (
                  <TableRow><TableCell colSpan={showValues ? 7 : 5} className="text-center text-muted-foreground">El cierre no tiene stock.</TableCell></TableRow>
                ) : detail.data.items.map((item) => (
                  <TableRow key={`${item.inventoryId}:${item.variantId}`}>
                    <TableCell>{item.inventoryName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{item.sku ?? "—"}</TableCell>
                    <TableCell>{[item.productName || "Variante fuera del catálogo", formatVariantLabel(item.attributes)].filter(Boolean).join(" · ")}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.physical}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.reserved}</TableCell>
                    {showValues ? <TableCell className="text-right tabular-nums">{formatMoney(item.averageCost ?? null, 4)}</TableCell> : null}
                    {showValues ? <TableCell className="text-right tabular-nums">{formatMoney(item.value ?? null)}</TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PeriodCloseTab() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const isAdmin = isCompanyAdminRole(auth?.user?.role);
  const author = useReportAuthor();
  const downloadPdf = usePdfDownload();
  const [closing, setClosing] = useState<{ period: string; again: boolean } | null>(null);
  const [reopening, setReopening] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PeriodClose | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["period-closes", companyId],
    queryFn: ({ signal }) => listPeriodCloses(signal),
    enabled: Boolean(companyId && auth?.accessToken),
    retry: false,
  });
  const rows = list.data ? periodRows(list.data) : [];

  const exportClose = async (close: PeriodClose, kind: "excel" | "pdf") => {
    setBusy(`${close.period}:${kind}`);
    try {
      const detail = await getPeriodClose(close.period);
      if (kind === "excel") await downloadWorkbook(periodCloseWorkbook(detail, { generatedBy: author }), `cierre-${close.period}`);
      else await downloadPdf(periodClosePdfSpec(detail));
    } catch (error) {
      toast.error(errorText(error, `No se pudo descargar el ${kind === "excel" ? "Excel" : "PDF"} del cierre.`));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Cierre mensual</h3>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Guarda una foto del stock y del valor al último día del mes. Después del cierre, los movimientos con fecha de ese mes no se pueden crear ni editar; cualquier corrección entra como ajuste en el mes abierto. Es lo que pide el contador.
        </p>
      </div>

      {list.error ? (
        <div role="alert" className="rounded border border-destructive p-4 text-sm">
          {errorText(list.error, "No se pudieron cargar los cierres.")}{" "}
          <Button variant="outline" size="sm" onClick={() => void list.refetch()}>Reintentar</Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Mes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cerrado el</TableHead>
              <TableHead>Por</TableHead>
              <TableHead className="text-right">SKU</TableHead>
              <TableHead className="text-right">Valor del inventario</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isPending && list.fetchStatus !== "idle" ? (
              <TableRow><TableCell colSpan={7} className="text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : rows.length === 0 && !list.error ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Todavía no hay meses para cerrar.</TableCell></TableRow>
            ) : rows.map((row) => {
              const close = row.close;
              return (
                <TableRow key={row.period}>
                  <TableCell className="font-semibold">{periodLabel(row.period)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("gap-1", KIND_CLASS[row.kind])}>
                      {row.kind === "cerrado" ? <Lock className="h-3 w-3" /> : null}
                      {PERIOD_KIND_LABEL[row.kind]}
                    </Badge>
                    {row.kind === "reabierto" && close?.reopenReason ? (
                      <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">Reabierto por {close.reopenedByName || close.reopenedBy || "—"}: {close.reopenReason}</p>
                    ) : null}
                    {row.kind === "en_curso" ? <p className="mt-1 text-xs text-muted-foreground">{closableFromText(row.period)}</p> : null}
                  </TableCell>
                  <TableCell className="text-sm">{close?.closedAt ? formatPeruDateTime(close.closedAt) : "—"}</TableCell>
                  <TableCell className="text-sm">{close ? close.closedByName || close.closedBy || "—" : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{close ? close.itemsCount : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{close ? formatMoney("totalValue" in close ? close.totalValue ?? null : undefined) : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      {close ? (
                        <>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setViewing(close)}>Ver foto</Button>
                          <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => void exportClose(close, "excel")} aria-label={`Excel del cierre de ${periodLabel(row.period)}`}>
                            <Download className="mr-1 h-4 w-4" />Excel
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => void exportClose(close, "pdf")} aria-label={`PDF del cierre de ${periodLabel(row.period)}`}>
                            <FileText className="mr-1 h-4 w-4" />PDF
                          </Button>
                        </>
                      ) : null}
                      {isAdmin && row.canReopen ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setReopening(row.period)}>Reabrir</Button>
                      ) : null}
                      {isAdmin && row.canClose ? (
                        <Button type="button" size="sm" onClick={() => setClosing({ period: row.period, again: row.kind === "reabierto" })}>
                          <Lock className="mr-1 h-4 w-4" />
                          {row.kind === "reabierto" ? "Cerrar de nuevo" : `Cerrar ${periodLabel(row.period).split(" ")[0].toLowerCase()}`}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {!isAdmin ? <p className="text-xs text-muted-foreground">Solo el Administrador puede cerrar o reabrir un mes.</p> : null}

      {closing ? <CloseDialog period={closing.period} again={closing.again} onClose={() => setClosing(null)} /> : null}
      {reopening ? <ReopenDialog period={reopening} onClose={() => setReopening(null)} /> : null}
      {viewing ? <SnapshotDialog close={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}
