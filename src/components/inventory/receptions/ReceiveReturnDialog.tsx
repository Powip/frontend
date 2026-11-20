"use client";

import { useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { ScanBarcode } from "lucide-react";
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
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import { playErrorBeep } from "@/lib/errorBeep";
import type { WriteResult } from "@/lib/offlineQueue";
import { isNetworkError } from "@/lib/offlineStore";
import {
  applyScan,
  buildReceiveBody,
  draftFromReception,
  draftIsValid,
  fillRemainingAsReingreso,
  lineProblem,
  MERMA_REASON_MAX,
  parseCount,
  resolveScan,
  scanErrorMessage,
  updateLine,
  type ReceptionLineDraft,
} from "@/lib/returnReception";
import { lookupVariantsByCodes, type VariantCodeMatch } from "@/services/variantCodesService";
import {
  receiveReturnReception,
  type CompanyWarehouse,
  type ReceiveReturnBody,
  type ReturnReception,
} from "@/services/warehousesService";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { orderLabel, type VariantLabeler } from "./receptionLabels";

// FEAT-24 H2-F — recibir una devolución completa: por producto, cuántas
// unidades vuelven a stock (reingreso) y cuántas van a merma (con motivo).
// Acepta el lector USB (entra como teclado y termina con Enter): cada escaneo
// suma 1 al reingreso de la línea que coincide.
//
// FEAT-24 H6-D — el modo almacén (/almacen) usa este mismo diálogo en el
// celular: `submit` manda la recepción por la cola sin conexión (puede quedar
// guardada para enviar después), `renderScanner` pone el escáner con cámara,
// `localLookup` resuelve los códigos sin señal con los datos ya descargados y
// `onFeedback` suena y vibra. Sin esas props se comporta como siempre.

export type ReceptionFeedbackKind = "ok" | "error";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

interface Props {
  reception: ReturnReception;
  companyId: string;
  warehouses: CompanyWarehouse[];
  label: VariantLabeler;
  onClose: () => void;
  /** Se registró (o ya estaba registrada): refrescar las listas. */
  onReceived: () => void;
  /** 409: alguien la recibió distinto; refrescar la bandeja. */
  onConflict: () => void;
  submit?: (body: ReceiveReturnBody) => Promise<WriteResult<ReturnReception>>;
  renderScanner?: (scan: (code: string) => void) => ReactNode;
  /** Sin señal: buscar el código entre los productos ya descargados de la devolución. */
  localLookup?: (code: string) => VariantCodeMatch[];
  onFeedback?: (kind: ReceptionFeedbackKind) => void;
}

export default function ReceiveReturnDialog({
  reception,
  companyId,
  warehouses,
  label,
  onClose,
  onReceived,
  onConflict,
  submit,
  renderScanner,
  localLookup,
  onFeedback,
}: Props) {
  const [lines, setLinesState] = useState<ReceptionLineDraft[]>(() => draftFromReception(reception));
  // El escaneo es asíncrono: lee siempre las líneas más nuevas.
  const linesRef = useRef(lines);
  const setLines = (next: ReceptionLineDraft[]) => {
    linesRef.current = next;
    setLinesState(next);
  };
  const [destination, setDestination] = useState(reception.inventoryId);
  const myWarehouses = useMyWarehouses();
  const [scanCode, setScanCode] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lookups = useRef(new Map<string, VariantCodeMatch[]>());
  const queue = useRef<Promise<void>>(Promise.resolve());

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
        // Sin señal: con los códigos ya descargados de los productos de esta devolución.
        matches = localLookup(code);
      }
    }
    const outcome = resolveScan(matches, linesRef.current);
    if (outcome.kind !== "added") {
      fail(scanErrorMessage(outcome, code, outcome.kind === "line_complete" ? label(outcome.variantId).name : undefined));
      return;
    }
    const next = applyScan(linesRef.current, outcome.variantId);
    setLines(next);
    const line = next.find((candidate) => candidate.variantId === outcome.variantId);
    setScanError(null);
    setScanInfo(`+1 a stock: ${label(outcome.variantId).name} (${line?.reingreso ?? 0} de ${line?.quantity ?? 0})`);
    onFeedback?.("ok");
  };

  const scan = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setSubmitError(null);
    // Un lector rápido manda varios códigos seguidos: se procesan en orden.
    queue.current = queue.current.then(() => processScan(code));
  };

  const receive = useMutation({
    mutationFn: async (): Promise<WriteResult<ReturnReception>> => {
      const body = buildReceiveBody(linesRef.current, destination, reception.inventoryId);
      if (submit) return submit(body);
      return { status: "done", result: await receiveReturnReception(reception.id, body) };
    },
    onSuccess: (written) => {
      if (written.status === "queued") toast.info(written.message);
      else if (written.result?.duplicate) toast.info(`La devolución ${orderLabel(reception)} ya estaba recibida.`);
      else toast.success(`Devolución ${orderLabel(reception)} recibida`);
      onReceived();
    },
    onError: (error) => {
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status === 409) {
        setSubmitError(warehouseErrorMessage(error, "La recepción ya fue registrada con otros datos."));
        onConflict();
        return;
      }
      setSubmitError(warehouseErrorMessage(error, "No se pudo registrar la recepción. Inténtalo de nuevo."));
    },
  });

  const origin = warehouses.find((w) => w.id === reception.inventoryId);
  // A dónde puede reingresar: almacenes activos (y el del pedido, aunque esté inactivo, para no mostrar vacío).
  // FEAT-24 H6: de los otros, solo los que el usuario opera.
  const destinations = warehouses.filter((w) => w.id === reception.inventoryId || (w.status && myWarehouses.canOperate(w.id)));
  const valid = draftIsValid(lines);
  const busy = receive.isPending;
  const anyReingreso = lines.some((line) => line.reingreso > 0);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recibir devolución {orderLabel(reception)}</DialogTitle>
          <DialogDescription>
            Volvió a {origin?.name ?? "su almacén"} el {formatPeruDateTime(reception.createdAt)}. Por cada producto, lo que
            vuelve a stock más la merma tiene que dar lo que volvió.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {renderScanner ? (
            renderScanner(scan)
          ) : (
            <>
              <Label htmlFor="reception-scan" className="flex items-center gap-2">
                <ScanBarcode className="h-4 w-4" aria-hidden="true" />
                Escanear código
              </Label>
              <Input
                id="reception-scan"
                autoFocus
                autoComplete="off"
                placeholder="Escanea (o escribe el código y pulsa Enter): suma 1 a stock"
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
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setLines(fillRemainingAsReingreso(linesRef.current))}>
            Lo que falta, a stock
          </Button>
        </div>

        <ul className="space-y-3" aria-label="Productos de la devolución">
          {lines.map((line) => {
            const { name, detail } = label(line.variantId);
            const problem = lineProblem(line);
            return (
              <li key={line.variantId} className="space-y-2 rounded-md border p-3" data-testid={`line-${line.variantId}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{name}</p>
                    {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
                  </div>
                  <p className="text-sm">
                    Volvieron <strong>{line.quantity}</strong>
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[110px_110px_1fr]">
                  <div className="space-y-1">
                    <Label htmlFor={`reingreso-${line.variantId}`} className="text-xs">
                      A stock
                    </Label>
                    <Input
                      id={`reingreso-${line.variantId}`}
                      aria-label={`A stock: ${name}`}
                      type="number"
                      min={0}
                      max={line.quantity}
                      value={String(line.reingreso)}
                      disabled={busy}
                      onChange={(e) => setLines(updateLine(linesRef.current, line.variantId, { reingreso: parseCount(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`merma-${line.variantId}`} className="text-xs">
                      Merma
                    </Label>
                    <Input
                      id={`merma-${line.variantId}`}
                      aria-label={`Merma: ${name}`}
                      type="number"
                      min={0}
                      max={line.quantity}
                      value={String(line.merma)}
                      disabled={busy}
                      onChange={(e) => setLines(updateLine(linesRef.current, line.variantId, { merma: parseCount(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`motivo-${line.variantId}`} className="text-xs">
                      Motivo de la merma
                    </Label>
                    <Input
                      id={`motivo-${line.variantId}`}
                      aria-label={`Motivo de la merma: ${name}`}
                      maxLength={MERMA_REASON_MAX}
                      placeholder={line.merma > 0 ? "Ej.: envase roto" : "Solo si hay merma"}
                      value={line.reason}
                      disabled={busy || line.merma === 0}
                      onChange={(e) => setLines(updateLine(linesRef.current, line.variantId, { reason: e.target.value }))}
                    />
                  </div>
                </div>
                <p className={problem ? "text-xs text-destructive" : "text-xs text-teal-700 dark:text-teal-300"}>
                  {problem ?? "Listo"}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="space-y-1">
          <Label htmlFor="reception-destination">Reingresa a</Label>
          <select
            id="reception-destination"
            className={SELECT_CLASS}
            value={destination}
            disabled={busy || !anyReingreso}
            onChange={(e) => setDestination(e.target.value)}
          >
            {destinations.length === 0 ? <option value={reception.inventoryId}>Almacén del pedido</option> : null}
            {destinations.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.id === reception.inventoryId ? " (almacén del pedido)" : ""}
                {w.status ? "" : " · inactivo"}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Lo que vuelve a stock entra a este almacén. La merma no entra a ninguno.</p>
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
            {busy ? "Registrando…" : "Confirmar recepción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
