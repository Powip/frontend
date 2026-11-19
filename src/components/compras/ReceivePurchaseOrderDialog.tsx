"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Info, Plus, ScanBarcode, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { playErrorBeep } from "@/lib/errorBeep";
import type { WriteResult } from "@/lib/offlineQueue";
import { isNetworkError } from "@/lib/offlineStore";
import { LOT_COMMENT_MAX, LOT_NUMBER_MAX, isLotReceiveConflict, lotWriteErrorMessage } from "@/lib/lots";
import { useLotTrackedVariants, type LotTracking } from "@/hooks/useLotTrackedVariants";
import {
  addOneToLine,
  addReceiveLot,
  applyLotTracking,
  buildReceiveLines,
  fillPending,
  httpStatus,
  newOperationId,
  PURCHASE_STATUS_LABEL,
  receiveDraft,
  receiveDraftValid,
  receiveLineProblem,
  receiveScanMessage,
  receiveTotal,
  removeReceiveLot,
  resolveReceiveScan,
  setReceiveLot,
  setReceiveQuantity,
  type ReceiveDraftLine,
} from "@/lib/purchaseOrders";
import {
  receivePurchaseOrder,
  type PurchaseOrder,
  type ReceivePurchaseOrderBody,
  type ReceivePurchaseOrderResult,
} from "@/services/purchasesService";
import { lookupVariantsByCodes, type VariantCodeMatch } from "@/services/variantCodesService";
import { Money } from "./PurchaseBits";

// FEAT-24 H3-E (H3-D11) — recibir una orden de compra, en partes o completa:
// por línea, cuántas unidades llegan ahora, sin pasar de lo pendiente (el
// servidor también lo rechaza con 409). Acepta el lector USB: cada escaneo suma
// 1 a la línea de esa variante.
//
// El modo almacén (/almacen) usa este mismo diálogo en el celular: `submit`
// manda la recepción por la cola sin conexión, `renderScanner` pone el escáner
// con cámara, `localLookup` resuelve códigos sin señal y `onFeedback` suena y
// vibra. Cada apertura tiene su `operationId`: reintentar no duplica.
//
// FEAT-24 H5-L: si el producto maneja lotes, cada línea pide lote y
// vencimiento (obligatorios) y se puede partir en varios lotes. Qué productos
// manejan lotes lo dice el catálogo (`product.tracksLots`); el celular lo pasa
// con lo descargado (`lotTracking`) para recibir sin señal.

export type ReceiveFeedbackKind = "ok" | "error";

interface Props {
  order: PurchaseOrder;
  companyId: string;
  warehouseName?: string;
  /** Escritorio: empieza con todo lo pendiente. Celular escaneando: en 0. */
  fill?: "pending" | "zero";
  /** Mostrar el costo de cada línea (solo si el rol lo ve: si no, la API no lo manda). */
  showCosts?: boolean;
  onClose: () => void;
  onReceived: (result?: ReceivePurchaseOrderResult) => void;
  /** 409: lo pendiente cambió (otra persona recibió); refrescar. */
  onConflict?: () => void;
  submit?: (body: ReceivePurchaseOrderBody) => Promise<WriteResult<ReceivePurchaseOrderResult>>;
  renderScanner?: (scan: (code: string) => void) => ReactNode;
  localLookup?: (code: string) => VariantCodeMatch[];
  onFeedback?: (kind: ReceiveFeedbackKind) => void;
  /** FEAT-24 H5-L: qué variantes manejan lotes. Sin la prop, el diálogo lo consulta al catálogo. */
  lotTracking?: LotTracking;
}

export default function ReceivePurchaseOrderDialog({
  order,
  companyId,
  warehouseName,
  fill = "pending",
  showCosts = false,
  onClose,
  onReceived,
  onConflict,
  submit,
  renderScanner,
  localLookup,
  onFeedback,
  lotTracking: lotTrackingProp,
}: Props) {
  const [lines, setLinesState] = useState<ReceiveDraftLine[]>(() => receiveDraft(order, fill));
  const linesRef = useRef(lines);
  const setLines = (next: ReceiveDraftLine[]) => {
    linesRef.current = next;
    setLinesState(next);
  };
  const [operationId] = useState(() => newOperationId());
  const [scanCode, setScanCode] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lookups = useRef(new Map<string, VariantCodeMatch[]>());
  const scans = useRef<Promise<void>>(Promise.resolve());

  // FEAT-24 H5-L: las líneas de productos con lotes pasan a pedir lote y vencimiento.
  const lineVariantIds = useMemo(() => order.lines.map((line) => line.variantId), [order.lines]);
  const fetchedTracking = useLotTrackedVariants(lineVariantIds, companyId, { enabled: !lotTrackingProp });
  const tracking = lotTrackingProp ?? fetchedTracking;
  const trackedIds = tracking.status === "ready" ? tracking.variantIds : null;
  useEffect(() => {
    if (!trackedIds) return;
    const next = applyLotTracking(linesRef.current, trackedIds);
    if (next !== linesRef.current) {
      linesRef.current = next;
      setLinesState(next);
    }
  }, [trackedIds]);

  const fail = (message: string) => {
    setScanInfo(null);
    setScanError(message);
    if (onFeedback) onFeedback("error");
    else playErrorBeep();
  };

  const processScan = async (code: string) => {
    let matches = lookups.current.get(code);
    if (!matches) {
      try {
        matches = await lookupVariantsByCodes([code], companyId);
        lookups.current.set(code, matches);
      } catch (error) {
        if (!localLookup || !isNetworkError(error)) {
          fail(`No se pudo revisar el código ${code}. ${warehouseErrorMessage(error, "Inténtalo de nuevo.")}`);
          return;
        }
        matches = localLookup(code);
      }
    }
    const outcome = resolveReceiveScan(matches, linesRef.current);
    if (outcome.kind !== "added") {
      const line = "itemId" in outcome ? linesRef.current.find((candidate) => candidate.itemId === outcome.itemId) : undefined;
      fail(receiveScanMessage(outcome, code, line));
      return;
    }
    const next = addOneToLine(linesRef.current, outcome.itemId);
    setLines(next);
    const line = next.find((candidate) => candidate.itemId === outcome.itemId);
    setScanError(null);
    setScanInfo(`+1: ${line?.label ?? "producto"} (${line?.quantity ?? 0} de ${line?.pending ?? 0})`);
    onFeedback?.("ok");
  };

  const scan = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setSubmitError(null);
    scans.current = scans.current.then(() => processScan(code));
  };

  const receive = useMutation({
    mutationFn: async (): Promise<WriteResult<ReceivePurchaseOrderResult>> => {
      const body: ReceivePurchaseOrderBody = { lines: buildReceiveLines(linesRef.current), operationId };
      if (submit) return submit(body);
      return { status: "done", result: await receivePurchaseOrder(order.id, body) };
    },
    onSuccess: (written) => {
      if (written.status === "queued") toast.info(written.message);
      else if (written.result?.duplicate) toast.info(`Esa recepción de ${order.number} ya estaba registrada.`);
      else {
        const status = written.result?.purchaseOrder?.status;
        toast.success(`${order.number} · ${status ? PURCHASE_STATUS_LABEL[status] : "recepción registrada"}`, {
          description: "El costo promedio se actualizó y los pedidos sin stock de estos productos se reservan solos.",
        });
      }
      onReceived(written.status === "done" ? written.result : undefined);
    },
    onError: (error) => {
      // FEAT-24 H5-L: el lote ya existe con otra fecha (o no tiene saldo): se corrige el lote, no hace falta refrescar.
      if (isLotReceiveConflict(error)) {
        setSubmitError(lotWriteErrorMessage(error, "Revisa el lote y la fecha de vencimiento."));
        return;
      }
      if (httpStatus(error) === 409) {
        setSubmitError(warehouseErrorMessage(error, "Lo pendiente cambió: revisa las cantidades."));
        onConflict?.();
        return;
      }
      setSubmitError(warehouseErrorMessage(error, "No se pudo registrar la recepción. Inténtalo de nuevo."));
    },
  });

  const busy = receive.isPending;
  const checkingLots = tracking.status === "loading";
  const valid = receiveDraftValid(lines) && !checkingLots;
  const total = receiveTotal(lines);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recibir {order.number}</DialogTitle>
          <DialogDescription>
            {[order.supplierName, order.document, warehouseName ? `llega a ${warehouseName}` : null].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {renderScanner ? (
            renderScanner(scan)
          ) : (
            <>
              <Label htmlFor="purchase-receive-scan" className="flex items-center gap-2">
                <ScanBarcode className="h-4 w-4" aria-hidden="true" />
                Escanear código
              </Label>
              <Input
                id="purchase-receive-scan"
                autoComplete="off"
                placeholder="Escanea (o escribe el código y pulsa Enter): suma 1"
                value={scanCode}
                disabled={busy}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  scan(scanCode);
                  setScanCode("");
                }}
              />
            </>
          )}
          {scanError ? (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-2 text-sm text-destructive">
              {scanError}
            </p>
          ) : null}
          {scanInfo ? (
            <p role="status" className="text-sm text-teal-700 dark:text-teal-300">
              {scanInfo}
            </p>
          ) : null}
        </div>

        {checkingLots ? (
          <p role="status" className="text-xs text-muted-foreground">
            Revisando qué productos manejan lotes…
          </p>
        ) : tracking.status === "error" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <span>No se pudo revisar qué productos manejan lotes: si alguno los maneja, la recepción pedirá el lote.</span>
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={tracking.retry}>
              Reintentar
            </Button>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setLines(fillPending(linesRef.current))}>
            Recibir todo lo pendiente
          </Button>
        </div>

        <ul className="space-y-3" aria-label={`Productos de ${order.number}`}>
          {lines.map((line) => {
            const problem = receiveLineProblem(line);
            const source = order.lines.find((candidate) => candidate.id === line.itemId);
            const done = line.pending === 0;
            return (
              <li key={line.itemId} className="space-y-2 rounded-md border p-3" data-testid={`receive-line-${line.itemId}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{line.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pedido <strong className="text-foreground">{line.ordered}</strong> · ya recibido{" "}
                    <strong className="text-foreground">{line.received}</strong> · pendiente{" "}
                    <strong className="text-foreground">{line.pending}</strong>
                    {showCosts && source ? (
                      <>
                        {" "}
                        · costo unit. <Money value={source.entryCost} decimals={4} />
                      </>
                    ) : null}
                  </p>
                </div>
                {done ? (
                  <p className="text-xs text-teal-700 dark:text-teal-300">Completo: ya se recibió todo.</p>
                ) : line.lots ? (
                  <ReceiveLots
                    line={line}
                    disabled={busy}
                    problem={problem}
                    onChange={(key, patch) => setLines(setReceiveLot(linesRef.current, line.itemId, key, patch))}
                    onAdd={() => setLines(addReceiveLot(linesRef.current, line.itemId))}
                    onRemove={(key) => setLines(removeReceiveLot(linesRef.current, line.itemId, key))}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Label htmlFor={`receive-${line.itemId}`} className="text-xs">
                      Recibe ahora
                    </Label>
                    <Input
                      id={`receive-${line.itemId}`}
                      aria-label={`Recibe ahora: ${line.label}`}
                      className="w-28"
                      inputMode="numeric"
                      type="number"
                      min={0}
                      max={line.pending}
                      value={line.quantity}
                      disabled={busy}
                      aria-invalid={problem ? true : undefined}
                      onChange={(e) => setLines(setReceiveQuantity(linesRef.current, line.itemId, e.target.value))}
                    />
                    {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Cada recepción suma stock al costo de la compra y recalcula el costo promedio: (stock × costo actual + recibido ×
            costo de compra) ÷ (stock + recibido).
          </span>
        </div>

        {submitError ? (
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={!valid || busy} onClick={() => receive.mutate()}>
            {busy ? "Registrando…" : total > 0 ? `Confirmar recepción (${total})` : "Confirmar recepción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * FEAT-24 H5-L — lotes de una línea (mockup `mRecOC`: «Lote / vence»): número, vencimiento, unidades y comentario por
 * lote; «Agregar otro lote» parte la línea. Lo recibido es la suma de los lotes.
 */
function ReceiveLots({
  line,
  disabled,
  problem,
  onChange,
  onAdd,
  onRemove,
}: {
  line: ReceiveDraftLine;
  disabled: boolean;
  problem: string | null;
  onChange: (key: string, patch: { lotNumber?: string; expiresAt?: string; comment?: string; quantity?: string }) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  const lots = line.lots ?? [];
  const total = lots.reduce((sum, lot) => sum + (/^\d+$/.test(lot.quantity.trim()) ? Number(lot.quantity.trim()) : 0), 0);
  return (
    <div className="space-y-2" role="group" aria-label={`Lotes: ${line.label}`}>
      <p className="text-xs font-medium text-muted-foreground">Maneja lotes: lote y vencimiento obligatorios.</p>
      {lots.map((lot, index) => {
        const name = lots.length > 1 ? `${line.label} (lote ${index + 1})` : line.label;
        return (
          <div key={lot.key} className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-[1fr_10rem_6rem_auto]" data-testid={`receive-lot-${line.itemId}-${index}`}>
            <Input
              aria-label={`Lote: ${name}`}
              className="font-mono"
              placeholder="Lote"
              maxLength={LOT_NUMBER_MAX}
              value={lot.lotNumber}
              disabled={disabled}
              onChange={(e) => onChange(lot.key, { lotNumber: e.target.value })}
            />
            <Input
              aria-label={`Vencimiento: ${name}`}
              type="date"
              value={lot.expiresAt}
              disabled={disabled}
              onChange={(e) => onChange(lot.key, { expiresAt: e.target.value })}
            />
            <Input
              aria-label={`Unidades: ${name}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={line.pending}
              value={lot.quantity}
              disabled={disabled}
              onChange={(e) => onChange(lot.key, { quantity: e.target.value })}
            />
            {lots.length > 1 ? (
              <Button type="button" variant="ghost" size="icon" aria-label={`Quitar lote ${index + 1} de ${line.label}`} disabled={disabled} onClick={() => onRemove(lot.key)}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <span />
            )}
            <Input
              aria-label={`Comentario del lote: ${name}`}
              className="sm:col-span-4"
              placeholder="Comentario (opcional)"
              maxLength={LOT_COMMENT_MAX}
              value={lot.comment}
              disabled={disabled}
              onChange={(e) => onChange(lot.key, { comment: e.target.value })}
            />
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          Agregar otro lote
        </Button>
        <span className="text-xs text-muted-foreground">
          Recibe ahora: <strong className="text-foreground">{total}</strong> de {line.pending}
        </span>
      </div>
      {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
    </div>
  );
}
