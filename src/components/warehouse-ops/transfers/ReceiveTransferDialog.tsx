"use client";

import { useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { playErrorBeep } from "@/lib/errorBeep";
import type { WriteResult } from "@/lib/offlineQueue";
import { isNetworkError } from "@/lib/offlineStore";
import { newOperationId } from "@/lib/purchaseOrders";
import {
  addOneToTransferLine,
  buildTransferReceiveLines,
  errorStatus,
  formatDateTime,
  opsErrorMessage,
  receiveLineDifference,
  receiveLineProblem,
  resolveTransferScan,
  TRANSFER_DECISION_LABEL,
  TRANSFER_STATUS_LABEL,
  transferReceiveDraft,
  transferReceiveProblem,
  type TransferReceiveLine,
} from "@/lib/warehouseOps";
import { lookupVariantsByCodes, type VariantCodeMatch } from "@/services/variantCodesService";
import { receiveTransfer, type ReceiveTransferBody, type Transfer, type TransferDifferenceDecision, type TransferOperationResult } from "@/services/warehouseOpsService";
import { ErrorBox, SELECT_CLASS } from "../OpsBits";

// FEAT-24 H5-C (H5-D1) — recibir un traslado en camino, por línea y una vez cada
// línea. Recepción parcial: se reciben ahora las líneas marcadas y el resto
// después. Si llega menos de lo enviado, la diferencia pide una decisión
// (pendiente de investigar —crea un pendiente—, pérdida o reclamo); si llega
// más, entra igual como sobrante. Cada apertura tiene su `operationId`:
// reintentar no duplica.
//
// El modo almacén usa este mismo diálogo en el celular: `submit` va por la cola
// sin conexión, `renderScanner` pone el escáner (cada escaneo suma 1),
// `localLookup` resuelve códigos sin señal y `onFeedback` suena y vibra.

const DECISIONS: TransferDifferenceDecision[] = ["pendiente", "perdida", "reclamo"];

interface Props {
  transfer: Transfer;
  companyId: string;
  originName: string;
  destinationName: string;
  fill?: "sent" | "zero";
  onClose: () => void;
  onReceived: (result?: TransferOperationResult) => void;
  onConflict?: () => void;
  submit?: (body: ReceiveTransferBody) => Promise<WriteResult<TransferOperationResult>>;
  renderScanner?: (scan: (code: string) => void) => ReactNode;
  localLookup?: (code: string) => VariantCodeMatch[];
  onFeedback?: (kind: "ok" | "error") => void;
}

export default function ReceiveTransferDialog({
  transfer,
  companyId,
  originName,
  destinationName,
  fill = "sent",
  onClose,
  onReceived,
  onConflict,
  submit,
  renderScanner,
  localLookup,
  onFeedback,
}: Props) {
  const [lines, setLinesState] = useState<TransferReceiveLine[]>(() => transferReceiveDraft(transfer, fill));
  const linesRef = useRef(lines);
  const setLines = (next: TransferReceiveLine[]) => {
    linesRef.current = next;
    setLinesState(next);
  };
  const [operationId] = useState(() => newOperationId());
  const [touched, setTouched] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lookups = useRef(new Map<string, VariantCodeMatch[]>());
  const scans = useRef<Promise<void>>(Promise.resolve());

  const patch = (itemId: string, change: Partial<TransferReceiveLine>) => {
    setSubmitError(null);
    setLines(linesRef.current.map((line) => (line.itemId === itemId ? { ...line, ...change } : line)));
  };

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
          fail(`No se pudo revisar el código ${code}. ${opsErrorMessage(error, "Inténtalo de nuevo.")}`);
          return;
        }
        matches = localLookup(code);
      }
    }
    const outcome = resolveTransferScan(matches, linesRef.current);
    if (outcome.kind !== "added") {
      fail(outcome.kind === "not_found" ? `El código ${code} no es de ningún producto de tu catálogo.` : `El código ${code} no es de ${transfer.number}.`);
      return;
    }
    const next = addOneToTransferLine(linesRef.current, outcome.itemId);
    setLines(next);
    const line = next.find((candidate) => candidate.itemId === outcome.itemId);
    setScanError(null);
    setScanInfo(`+1: ${line?.label ?? "producto"} (${line?.quantity ?? 0} de ${line?.sent ?? 0})`);
    onFeedback?.("ok");
  };

  const scan = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setSubmitError(null);
    scans.current = scans.current.then(() => processScan(code));
  };

  const problem = transferReceiveProblem(lines);

  const receive = useMutation({
    mutationFn: async (): Promise<WriteResult<TransferOperationResult>> => {
      const body: ReceiveTransferBody = { lines: buildTransferReceiveLines(linesRef.current), operationId };
      if (submit) return submit(body);
      return { status: "done", result: await receiveTransfer(transfer.id, body) };
    },
    onSuccess: (written) => {
      if (written.status === "queued") toast.info(written.message);
      else if (written.result?.duplicate) toast.info(`Esa recepción de ${transfer.number} ya estaba registrada.`);
      else {
        const status = written.result?.transfer?.status;
        toast.success(`${transfer.number} · ${status ? TRANSFER_STATUS_LABEL[status] : "recepción registrada"}`, {
          description: "Lo recibido ya está disponible y los pedidos sin stock de estos productos se reservan solos.",
        });
      }
      onReceived(written.status === "done" ? written.result : undefined);
    },
    onError: (error) => {
      setSubmitError(opsErrorMessage(error, "No se pudo registrar la recepción. Inténtalo de nuevo."));
      if (errorStatus(error) === 409) onConflict?.();
    },
  });
  const busy = receive.isPending;
  const receivedBefore = transfer.lines.length - lines.length;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recibir {transfer.number}</DialogTitle>
          <DialogDescription>
            {originName} → {destinationName} · salió {formatDateTime(transfer.dispatchedAt)}
            {receivedBefore > 0 ? ` · ${receivedBefore} línea(s) ya recibidas` : ""}
          </DialogDescription>
        </DialogHeader>

        {renderScanner ? (
          <div className="space-y-2">
            {renderScanner(scan)}
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
        ) : null}

        <ul className="space-y-3" aria-label={`Productos de ${transfer.number}`}>
          {lines.map((line) => {
            const difference = receiveLineDifference(line);
            const lineProblem = touched ? receiveLineProblem(line) : null;
            return (
              <li key={line.itemId} className="space-y-2 rounded-md border p-3" data-testid={`tr-receive-${line.itemId}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <label className="flex min-w-0 items-start gap-2">
                    <Checkbox
                      checked={line.include}
                      disabled={busy}
                      aria-label={`Recibir ahora: ${line.label}`}
                      onCheckedChange={(checked) => patch(line.itemId, { include: checked === true })}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{line.label}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{line.sku}</span>
                    </span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Enviado <strong className="text-foreground">{line.sent}</strong>
                  </p>
                </div>
                {line.include ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Label htmlFor={`tr-rec-${line.itemId}`} className="text-xs">
                      Recibido
                    </Label>
                    <Input
                      id={`tr-rec-${line.itemId}`}
                      aria-label={`Recibido: ${line.label}`}
                      className="w-24"
                      inputMode="numeric"
                      value={line.quantity}
                      disabled={busy}
                      aria-invalid={lineProblem ? true : undefined}
                      onChange={(event) => patch(line.itemId, { quantity: event.target.value })}
                    />
                    {difference === null ? null : difference === 0 ? (
                      <span className="text-xs text-teal-700 dark:text-teal-300">Completo</span>
                    ) : difference > 0 ? (
                      <span className="text-xs text-amber-700 dark:text-amber-300">Sobrante: +{difference} entra igual</span>
                    ) : (
                      <span className="text-xs text-destructive">Faltan {-difference}</span>
                    )}
                    {lineProblem ? <span className="text-xs text-destructive">{lineProblem}</span> : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Se recibe después: el traslado sigue en camino.</p>
                )}
                {line.include && difference !== null && difference < 0 ? (
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor={`tr-dec-${line.itemId}`} className="text-xs">
                        Qué hacer con la diferencia
                      </Label>
                      <select
                        id={`tr-dec-${line.itemId}`}
                        className={SELECT_CLASS}
                        value={line.decision}
                        disabled={busy}
                        onChange={(event) => patch(line.itemId, { decision: event.target.value as TransferDifferenceDecision })}
                      >
                        {DECISIONS.map((decision) => (
                          <option key={decision} value={decision}>
                            {TRANSFER_DECISION_LABEL[decision]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {line.decision === "pendiente" ? (
                      <>
                        <div className="space-y-1">
                          <Label htmlFor={`tr-resp-${line.itemId}`} className="text-xs">
                            Responsable (opcional)
                          </Label>
                          <Input
                            id={`tr-resp-${line.itemId}`}
                            value={line.responsible}
                            maxLength={100}
                            disabled={busy}
                            onChange={(event) => patch(line.itemId, { responsible: event.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`tr-due-${line.itemId}`} className="text-xs">
                            Fecha límite (opcional)
                          </Label>
                          <Input
                            id={`tr-due-${line.itemId}`}
                            type="date"
                            value={line.dueDate}
                            disabled={busy}
                            onChange={(event) => patch(line.itemId, { dueDate: event.target.value })}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Cada línea se recibe una sola vez. Lo que no llegue queda como diferencia del traslado: pendiente de investigar, pérdida o reclamo.
          </span>
        </div>

        {touched && problem ? <ErrorBox>{problem}</ErrorBox> : null}
        <ErrorBox>{submitError}</ErrorBox>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setTouched(true);
              if (problem) return;
              receive.mutate();
            }}
          >
            {busy ? "Registrando…" : "Confirmar recepción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
