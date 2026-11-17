"use client";

import { useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Info, ScanBarcode } from "lucide-react";
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
import {
  addOneToLine,
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
  resolveReceiveScan,
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
      if (httpStatus(error) === 409) {
        setSubmitError(warehouseErrorMessage(error, "Lo pendiente cambió: revisa las cantidades."));
        onConflict?.();
        return;
      }
      setSubmitError(warehouseErrorMessage(error, "No se pudo registrar la recepción. Inténtalo de nuevo."));
    },
  });

  const busy = receive.isPending;
  const valid = receiveDraftValid(lines);
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
