"use client";

import {
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createLivePolling, type LivePollingController } from "./livePolling";
import {
  getLiveCheckoutSnapshot,
  isLiveReadDenied,
  liveError,
  liveMoney,
  liveOrderLabel,
  safeLiveUrl,
  uploadLiveYapeProof,
  validateLivePaymentImage,
} from "./liveService";
import type { LiveCheckoutSnapshot } from "./types";

const action =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#25F4EE] px-4 py-3 text-sm font-bold text-[#0B0B0F] hover:bg-[#78FAF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0F] disabled:cursor-not-allowed disabled:opacity-40";
const outline =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:border-[#25F4EE]/60 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE] disabled:opacity-40";

type LiveManualPaymentProps = {
  storeId: string;
  visitor: string;
  checkoutId: string;
  initial?: LiveCheckoutSnapshot | null;
  onClose: () => void;
  onUpdated: () => void;
};

export default function LiveManualPaymentDialog(props: LiveManualPaymentProps) {
  return (
    <LiveManualPaymentForm
      key={`${props.storeId}/${props.visitor}/${props.checkoutId}`}
      {...props}
    />
  );
}

function LiveManualPaymentForm({
  storeId,
  visitor,
  checkoutId,
  initial,
  onClose,
  onUpdated,
}: LiveManualPaymentProps) {
  const key = `${storeId}/${visitor}/${checkoutId}`;
  const [scopedSnapshot, setScopedSnapshot] = useState<{
    key: string;
    value: LiveCheckoutSnapshot;
  } | null>(initial ? { key, value: initial } : null);
  const snapshot = scopedSnapshot?.key === key ? scopedSnapshot.value : null;
  const seed = useRef({ key, initial });
  if (seed.current.key !== key) seed.current = { key, initial };
  const [loading, setLoading] = useState(!initial);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [operationNumber, setOperationNumber] = useState(
    initial?.manualPayment?.operationNumber ?? "",
  );
  const attempt = useRef<{ selection: string; id: string } | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const scope = useRef(key);
  scope.current = key;
  const reader = useRef<LivePollingController | null>(null);
  const latestSnapshot = useRef<LiveCheckoutSnapshot | null>(initial ?? null);
  const [readError, setReadError] = useState("");
  const errorNotice = useRef<HTMLParagraphElement>(null);
  const abort = useRef<AbortController | null>(null);
  const current = useCallback(() => mounted.current && scope.current === key, [key]);
  const refresh = useCallback(async () => {
    return (await reader.current?.refresh({ quiet: true, supersede: true })) ?? false;
  }, []);
  useEffect(() => {
    mounted.current = true;
    latestSnapshot.current = seed.current.initial ?? null;
    setScopedSnapshot(seed.current.initial ? { key, value: seed.current.initial } : null);
    setLoading(!seed.current.initial);
    setFile(null);
    setSubmitted(false);
    setOperationNumber(seed.current.initial?.manualPayment?.operationNumber ?? "");
    attempt.current = null;
    lock.current = false;
    setBusy(false);
    setError("");
    setReadError("");
    setInfo("");
    const polling = createLivePolling({
      load: (signal) => getLiveCheckoutSnapshot(storeId, visitor, checkoutId, signal),
      intervalMs: () => {
        const value = latestSnapshot.current;
        if (
          value &&
          (["PAID", "FAILED"].includes(value.status ?? "") ||
            ["APPROVED", "REJECTED", "EXPIRED"].includes(value.manualPayment?.status ?? ""))
        )
          return 30000;
        return value?.manualPayment?.status === "UNDER_REVIEW" ? 5000 : 10000;
      },
      onData: (value) => {
        latestSnapshot.current = value;
        setScopedSnapshot({ key, value });
        setReadError("");
      },
      onError: (cause) => {
        setReadError(liveError(cause));
        if (isLiveReadDenied(cause)) {
          latestSnapshot.current = null;
          setScopedSnapshot(null);
        }
      },
      onLoading: (pending) => {
        if (!pending) setLoading(false);
      },
    });
    reader.current = polling;
    void polling.refresh({ quiet: !!seed.current.initial });
    return () => {
      mounted.current = false;
      polling.dispose();
      if (reader.current === polling) reader.current = null;
      abort.current?.abort();
    };
  }, [storeId, visitor, checkoutId, key]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Each scope creates a reader that must inherit the pause state even if busy did not change.
  useEffect(() => {
    reader.current?.setPaused(busy, { refreshOnResume: false });
  }, [busy, key]);
  useEffect(() => {
    if (!error) return;
    const frame = requestAnimationFrame(() => {
      errorNotice.current?.scrollIntoView?.({ block: "nearest" });
      errorNotice.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [error]);
  const displayError = error || readError;

  const manual = snapshot?.manualPayment;
  const paid = snapshot?.status === "PAID" && manual?.status !== "REJECTED";
  const pending =
    manual?.status === "UNDER_REVIEW" || (submitted && manual?.status === "AWAITING_PROOF");
  const rejected = manual?.status === "REJECTED";
  const expired = manual?.status === "EXPIRED" || (snapshot?.status === "FAILED" && !rejected);
  const paymentTotal = snapshot?.quote?.total;
  const hasPaymentTotal =
    typeof paymentTotal === "number" && Number.isFinite(paymentTotal) && paymentTotal > 0;
  const canUpload =
    hasPaymentTotal &&
    !!manual &&
    manual.status === "AWAITING_PROOF" &&
    snapshot?.status !== "PAID" &&
    !submitted;
  const qrUrl = safeLiveUrl(manual?.qrUrl);
  async function submit() {
    if (!file || !operationNumber.trim() || !canUpload || lock.current) return;
    const selection = `${key}|${operationNumber.trim()}|${file.name}|${file.size}|${file.lastModified}`;
    const id = attempt.current?.selection === selection ? attempt.current.id : crypto.randomUUID();
    attempt.current = { selection, id };
    lock.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      await uploadLiveYapeProof(
        storeId,
        visitor,
        checkoutId,
        { file, operationNumber, idempotencyKey: id },
        controller.signal,
      );
      if (!current()) return;
      setSubmitted(true);
      await refresh();
      if (!current()) return;
      setFile(null);
      setInfo("Comprobante enviado para revisión. El pago aún no está validado.");
      onUpdated();
    } catch (cause) {
      if (current() && !controller.signal.aborted) setError(liveError(cause));
    } finally {
      if (current()) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(manual?.phone ?? "");
      if (current()) setInfo("Número Yape copiado.");
    } catch {
      if (current()) setError("No se pudo copiar. Selecciona el número y cópialo manualmente.");
    }
  }
  async function downloadQr() {
    if (!qrUrl) return;
    try {
      const response = await fetch(qrUrl, { credentials: "omit" });
      if (!response.ok)
        throw new Error("No se pudo descargar el QR. Puedes abrirlo para guardarlo.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "yape-negocio.png";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      if (current()) setError(liveError(cause));
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] grid-cols-1 overflow-y-auto border-white/15 bg-[#0B0B0F] text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagar con Yape</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {snapshot?.orderNumber || `Compra ${checkoutId.slice(0, 8)}`}
          </DialogDescription>
        </DialogHeader>
        {displayError ? (
          <p
            ref={errorNotice}
            tabIndex={-1}
            role="alert"
            className="rounded-xl border border-[#FE2C55]/35 bg-[#FE2C55]/10 p-3 text-sm text-rose-200"
          >
            {displayError}
          </p>
        ) : null}
        {info ? (
          <p
            role="status"
            className="rounded-xl border border-[#25F4EE]/20 bg-[#25F4EE]/10 p-3 text-sm text-[#25F4EE]"
          >
            {info}
          </p>
        ) : null}
        {loading && !snapshot ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando pago…
          </p>
        ) : !manual ? (
          <p className="text-sm text-zinc-400">
            No se encontraron instrucciones de Yape para este pago.
          </p>
        ) : paid ? (
          <div className="space-y-4 rounded-xl border border-[#25F4EE]/30 bg-[#25F4EE]/10 p-5">
            <CheckCircle2 className="h-7 w-7 text-[#25F4EE]" />
            <h2 className="font-bold text-[#25F4EE]">Pago validado por el negocio</h2>
            <p className="text-sm text-zinc-300">
              {snapshot?.orderStatus === "ANULADO"
                ? "Tu pedido fue anulado. Contacta al negocio para coordinar el pago o la entrega."
                : snapshot?.orderStatus === "ENTREGADO"
                  ? "Tu pedido ya fue entregado."
                  : "Tu pedido está confirmado. El negocio continuará con la entrega."}
            </p>
            {liveOrderLabel(snapshot?.orderStatus) ? (
              <p className="text-sm font-semibold">{liveOrderLabel(snapshot?.orderStatus)}</p>
            ) : null}
            {safeLiveUrl(snapshot?.trackingUrl) ? (
              <a
                href={safeLiveUrl(snapshot?.trackingUrl) ?? undefined}
                className={outline}
                target="_blank"
                rel="noopener noreferrer"
              >
                Seguir pedido <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            <button
              type="button"
              className={action}
              onClick={() => {
                onUpdated();
                onClose();
              }}
            >
              Ver mis compras
            </button>
          </div>
        ) : rejected ? (
          <div className="space-y-3 rounded-xl border border-[#FE2C55]/35 bg-[#FE2C55]/10 p-4">
            <h2 className="font-semibold text-rose-200">Comprobante no validado</h2>
            <p className="text-sm text-zinc-300">
              {manual.rejectionReason ||
                manual.reason ||
                "Contacta al negocio para revisar tu pago."}
            </p>
            <p className="text-sm text-zinc-300">
              Contacta al negocio antes de realizar otro pago. Este intento ya no admite otro
              comprobante.
            </p>
            <button type="button" className={outline} onClick={onClose}>
              Volver al catálogo
            </button>
          </div>
        ) : pending ? (
          <div className="space-y-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4">
            <div className="flex items-center gap-2 text-amber-100">
              <Clock3 className="h-5 w-5" />
              <h2 className="font-bold">Comprobante en revisión</h2>
            </div>
            <p className="text-sm leading-relaxed text-zinc-300">
              El negocio verificará el ingreso en su cuenta Yape. Tu pedido estará disponible
              después de validar el pago.
            </p>
            {manual.reviewDeadlineAt ? (
              <p className="text-xs text-zinc-400">
                Revisión prevista hasta {new Date(manual.reviewDeadlineAt).toLocaleString("es-PE")}.
                {manual.overdue ? " El negocio aún debe resolver la revisión." : ""}
              </p>
            ) : null}
            <button type="button" className={outline} onClick={() => void refresh()}>
              Actualizar estado
            </button>
          </div>
        ) : expired ? (
          <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            El plazo para enviar el comprobante terminó. Si ya pagaste, contacta al negocio antes de
            iniciar otra compra.
          </p>
        ) : !hasPaymentTotal ? (
          <p role="alert" className="text-sm text-amber-100">
            No pudimos confirmar el monto de este pago. Actualiza el estado antes de yapear.
          </p>
        ) : (
          <>
            <div className="rounded-xl border border-white/10 bg-[#16161C] p-4">
              <p className="text-xs text-zinc-400">Monto exacto a yapear</p>
              <p className="mt-1 text-3xl font-bold text-[#25F4EE]">{liveMoney(paymentTotal)}</p>
              <p className="mt-3 text-sm font-semibold">{manual.holder}</p>
              <div className="mt-1 flex items-center gap-3">
                <span className="select-all text-lg font-bold tabular-nums">{manual.phone}</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg p-2 text-xs text-[#25F4EE] hover:bg-[#25F4EE]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE]"
                  onClick={() => void copyPhone()}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar número
                </button>
              </div>
            </div>
            {qrUrl ? (
              <div className="space-y-3 text-center">
                <Image
                  src={qrUrl}
                  alt="QR Yape del negocio"
                  width={220}
                  height={220}
                  unoptimized
                  className="mx-auto h-52 w-52 rounded-xl bg-white p-3 object-contain"
                />
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className={outline} onClick={() => void downloadQr()}>
                    <Download className="h-4 w-4" />
                    Descargar QR
                  </button>
                  <a href={qrUrl} className={outline} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir QR
                  </a>
                </div>
              </div>
            ) : null}
            <p className="text-xs leading-relaxed text-zinc-400">
              Desde este mismo teléfono puedes copiar el número o guardar el QR y abrirlo en Yape.
              Luego vuelve aquí para subir el comprobante.
            </p>
            {manual.proofDeadlineAt ? (
              <p className="text-xs text-amber-200">
                Envía el comprobante antes de{" "}
                {new Date(manual.proofDeadlineAt).toLocaleString("es-PE")}.
              </p>
            ) : null}
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <label className="grid min-w-0 gap-2 text-xs font-semibold">
                Número de operación
                <input
                  aria-label="Número de operación Yape"
                  className="rounded-xl border border-white/15 bg-[#16161C] px-3 py-3 text-sm outline-none focus:border-[#25F4EE] focus:ring-2 focus:ring-[#25F4EE]/20"
                  maxLength={50}
                  required
                  value={operationNumber}
                  disabled={busy}
                  onChange={(event) => {
                    setOperationNumber(event.target.value);
                    setError("");
                  }}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-xs font-semibold">
                Comprobante de Yape
                <input
                  key={key}
                  aria-label="Comprobante de Yape"
                  className="w-full min-w-0 max-w-full rounded-xl border border-white/15 bg-[#16161C] p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#25F4EE]/10 file:px-3 file:py-2 file:text-[#25F4EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE]/60"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    setFile(null);
                    if (!selected) return;
                    try {
                      validateLivePaymentImage(selected);
                      setFile(selected);
                      setError("");
                    } catch (cause) {
                      setError(liveError(cause));
                      event.target.value = "";
                    }
                  }}
                />
                <span className="font-normal text-zinc-400">
                  Imagen JPG, PNG o WebP, hasta 5 MB.
                </span>
              </label>
              <button
                className={`${action} w-full`}
                type="submit"
                disabled={busy || !file || !operationNumber.trim() || !canUpload}
                aria-describedby="live-yape-upload-help"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                Enviar comprobante para revisión
              </button>
              <p id="live-yape-upload-help" className="text-center text-xs text-zinc-400">
                {!file
                  ? "Adjunta el comprobante en JPG, PNG o WebP para continuar."
                  : !operationNumber.trim()
                    ? "Ingresa el número de operación que aparece en tu comprobante."
                    : "Tu comprobante será revisado por el negocio; el pago aún no está validado."}
              </p>
              <p className="text-center text-[11px] text-zinc-400">
                Subir el comprobante no confirma el pago.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
