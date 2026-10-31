"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createLivePolling, type LivePollingController } from "./livePolling";
import { isLiveReadDenied } from "./liveService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getLiveCheckoutSnapshot,
  liveBuyerLabel,
  liveError,
  liveMoney,
  safeLiveUrl,
  uploadLiveYapeProof,
  validateLivePaymentImage,
} from "./liveService";
import { LiveCountdown } from "./LiveShared";
import { purchaseField } from "./LiveDeliveryForm";
import type { LiveCheckoutSnapshot } from "./types";
const action =
  "min-h-11 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40";
export default function LiveManualPaymentDialog({
  storeId,
  visitor,
  checkoutId,
  initial,
  onClose,
  onUpdated,
}: {
  storeId: string;
  visitor: string;
  checkoutId: string;
  initial?: LiveCheckoutSnapshot | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [snapshot, setSnapshot] = useState(initial || null),
    [step, setStep] = useState(2),
    [showQr, setShowQr] = useState(false),
    [operation, setOperation] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const scope = useRef(0),
    active = useRef(true),
    lock = useRef(false),
    sequence = useRef(0),
    attempt = useRef<{ selection: string; id: string } | null>(null);
  const polling = useRef<LivePollingController | null>(null);
  useEffect(() => {
    scope.current++;
    active.current = true;
    lock.current = false;
    attempt.current = null;
    setBusy(false);
    setFile(null);
    setOperation("");
    setStep(2);
    setShowQr(false);
    setError("");
    setNotice("");
    setSnapshot(initial || null);
    const reader = createLivePolling({
      load: (signal) => getLiveCheckoutSnapshot(storeId, visitor, checkoutId, signal),
      intervalMs: 5000,
      onData: (result) => {
        setSnapshot(result);
      },
      onError: (e) => {
        if (isLiveReadDenied(e)) setSnapshot(null);
        setError(liveError(e));
      },
    });
    polling.current = reader;
    void reader.refresh({ quiet: false });
    return () => {
      scope.current++;
      active.current = false;
      reader.dispose();
      if (polling.current === reader) polling.current = null;
    };
  }, [storeId, visitor, checkoutId]);
  useEffect(() => {
    polling.current?.setPaused(busy);
  }, [busy]);
  const manual = snapshot?.manualPayment;
  const status =
    snapshot?.buyerStatus || (snapshot?.status === "ANULADO" ? "CANCELLED" : manual?.status);
  const terminal = [
    "CANCELLED",
    "APPROVED",
    "UNDER_REVIEW",
    "EXPIRED",
    "REFUNDED",
    "REFUND_PENDING",
  ].includes(status || "");
  const qr = safeLiveUrl(manual?.qrUrl),
    total = snapshot?.quote?.total;
  const hasAmount = typeof total === "number" && Number.isFinite(total) && total > 0;
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copiado.");
    } catch {
      setNotice(`Puedes copiarlo manualmente: ${value}`);
    }
  }
  async function submit() {
    if (lock.current || terminal || !hasAmount || !/^\d{4,12}$/.test(operation)) return;
    const selection = `${operation}/${file?.name || ""}/${file?.size || 0}/${file?.lastModified || 0}`;
    const currentScope = scope.current;
    const id = attempt.current?.selection === selection ? attempt.current.id : crypto.randomUUID();
    attempt.current = { selection, id };
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await uploadLiveYapeProof(storeId, visitor, checkoutId, {
        file,
        operationNumber: operation,
        idempotencyKey: id,
      });
      if (!active.current || currentScope !== scope.current) return;
      sequence.current++;
      setSnapshot(result);
      setFile(null);
      onUpdated();
    } catch (e) {
      if (active.current && currentScope === scope.current) setError(liveError(e));
    } finally {
      if (currentScope === scope.current) {
        lock.current = false;
        if (active.current) setBusy(false);
      }
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[94dvh] overflow-y-auto border-white/15 bg-[#171428] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {terminal
              ? liveBuyerLabel(status)
              : `1 Entrega · ${step === 2 ? "2 Paga con Yape" : "3 Confirma"}`}
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            {snapshot?.orderNumber || "Tu pedido"}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-emerald-200">
            {notice}
          </p>
        ) : null}
        {!snapshot ? (
          <p>Cargando pago…</p>
        ) : terminal ? (
          <div className="space-y-4">
            <p className="text-3xl font-bold text-emerald-300">{liveMoney(total!)}</p>
            <p className="text-sm text-slate-300">
              {status === "UNDER_REVIEW"
                ? `¡Listo, ${snapshot.customer?.name || "recibimos tu compra"}! El negocio está validando tu pago. Tu pedido y tus prendas están guardados.`
                : status === "APPROVED"
                  ? "El negocio confirmó el ingreso de tu pago."
                  : status === "CANCELLED"
                    ? "Este pedido fue anulado."
                    : "Consulta el estado de tu pedido o contacta al negocio."}
            </p>
            {snapshot.trackingUrl?.startsWith("/p/") ? (
              <a href={snapshot.trackingUrl} className={`${action} block text-center`}>
                Ver mi pedido
              </a>
            ) : null}
            <button
              className="min-h-11 w-full rounded-xl border border-white/20 p-3"
              onClick={onClose}
            >
              Seguir comprando
            </button>
          </div>
        ) : !hasAmount ? (
          <p role="alert">
            No pudimos confirmar el monto. Actualiza el pedido antes de realizar el Yape.
          </p>
        ) : (
          <>
            {status === "REJECTED" ? (
              <div className="rounded-xl border border-rose-400/30 p-3">
                <h2 className="font-bold">Pago no validado</h2>
                <p className="mt-1 text-sm">{manual?.reason || manual?.rejectionReason}</p>
                <p className="mt-2 text-xs text-slate-300">
                  Revisa la operación y envía otro comprobante para el mismo pedido.
                </p>
              </div>
            ) : null}
            {manual?.proofDeadlineAt && status === "AWAITING_PROOF" ? (
              <p className="flex items-center justify-between text-xs">
                Tus prendas separadas{" "}
                <LiveCountdown
                  expiresAt={manual.proofDeadlineAt}
                  serverNow={snapshot.serverNow || new Date().toISOString()}
                />
              </p>
            ) : null}
            {step === 2 && status !== "REJECTED" ? (
              <>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
                  <p className="text-sm text-slate-300">Monto exacto a yapear</p>
                  <p className="my-2 text-4xl font-bold text-emerald-300">{liveMoney(total!)}</p>
                  <p className="text-lg font-bold">{manual?.phone}</p>
                  <p className="text-sm text-slate-300">{manual?.holder}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className={action} onClick={() => void copy(manual?.phone || "")}>
                      Copiar número
                    </button>
                    <button className={action} onClick={() => void copy(total!.toFixed(2))}>
                      Copiar monto
                    </button>
                    {qr ? (
                      <button
                        className="min-h-11 rounded-xl border border-white/20 px-4"
                        onClick={() => setShowQr((v) => !v)}
                      >
                        Ver QR
                      </button>
                    ) : null}
                  </div>
                </div>
                {showQr && qr ? (
                  <Image
                    src={qr}
                    alt="QR Yape del negocio"
                    width={240}
                    height={240}
                    unoptimized
                    className="mx-auto rounded-xl bg-white p-3"
                  />
                ) : null}
                <ol className="list-inside list-decimal space-y-2 text-sm text-slate-300">
                  <li>Yapea el monto al número del negocio.</li>
                  <li>Guarda el número de operación.</li>
                  <li>Vuelve y toca «Ya yapeé».</li>
                </ol>
                <button className={`${action} w-full`} onClick={() => setStep(3)}>
                  Ya yapeé →
                </button>
              </>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <button
                  type="button"
                  className="min-h-11 text-sm text-slate-300"
                  onClick={() => setStep(2)}
                >
                  ← Ver datos de Yape
                </button>
                <label className="block text-sm">
                  Número de operación
                  <input
                    aria-label="Número de operación Yape"
                    className={purchaseField}
                    inputMode="numeric"
                    maxLength={12}
                    minLength={4}
                    pattern="[0-9]{4,12}"
                    required
                    value={operation}
                    onChange={(e) => setOperation(e.target.value.replace(/\D/g, ""))}
                    disabled={busy}
                  />
                  <span className="mt-1 block text-xs text-slate-300">
                    De 4 a 12 dígitos, tal como aparece en Yape.
                  </span>
                </label>
                <label className="block text-sm">
                  Subir captura del Yape (opcional)
                  <input
                    aria-label="Comprobante de Yape"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    className={`${purchaseField} max-w-full`}
                    onChange={(e) => {
                      setFile(null);
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        validateLivePaymentImage(f);
                        setFile(f);
                        setError("");
                      } catch (cause) {
                        setError(liveError(cause));
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                <button
                  className={`${action} w-full`}
                  disabled={busy || !/^\d{4,12}$/.test(operation)}
                >
                  {busy
                    ? "Enviando…"
                    : status === "REJECTED"
                      ? "Enviar otro comprobante"
                      : "Confirmar pago"}
                </button>
              </form>
            )}
          </>
        )}
        {snapshot && !terminal && hasAmount ? (
          <footer className="sticky -bottom-6 border-t border-white/15 bg-[#171428] py-4">
            <p className="flex justify-between text-xs text-slate-300">
              <span>Productos {liveMoney(snapshot.quote?.subtotal || 0)}</span>
              <span>Envío {liveMoney(snapshot.quote?.shipping || 0)}</span>
            </p>
            <p className="mt-2 flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>{liveMoney(total!)}</span>
            </p>
          </footer>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
