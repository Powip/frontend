"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { createLivePolling, type LivePollingController } from "./livePolling";
import { isLiveReadDenied } from "./liveService";
import LivePayFrame, {
  COURIER_NAMES,
  LivePayTotal,
  payCta,
  payLabel,
  payLink,
  payTiny,
} from "./LivePayFrame";
import { livePromoSummary } from "./LivePromos";
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
import type { LiveCheckoutSnapshot } from "./types";
export default function LiveManualPaymentDialog({
  storeId,
  visitor,
  checkoutId,
  initial,
  storeName,
  continueLabel = "Seguir comprando",
  combineShipping = false,
  showTrackingLink = true,
  onClose,
  onUpdated,
}: {
  storeId: string;
  visitor: string;
  checkoutId: string;
  initial?: LiveCheckoutSnapshot | null;
  /** Nombre que ve el cliente (apariencia), para «… lo valida y te avisa por WhatsApp». */
  storeName?: string;
  continueLabel?: string;
  /** La tienda suma las compras del día al mismo envío. */
  combineShipping?: boolean;
  /** En la página del pedido no hace falta «Ver mi pedido». */
  showTrackingLink?: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const formId = useId();
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
  const close = () => {
    if (!busy) onClose();
  };
  // FEAT-33 L7b: el regalo no es una prenda comprada; el resumen muestra la promo y el regalo.
  const promo = livePromoSummary(snapshot?.quote?.items);
  const units = promo.units || null;
  const combined = !!snapshot?.quote?.combinedOrderNumber;
  const shippingText = combined
    ? "Envío ya pagado hoy"
    : `Envío ${liveMoney(snapshot?.quote?.shipping || 0)}${
        snapshot?.delivery?.type === "HOME"
          ? " · domicilio"
          : snapshot?.delivery?.courier
            ? ` · ${COURIER_NAMES[snapshot.delivery.courier] || snapshot.delivery.courier}`
            : ""
      }`;
  const firstName = snapshot?.customer?.name?.trim().split(/\s+/)[0] || "";
  const trackingUrl =
    showTrackingLink && snapshot?.trackingUrl?.startsWith("/p/") ? snapshot.trackingUrl : null;
  const banners = (
    <>
      {error ? (
        <p role="alert" className="rounded-xl bg-[var(--b-bad-bg)] p-3 text-sm text-[var(--b-err)]">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-[var(--acc-tx)]">
          {notice}
        </p>
      ) : null}
    </>
  );
  if (snapshot && status === "UNDER_REVIEW")
    return (
      <LivePayFrame
        title={firstName ? `¡Listo, ${firstName}!` : "¡Listo!"}
        description="Recibimos tu comprobante de Yape."
        onClose={close}
        icon={
          <span
            aria-hidden="true"
            className="mx-auto mt-4 mb-2.5 grid h-[76px] w-[76px] place-items-center rounded-full bg-[var(--b-ok-bg)] text-[38px] text-[var(--b-ok)]"
          >
            ✓
          </span>
        }
      >
        <div className="w-full space-y-4">
          {banners}
          <p className="text-[15px] leading-relaxed text-[var(--b-mut)]">
            Recibimos tu Yape de <b className="text-[var(--b-ink)]">{liveMoney(total || 0)}</b>.{" "}
            {storeName || "El negocio"} lo valida y te avisa por WhatsApp. Tus prendas siguen separadas.
          </p>
          <dl
            data-testid="done-summary"
            className="grid gap-2 rounded-2xl border border-[var(--b-line)] bg-[var(--b-card)] p-3.5 text-left text-sm"
          >
            {snapshot.orderNumber ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--b-mut)]">Pedido</dt>
                <dd className="font-bold">{snapshot.orderNumber}</dd>
              </div>
            ) : null}
            {units ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--b-mut)]">{combined ? "Se sumó a tu envío" : "Prendas"}</dt>
                <dd className="font-bold">{units}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--b-mut)]">Estado</dt>
              <dd className="rounded-full bg-[var(--b-warn-bg)] px-2.5 py-1 text-xs font-bold text-[var(--b-warn)]">
                Validando tu pago
              </dd>
            </div>
          </dl>
          <button className={payCta} onClick={close}>
            {continueLabel}
          </button>
          {trackingUrl ? (
            <a href={trackingUrl} className={payLink}>
              Ver mi pedido
            </a>
          ) : null}
          {combineShipping ? (
            <p className={payTiny}>Si vuelves a comprar hoy, se suma al mismo envío.</p>
          ) : null}
        </div>
      </LivePayFrame>
    );
  if (snapshot && terminal)
    return (
      <LivePayFrame title={liveBuyerLabel(status)} description="Estado de tu pago." onClose={close}>
        <div className="w-full space-y-4">
          {banners}
          <p className="text-3xl font-bold text-[var(--acc-tx)]">{liveMoney(total || 0)}</p>
          <p className="text-sm text-[var(--b-mut)]">
            {status === "APPROVED"
              ? "El negocio confirmó el ingreso de tu pago."
              : status === "CANCELLED"
                ? "Este pedido fue anulado."
                : "Consulta el estado de tu pedido o contacta al negocio."}
          </p>
          <button className={payCta} onClick={close}>
            {continueLabel}
          </button>
          {trackingUrl ? (
            <a href={trackingUrl} className={payLink}>
              Ver mi pedido
            </a>
          ) : null}
        </div>
      </LivePayFrame>
    );
  const confirming = step === 3 || status === "REJECTED";
  const footer =
    snapshot && hasAmount ? (
      <>
        <LivePayTotal
          units={units}
          products={snapshot.quote?.subtotal || 0}
          discount={promo.discount}
          gift={promo.gift}
          shipping={shippingText}
          total={liveMoney(total!)}
        />
        {confirming ? (
          <button
            type="submit"
            form={formId}
            className={payCta}
            disabled={busy || !/^\d{4,12}$/.test(operation)}
          >
            {busy ? "Enviando…" : status === "REJECTED" ? "Enviar otro comprobante" : "Confirmar pago"}
          </button>
        ) : (
          <button className={payCta} onClick={() => setStep(3)}>
            Ya yapeé →
          </button>
        )}
      </>
    ) : null;
  return (
    <LivePayFrame
      title={confirming ? "Confirma tu pago" : "Paga con Yape"}
      description={
        snapshot?.orderNumber
          ? `Pedido ${snapshot.orderNumber}: paga con Yape y confirma tu pago.`
          : "Paga con Yape y confirma tu pago."
      }
      step={confirming ? 3 : 2}
      backLabel={confirming && status !== "REJECTED" ? "Atrás" : "Cerrar"}
      onBack={confirming && status !== "REJECTED" ? () => setStep(2) : close}
      onClose={close}
      busy={busy}
      footer={footer}
    >
      <div className="space-y-4">
        {banners}
        {!snapshot ? (
          <p>Cargando pago…</p>
        ) : !hasAmount ? (
          <p role="alert">
            No pudimos confirmar el monto. Actualiza el pedido antes de realizar el Yape.
          </p>
        ) : (
          <>
            {status === "REJECTED" ? (
              <div className="rounded-xl border border-[var(--b-bad)] bg-[var(--b-bad-bg)] p-3">
                <h3 className="font-bold text-[var(--b-bad)]">Pago no validado</h3>
                <p className="mt-1 text-sm">{manual?.reason || manual?.rejectionReason}</p>
                <p className="mt-2 text-xs text-[var(--b-mut)]">
                  Revisa la operación y envía otro comprobante para el mismo pedido.
                </p>
              </div>
            ) : null}
            {!confirming ? (
              <>
                <div className="rounded-[22px] bg-[linear-gradient(160deg,#742284,#4c1660)] p-5 text-center text-white">
                  <p className="text-xl font-extrabold tracking-wide opacity-95">yape</p>
                  <p className="mt-1.5 mb-0.5 text-[38px] font-bold">{liveMoney(total!)}</p>
                  <p className="text-base">
                    al <b>{yapePhone(manual?.phone)}</b>
                  </p>
                  <p className="text-[13px] opacity-80">{manual?.holder}</p>
                  <div className="mt-3.5 grid grid-cols-2 gap-2">
                    <button
                      className="min-h-11 rounded-xl bg-white/15 px-3 text-sm font-bold"
                      onClick={() => void copy(manual?.phone || "")}
                    >
                      Copiar número
                    </button>
                    <button
                      className="min-h-11 rounded-xl bg-white/15 px-3 text-sm font-bold"
                      onClick={() => void copy(total!.toFixed(2))}
                    >
                      Copiar monto
                    </button>
                  </div>
                  {qr ? (
                    <button
                      className="mt-2.5 min-h-11 text-sm font-semibold underline"
                      aria-expanded={showQr}
                      onClick={() => setShowQr((v) => !v)}
                    >
                      {showQr ? "Ocultar QR" : "Ver QR"}
                    </button>
                  ) : null}
                  {showQr && qr ? (
                    <Image
                      src={qr}
                      alt="QR Yape del negocio"
                      width={220}
                      height={220}
                      unoptimized
                      className="mx-auto mt-2 rounded-xl bg-white p-3"
                    />
                  ) : null}
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-[14.5px] leading-relaxed text-[var(--b-ink2)]">
                  <li>
                    Abre tu app de <b>Yape</b> y yapea <b>{liveMoney(total!)}</b> al número de arriba.
                  </li>
                  <li>
                    Guarda el <b>número de operación</b> que te muestra Yape.
                  </li>
                  <li>
                    Vuelve aquí y toca <b>Ya yapeé</b>.
                  </li>
                </ol>
                <p className={payTiny}>Tus prendas siguen separadas mientras pagas.</p>
                {manual?.proofDeadlineAt && status === "AWAITING_PROOF" ? (
                  <p className="flex items-center justify-between text-xs text-[var(--b-mut)]">
                    Tiempo para enviar tu comprobante{" "}
                    <LiveCountdown
                      expiresAt={manual.proofDeadlineAt}
                      serverNow={snapshot.serverNow || new Date().toISOString()}
                    />
                  </p>
                ) : null}
              </>
            ) : (
              <form
                id={formId}
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                {status !== "REJECTED" ? (
                  <p className="rounded-[14px] bg-[var(--b-pur-bg)] px-3.5 py-3 text-sm text-[var(--b-pur)]">
                    Yapeaste <b>{liveMoney(total!)}</b> a {manual?.holder}
                  </p>
                ) : null}
                <label htmlFor={`${formId}-op`} className={payLabel}>
                  Número de operación
                </label>
                <input
                  id={`${formId}-op`}
                  aria-label="Número de operación Yape"
                  className="min-h-14 w-full rounded-[14px] border-[1.5px] border-[var(--b-line)] bg-[var(--b-in)] p-3.5 text-center text-2xl font-semibold tracking-[.08em] text-[var(--b-ink)] outline-none focus:border-[var(--acc)]"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej: 01234567"
                  maxLength={12}
                  minLength={4}
                  pattern="[0-9]{4,12}"
                  required
                  value={operation}
                  onChange={(e) => setOperation(e.target.value.replace(/\D/g, ""))}
                  disabled={busy}
                />
                <p className={`${payTiny} mt-1.5`}>
                  Está en el comprobante de Yape, debajo del monto (de 4 a 12 dígitos).
                </p>
                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-[var(--b-line2)] p-3.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--acc)]">
                  <span aria-hidden="true" className="text-2xl">
                    📷
                  </span>
                  <span className="min-w-0 text-sm">
                    <b className="block">{file ? "Captura lista ✓" : "Subir captura del Yape"}</b>
                    <small className="block truncate text-xs text-[var(--b-mut)]">
                      {file ? file.name : "Opcional · ayuda a validar más rápido"}
                    </small>
                  </span>
                  <input
                    aria-label="Comprobante de Yape"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    className="sr-only"
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
              </form>
            )}
          </>
        )}
      </div>
    </LivePayFrame>
  );
}

/** «912345678» → «912 345 678», como en Yape. */
function yapePhone(phone?: string) {
  return (phone || "").replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
}
