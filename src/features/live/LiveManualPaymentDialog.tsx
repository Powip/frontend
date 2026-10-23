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
import {
  getLiveCheckoutSnapshot,
  liveError,
  liveMoney,
  liveOrderLabel,
  safeLiveUrl,
  uploadLiveYapeProof,
  validateLivePaymentImage,
} from "./liveService";
import type { LiveCheckoutSnapshot } from "./types";

const action =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40";
const outline =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-40";

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
  const [snapshot, setSnapshot] = useState<LiveCheckoutSnapshot | null>(initial ?? null);
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
  const key = `${storeId}/${visitor}/${checkoutId}`;
  const scope = useRef(key);
  scope.current = key;
  const request = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const current = useCallback(() => mounted.current && scope.current === key, [key]);
  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    try {
      const result = await getLiveCheckoutSnapshot(storeId, visitor, checkoutId);
      if (!current() || sequence !== request.current) return;
      setSnapshot(result);
      setError("");
    } catch (cause) {
      if (current() && sequence === request.current) setError(liveError(cause));
    } finally {
      if (current() && sequence === request.current) setLoading(false);
    }
  }, [storeId, visitor, checkoutId, current]);
  useEffect(() => {
    mounted.current = true;
    setFile(null);
    setSubmitted(false);
    setOperationNumber("");
    attempt.current = null;
    lock.current = false;
    setError("");
    setInfo("");
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !lock.current) void refresh();
    }, 5000);
    return () => {
      mounted.current = false;
      request.current += 1;
      clearInterval(timer);
      abort.current?.abort();
    };
  }, [refresh]);
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
      request.current += 1;
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
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/15 bg-[#171428] text-slate-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagar con Yape</DialogTitle>
          <DialogDescription className="text-slate-400">
            {snapshot?.orderNumber || `Compra ${checkoutId.slice(0, 8)}`}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200"
          >
            {error}
          </p>
        ) : null}
        {info ? (
          <p
            role="status"
            className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-3 text-sm text-sky-100"
          >
            {info}
          </p>
        ) : null}
        {loading && !snapshot ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando pago…
          </p>
        ) : !manual ? (
          <p className="text-sm text-slate-400">
            No se encontraron instrucciones de Yape para este pago.
          </p>
        ) : paid ? (
          <div className="space-y-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <CheckCircle2 className="h-7 w-7 text-emerald-300" />
            <h2 className="font-bold text-emerald-200">Pago validado por el negocio</h2>
            <p className="text-sm text-slate-300">
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
          <div className="space-y-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4">
            <h2 className="font-semibold text-rose-200">Comprobante no validado</h2>
            <p className="text-sm text-slate-300">
              {manual.rejectionReason ||
                manual.reason ||
                "Contacta al negocio para revisar tu pago."}
            </p>
            <p className="text-sm text-slate-300">
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
            <p className="text-sm leading-relaxed text-slate-300">
              El negocio verificará el ingreso en su cuenta Yape. Tu pedido estará disponible
              después de validar el pago.
            </p>
            {manual.reviewDeadlineAt ? (
              <p className="text-xs text-slate-400">
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
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-slate-400">Monto exacto a yapear</p>
              <p className="mt-1 text-3xl font-bold text-emerald-300">{liveMoney(paymentTotal)}</p>
              <p className="mt-3 text-sm font-semibold">{manual.holder}</p>
              <div className="mt-1 flex items-center gap-3">
                <span className="select-all text-lg font-bold tabular-nums">{manual.phone}</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg p-2 text-xs text-emerald-300 hover:bg-white/5"
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
            <p className="text-xs leading-relaxed text-slate-400">
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
              <label className="grid gap-2 text-xs font-semibold">
                Número de operación
                <input
                  aria-label="Número de operación Yape"
                  className="rounded-xl border border-white/15 bg-slate-950/40 px-3 py-3 text-sm outline-none focus:border-emerald-300"
                  maxLength={50}
                  required
                  value={operationNumber}
                  disabled={busy}
                  onChange={(event) => setOperationNumber(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold">
                Comprobante de Yape
                <input
                  key={key}
                  aria-label="Comprobante de Yape"
                  className="max-w-full rounded-xl border border-white/15 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
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
                <span className="font-normal text-slate-400">
                  Imagen JPG, PNG o WebP, hasta 5 MB.
                </span>
              </label>
              <button
                className={`${action} w-full`}
                type="submit"
                disabled={busy || !file || !operationNumber.trim() || !canUpload}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                Enviar comprobante para revisión
              </button>
              <p className="text-center text-[11px] text-slate-400">
                Subir el comprobante no confirma el pago.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
