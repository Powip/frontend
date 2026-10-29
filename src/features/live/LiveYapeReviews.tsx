"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { LiveEmpty, LiveErrorBanner, LivePanel } from "./LiveShared";
import { createLivePolling, type LivePollingController } from "./livePolling";
import {
  getLiveYapeReviewProof,
  getLiveYapeReviews,
  isLiveReadDenied,
  liveAdminError,
  liveError,
  liveMoney,
  reviewLiveYapePayment,
  safeLiveUrl,
} from "./liveService";
import type { LiveCheckoutSnapshot, LiveYapeReview } from "./types";

export default function LiveYapeReviews({
  storeId,
  canReview,
}: {
  storeId: string;
  canReview: boolean;
}) {
  const [snapshot, setSnapshot] = useState<{
    storeId: string;
    reviews: LiveYapeReview[];
    error: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ storeId: string; text: string } | null>(null);
  const [selection, setSelection] = useState<{
    storeId: string;
    review: LiveYapeReview;
    decision: "approve" | "reject";
  } | null>(null);
  const polling = useRef<LivePollingController | null>(null);
  const pollingScope = useRef<string | null>(null);
  const current = snapshot?.storeId === storeId && canReview ? snapshot : null;
  const reviews = current?.reviews ?? [];
  const error = current?.error ?? "";
  const noticeText = notice?.storeId === storeId ? notice.text : "";
  const selected = selection?.storeId === storeId && canReview ? selection : null;
  const selectedOpen = Boolean(selected);
  const pending = loading || (!current && canReview);
  const load = useCallback(
    (quiet = false) =>
      polling.current?.refresh({ quiet, supersede: true }) ?? Promise.resolve(false),
    [],
  );
  useEffect(() => {
    setSelection(null);
    setSnapshot(null);
    setNotice(null);
    if (!canReview) {
      setLoading(false);
      return;
    }
    let hasSnapshot = false;
    const reader = createLivePolling<Awaited<ReturnType<typeof getLiveYapeReviews>>>({
      load: (signal) => getLiveYapeReviews(storeId, signal),
      intervalMs: 15000,
      onData: (result) => {
        hasSnapshot = true;
        setSnapshot({ storeId, reviews: result.reviews, error: "" });
      },
      onError: (cause) => {
        const denied = isLiveReadDenied(cause);
        if (denied) {
          hasSnapshot = false;
          setSelection(null);
        }
        setSnapshot((previous) => ({
          storeId,
          reviews: !denied && previous?.storeId === storeId ? previous.reviews : [],
          error: liveError(cause),
        }));
      },
      onLoading: (active, quiet) => {
        if (!quiet || !active || !hasSnapshot) setLoading(active);
      },
    });
    polling.current = reader;
    pollingScope.current = storeId;
    void reader.refresh({ quiet: false });
    return () => {
      reader.dispose();
      if (polling.current === reader) {
        polling.current = null;
        pollingScope.current = null;
      }
    };
  }, [storeId, canReview]);
  useEffect(() => {
    if (pollingScope.current === storeId && canReview) polling.current?.setPaused(selectedOpen);
  }, [storeId, canReview, selectedOpen]);
  if (!canReview)
    return (
      <LiveEmpty>
        Para validar pagos Yape necesitas el rol Administrador vigente de tu negocio.
      </LiveEmpty>
    );
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
        Comprueba cada ingreso en la cuenta Yape del negocio. Un comprobante enviado por el cliente
        permanece pendiente hasta que tu equipo valide o rechace el pago.
      </div>
      {error ? <LiveErrorBanner message={error} onRetry={() => void load()} /> : null}
      {noticeText ? (
        <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
          {noticeText}
        </p>
      ) : null}
      <LivePanel
        title="Comprobantes por revisar"
        description="Los apartados con comprobante esperan una decisión incluso cuando vence el plazo de revisión."
      >
        <div className="mb-4 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={pending}>
            <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
        {pending && !reviews.length ? (
          <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando pagos…
          </p>
        ) : reviews.length ? (
          <div className="divide-y">
            {reviews.map((review) => (
              <article key={review.checkoutId} className="space-y-3 py-4 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{review.customer.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {review.customer.phone} ·{" "}
                      {review.orderNumber || `Compra ${review.checkoutId.slice(0, 8)}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Operación enviada: {review.manualPayment?.operationNumber || "Sin número"}
                    </p>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{liveMoney(review.quote.total)}</p>
                </div>
                {review.manualPayment?.overdue ? (
                  <p className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    Plazo de revisión vencido · requiere una decisión
                  </p>
                ) : review.manualPayment?.reviewDeadlineAt ? (
                  <p className="text-xs text-muted-foreground">
                    Revisar hasta{" "}
                    {new Date(review.manualPayment.reviewDeadlineAt).toLocaleString("es-PE")}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => setSelection({ storeId, review, decision: "approve" })}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Revisar y validar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelection({ storeId, review, decision: "reject" })}
                  >
                    <XCircle className="h-4 w-4" />
                    Rechazar comprobante
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <LiveEmpty>No hay comprobantes pendientes de revisión.</LiveEmpty>
        )}
      </LivePanel>
      {selected ? (
        <ReviewDialog
          key={`${storeId}/${selected.review.checkoutId}/${selected.decision}`}
          storeId={storeId}
          review={selected.review}
          decision={selected.decision}
          onClose={() => setSelection(null)}
          onComplete={(result) => {
            setSelection(null);
            setNotice({
              storeId,
              text:
                selected.decision === "approve"
                  ? result.status === "PAID"
                    ? "Pago validado. El pedido fue confirmado por el servidor."
                    : "Revisión registrada. Consulta el estado del pedido."
                  : "Comprobante rechazado. El cliente podrá consultar el motivo.",
            });
            polling.current?.setPaused(false, { refreshOnResume: false });
            void load(true);
          }}
        />
      ) : null}
    </div>
  );
}

function ReviewDialog({
  storeId,
  review,
  decision,
  onClose,
  onComplete,
}: {
  storeId: string;
  review: LiveYapeReview;
  decision: "approve" | "reject";
  onClose: () => void;
  onComplete: (result: LiveCheckoutSnapshot) => void;
}) {
  const [proof, setProof] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const active = useRef(true);
  const command = useRef<{ selection: string; key: string } | null>(null);
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    void getLiveYapeReviewProof(storeId, review.checkoutId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          const url = safeLiveUrl(result.url);
          if (!url) throw new Error("No se pudo abrir el comprobante.");
          setProof(url);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(liveError(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setProofLoading(false);
      });
    return () => {
      active.current = false;
      controller.abort();
    };
  }, [storeId, review.checkoutId]);
  async function submit() {
    if (
      lock.current ||
      !confirmed ||
      !proof ||
      (decision === "approve" ? !operation.trim() : reason.trim().length < 3)
    )
      return;
    const selection = `${storeId}/${review.checkoutId}/${decision}/${operation.trim()}/${reason.trim()}`;
    const id = command.current?.selection === selection ? command.current.key : crypto.randomUUID();
    command.current = { selection, key: id };
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await reviewLiveYapePayment(
        storeId,
        review.checkoutId,
        decision,
        decision === "approve"
          ? { operationNumber: operation.trim(), idempotencyKey: id }
          : { reason: reason.trim(), idempotencyKey: id },
      );
      if (active.current) onComplete(result);
    } catch (cause) {
      if (active.current) setError(liveAdminError(cause));
    } finally {
      if (active.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {decision === "approve" ? "Validar pago Yape" : "Rechazar comprobante"}
          </DialogTitle>
          <DialogDescription>
            {review.customer.name} ·{" "}
            {review.orderNumber || `Compra ${review.checkoutId.slice(0, 8)}`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-between gap-3 rounded-xl border bg-muted/30 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Operación enviada por el cliente</p>
            <p className="mt-1 font-mono text-sm">
              {review.manualPayment?.operationNumber || "Sin número"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Monto a verificar</p>
            <p className="mt-1 text-xl font-bold">{liveMoney(review.quote.total)}</p>
          </div>
        </div>
        {error ? <LiveErrorBanner message={error} /> : null}
        {proofLoading ? (
          <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Abriendo comprobante privado…
          </p>
        ) : proof ? (
          <div className="space-y-2">
            <Image
              src={proof}
              alt="Comprobante Yape enviado por el cliente"
              width={600}
              height={500}
              unoptimized
              className="max-h-80 w-full rounded-xl border object-contain"
            />
            <a
              href={proof}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700"
            >
              Abrir imagen completa
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {decision === "approve" ? (
            <label htmlFor="yape-verified-operation" className="grid gap-2 text-sm font-medium">
              Número de operación verificado en Yape
              <Input
                id="yape-verified-operation"
                aria-label="Número de operación verificado en Yape"
                maxLength={50}
                disabled={busy}
                required
                value={operation}
                onChange={(event) => setOperation(event.target.value)}
              />
              <span className="text-xs font-normal text-muted-foreground">
                Comprueba que el monto y la operación figuran en la cuenta Yape del negocio.
              </span>
            </label>
          ) : (
            <label htmlFor="yape-rejection-reason" className="grid gap-2 text-sm font-medium">
              Motivo para el cliente
              <Input
                id="yape-rejection-reason"
                maxLength={500}
                disabled={busy}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          <label className="flex items-start gap-2 rounded-xl border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              {decision === "approve"
                ? "Verifiqué el ingreso y confirmo este pago. El pago quedará validado y permitirá continuar con la entrega."
                : "Confirmo el rechazo del comprobante con el motivo indicado. El cliente deberá contactar al negocio si ya realizó el pago."}
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={decision === "approve" ? "default" : "destructive"}
              disabled={
                busy ||
                !confirmed ||
                !proof ||
                (decision === "approve" ? !operation.trim() : reason.trim().length < 3)
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {decision === "approve" ? "Validar pago y confirmar pedido" : "Confirmar rechazo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
