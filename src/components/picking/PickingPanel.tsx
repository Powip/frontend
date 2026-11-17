"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OPERATIONS_PEDIDOS_QUERY_KEY } from "@/hooks/useOperationsPedidos";
import { playErrorBeep } from "@/lib/errorBeep";
import {
  apiErrorMessage,
  apiErrorStatus,
  canConfirmWithoutScan,
  DISPATCH_PENDING_MESSAGE,
  mergePickingView,
  pickedLine,
  pickingCompleteErrorMessage,
  pickingProgress,
} from "@/lib/orderStock";
import {
  completePicking,
  confirmPickingLine,
  getPicking,
  scanPicking,
  type PickingLine,
  type PickingView,
} from "@/services/orderStockService";

// FEAT-24 H2-F — picking de un pedido antes del despacho. El lector USB escribe
// el código y manda Enter: cada escaneo suma una unidad a la línea que
// corresponde. Si el código no es del pedido suena un error. «Completar»
// despacha el pedido (desde En envío) o deja el picking listo para despachar.

interface Props {
  orderId: string;
  orderNumber: string;
  /** El pedido pasó a Despachado. */
  onDispatched?: () => void;
}

type Feedback = { kind: "error" | "ok"; text: string };
type Outcome = { kind: "error" | "pending" | "info"; text: string };

const lineName = (line: PickingLine) => line.productName || line.sku || "Producto";

export default function PickingPanel({ orderId, orderNumber, onDispatched }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ["order-picking", orderId];
  const inputRef = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [confirmForbidden, setConfirmForbidden] = useState(false);

  const viewQuery = useQuery({
    queryKey,
    queryFn: () => getPicking(orderId),
    retry: false,
    staleTime: 0,
  });

  const store = (next: PickingView) => {
    const previous = queryClient.getQueryData<PickingView>(queryKey);
    const merged = mergePickingView(previous, next);
    queryClient.setQueryData(queryKey, merged);
    return { previous, merged };
  };

  const focusScanner = () => inputRef.current?.focus();

  const scan = (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    queue.current = queue.current.then(async () => {
      try {
        const { previous, merged } = store(await scanPicking(orderId, clean));
        const line = pickedLine(previous, merged);
        setOutcome(null);
        setFeedback({
          kind: "ok",
          text: line ? `+1: ${lineName(line)} (${line.picked} de ${line.quantity})` : `Código ${clean} registrado`,
        });
      } catch (error) {
        playErrorBeep();
        setFeedback({ kind: "error", text: apiErrorMessage(error, `No se pudo registrar el código ${clean}.`) });
      }
    });
  };

  const confirm = useMutation({
    mutationFn: (line: PickingLine) => confirmPickingLine(orderId, line.itemId),
    onSuccess: (view, line) => {
      store(view);
      setOutcome(null);
      setFeedback({ kind: "ok", text: `${lineName(line)}: confirmado sin escanear` });
      focusScanner();
    },
    onError: (error) => {
      if (apiErrorStatus(error) === 403) setConfirmForbidden(true);
      setFeedback({ kind: "error", text: apiErrorMessage(error, "No se pudo confirmar la línea.") });
      focusScanner();
    },
  });

  const complete = useMutation({
    mutationFn: () => completePicking(orderId),
    onSuccess: (result) => {
      store(result);
      void queryClient.invalidateQueries({ queryKey: [OPERATIONS_PEDIDOS_QUERY_KEY] });
      if (result.dispatched) {
        setOutcome(null);
        toast.success(`Pedido ${orderNumber} despachado`);
        onDispatched?.();
      } else {
        setOutcome({ kind: "info", text: result.message ?? "Picking completo." });
      }
    },
    onError: (error) => {
      const pending = apiErrorStatus(error) === 503;
      setOutcome({ kind: pending ? "pending" : "error", text: pending ? DISPATCH_PENDING_MESSAGE : pickingCompleteErrorMessage(error) });
      // Un 409 puede venir de líneas que cambiaron: se vuelve a leer el pedido.
      if (!pending) void queryClient.invalidateQueries({ queryKey });
    },
  });

  if (viewQuery.isPending) return <p className="text-sm text-muted-foreground">Cargando el pedido…</p>;
  if (viewQuery.isError)
    return (
      <div role="alert" className="rounded-md border border-destructive p-4 text-sm">
        No se pudo abrir el picking de {orderNumber}. {apiErrorMessage(viewQuery.error, "Inténtalo de nuevo.")}
        <Button variant="outline" size="sm" className="ml-3" onClick={() => void viewQuery.refetch()}>
          Reintentar
        </Button>
      </div>
    );

  const view = viewQuery.data;
  const progress = pickingProgress(view);
  const allowManual = canConfirmWithoutScan(view, confirmForbidden);

  return (
    <div className="space-y-4" data-testid="picking-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-lg font-semibold">{view.orderNumber || orderNumber}</h2>
        <span className="text-sm text-muted-foreground">
          {progress.done} de {progress.total} unidades tomadas
        </span>
      </div>

      <form
        className="space-y-1"
        onSubmit={(event) => {
          event.preventDefault();
          scan(code);
          setCode("");
        }}
      >
        <Label htmlFor={`picking-scan-${orderId}`} className="flex items-center gap-2">
          <ScanBarcode className="h-4 w-4" aria-hidden="true" />
          Escanear código
        </Label>
        <Input
          id={`picking-scan-${orderId}`}
          ref={inputRef}
          autoFocus
          autoComplete="off"
          value={code}
          placeholder="Escanea el SKU o el código de barras"
          onChange={(event) => setCode(event.target.value)}
        />
      </form>

      {feedback ? (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={feedback.kind === "error" ? "text-sm font-medium text-destructive" : "text-sm text-teal-700 dark:text-teal-300"}
        >
          {feedback.text}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Tomadas</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {view.lines.map((line) => (
              <tr key={line.itemId} className="border-t align-top" data-testid={`picking-line-${line.itemId}`}>
                <td className="px-4 py-3">
                  <span>{lineName(line)}</span>
                  {line.sku ? <span className="block text-xs text-muted-foreground">SKU {line.sku}</span> : null}
                  {!line.linked ? (
                    <span className="block text-xs text-amber-700 dark:text-amber-300">Sin vincular al catálogo: no se puede escanear.</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {line.picked} de {line.quantity}
                  {line.manual > 0 ? <span className="block text-xs text-muted-foreground">{line.manual} sin escanear</span> : null}
                </td>
                <td className="px-4 py-3">
                  {line.pending > 0 ? (
                    <span className="text-amber-700 dark:text-amber-300">Faltan {line.pending}</span>
                  ) : (
                    <span className="text-teal-700 dark:text-teal-300">Listo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {allowManual && line.pending > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={confirm.isPending}
                      aria-label={`Confirmar sin escanear ${lineName(line)}`}
                      onClick={() => confirm.mutate(line)}
                    >
                      Confirmar sin escanear
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.pickingRequired === true || confirmForbidden ? (
        <p className="text-xs text-muted-foreground">La empresa exige escanear cada producto.</p>
      ) : null}

      {outcome ? (
        <p
          role={outcome.kind === "error" ? "alert" : "status"}
          className={
            outcome.kind === "error"
              ? "rounded-md border border-destructive p-3 text-sm text-destructive"
              : "rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          }
        >
          {outcome.text}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button disabled={complete.isPending || view.lines.length === 0} onClick={() => complete.mutate()}>
          {complete.isPending ? "Completando…" : "Completar"}
        </Button>
      </div>
    </div>
  );
}
