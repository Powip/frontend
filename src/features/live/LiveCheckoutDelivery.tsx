"use client";
import { useEffect, useRef, useState } from "react";
import LivePayFrame, { COURIER_NAMES, LivePayTotal, payCta, payGhost, payTiny } from "./LivePayFrame";
import LiveDeliveryForm, { deliveryError } from "./LiveDeliveryForm";
import { livePromoSummary } from "./LivePromos";
import {
  checkoutLivePurchase,
  liveError,
  liveMoney,
  quoteLivePurchase,
  safeLiveUrl,
} from "./liveService";
import type {
  LiveCheckoutSnapshot,
  LiveCustomer,
  LiveDelivery,
  LivePaymentMethod,
  LivePurchaseInput,
  LiveQuote,
  LiveReservation,
  StoreDeliveryOption,
} from "./types";
export default function LiveCheckoutDelivery({
  storeId,
  visitor,
  customer,
  draft,
  onDraft,
  reservations,
  promoDiscount = 0,
  options,
  methods,
  onClose,
  onYape,
}: {
  storeId: string;
  visitor: string;
  customer: LiveCustomer;
  draft?: { delivery: LiveDelivery; receipt: LivePurchaseInput["receipt"] } | null;
  onDraft?: (value: { delivery: LiveDelivery; receipt: LivePurchaseInput["receipt"] }) => void;
  reservations: LiveReservation[];
  /** FEAT-33 L7b: descuento del volumen del live en el carrito, hasta que llegue la cotización. */
  promoDiscount?: number;
  options: StoreDeliveryOption[];
  methods: LivePaymentMethod[];
  onClose: () => void;
  onYape: (s: LiveCheckoutSnapshot) => void;
}) {
  const [delivery, setDelivery] = useState<LiveDelivery>(
    draft?.delivery || customer.savedDelivery || { type: "AGENCY", courier: "SHALOM" },
  );
  const [receipt, setReceipt] = useState<LivePurchaseInput["receipt"]>(
    draft?.receipt || customer.savedReceipt || { type: "BOLETA" },
  );
  const [quote, setQuote] = useState<LiveQuote | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [quoting, setQuoting] = useState(false);
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null);
  const [saved, setSaved] = useState(!!customer.savedDelivery);
  const lock = useRef(false),
    alive = useRef(true),
    attempt = useRef<{ body: string; key: string } | null>(null);
  const subtotal =
    Math.round((reservations.reduce((n, r) => n + r.quantity * r.unitPrice, 0) - promoDiscount) * 100) / 100;
  const fingerprint = JSON.stringify({
    customer: { name: customer.name, phone: customer.phone },
    reservationIds: reservations.map((r) => r.id),
    delivery,
    receipt,
  });
  useEffect(() => {
    onDraft?.({ delivery, receipt });
  }, [delivery, receipt, onDraft]);
  const invalid = deliveryError(delivery, receipt, quote?.total ?? receiptTotal ?? subtotal);
  useEffect(() => {
    if (invalid) setSaved(false);
  }, [invalid]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let canceled = false;
    setQuote(null);
    setError("");
    const input = JSON.parse(fingerprint);
    if (deliveryError(input.delivery, input.receipt, subtotal)) {
      setQuoting(false);
      return;
    }
    setQuoting(true);
    const timer = setTimeout(() => {
      void quoteLivePurchase(storeId, visitor, {
        ...input,
        items: [],
      })
        .then((q) => {
          if (!canceled) {
            setQuote(q);
            setReceiptTotal(q.total);
          }
        })
        .catch((e) => {
          if (!canceled) {
            const payload = (e as { response?: { data?: { code?: string; total?: number } } })
              .response?.data;
            if (payload?.code === "SHIPPING_NOT_CONFIGURED") setSaved(false);
            if (
              payload?.code === "RECEIPT_DNI_REQUIRED" &&
              typeof payload.total === "number" &&
              Number.isFinite(payload.total)
            ) {
              setReceiptTotal(payload.total);
              setSaved(false);
            }
            setError(liveError(e));
          }
        })
        .finally(() => {
          if (!canceled) setQuoting(false);
        });
    }, 250);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [fingerprint, storeId, visitor, subtotal]);
  async function proceed(method: LivePaymentMethod) {
    if (!quote || invalid || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const body = fingerprint + method + quote.quoteId;
    const key = attempt.current?.body === body ? attempt.current.key : crypto.randomUUID();
    attempt.current = { body, key };
    try {
      const result = await checkoutLivePurchase(storeId, visitor, {
        ...JSON.parse(fingerprint),
        items: [],
        method,
        idempotencyKey: key,
        quoteId: quote.quoteId,
      });
      if (!alive.current) return;
      if (method === "yape" && result.checkoutId) onYape(result as LiveCheckoutSnapshot);
      else {
        const url = safeLiveUrl(result.paymentUrl || result.checkoutUrl);
        if (!url) throw new Error("No se pudo abrir la pasarela de pago.");
        window.location.assign(url);
      }
    } catch (e) {
      if (alive.current) {
        if (
          (e as { response?: { data?: { code?: string } } }).response?.data?.code ===
          "SHIPPING_NOT_CONFIGURED"
        ) {
          setSaved(false);
          setQuote(null);
        }
        setError(liveError(e));
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  // FEAT-33 L7b: con la cotización, las prendas compradas (sin el regalo), el descuento y el regalo.
  const summary = quote ? livePromoSummary(quote.items) : null;
  const units = summary?.units || reservations.reduce((n, r) => n + r.quantity, 0);
  const home = delivery.type === "HOME";
  const courierName = COURIER_NAMES[delivery.courier || ""] || delivery.courier || "";
  const shippingText = !quote
    ? "Envío según entrega"
    : quote.combinedOrderNumber
      ? "Envío ya pagado hoy"
      : `Envío ${liveMoney(quote.shipping)} · ${home ? "domicilio" : courierName}`;
  return (
    <LivePayFrame
      title="¿Dónde te lo enviamos?"
      description="Paso 1 de 3: elige dónde recibir tu pedido."
      step={1}
      onBack={onClose}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <LivePayTotal
            units={units}
            products={quote ? quote.subtotal : subtotal}
            discount={summary ? summary.discount : promoDiscount}
            gift={summary?.gift}
            shipping={shippingText}
            total={quote ? liveMoney(quote.total) : `${liveMoney(subtotal)} + envío`}
          />
          {quoting ? (
            <p role="status" className={payTiny}>
              Actualizando total…
            </p>
          ) : null}
          {methods.map((m, index) => (
            <button
              key={m}
              className={index === 0 ? payCta : payGhost}
              disabled={busy || quoting || !quote || !!invalid}
              onClick={() => void proceed(m)}
            >
              {busy
                ? "Guardando…"
                : m === "yape"
                  ? quote
                    ? `Continuar · ${liveMoney(quote.total)}`
                    : "Continuar"
                  : "Pagar con Mercado Pago"}
            </button>
          ))}
          {!methods.length ? (
            <p className="text-sm text-[var(--b-warn)]">
              La tienda todavía no habilitó un medio de pago.
            </p>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {quote?.combinedOrderNumber ? (
          <p className="rounded-xl bg-[var(--b-ok-bg)] p-3 text-[13px] leading-relaxed text-[var(--b-ok)]">
            📦 Se suma a tu envío de hoy ({quote.combinedOrderNumber}).{" "}
            <b>No pagas envío otra vez.</b>
          </p>
        ) : null}
        {saved ? (
          <div
            data-testid="saved-delivery"
            className="flex items-start gap-3 rounded-2xl border-[1.5px] border-[var(--acc)] bg-[var(--b-card)] p-3.5"
          >
            <div className="min-w-0 flex-1 space-y-0.5 text-sm">
              <small className="block text-xs text-[var(--b-mut)]">
                {home ? "🛵 Enviar a domicilio" : `🏢 Recoger en agencia ${courierName}`}
              </small>
              <b className="block text-[15px]">{home ? delivery.address : delivery.agency}</b>
              <span className="block text-[var(--b-mut)]">
                {delivery.district}, {delivery.province} · {delivery.department}
              </span>
              {home && delivery.reference ? (
                <span className="block text-[var(--b-mut)]">Ref.: {delivery.reference}</span>
              ) : null}
              {home && delivery.lat ? (
                <span className="block text-[var(--b-mut)]">📍 Con ubicación</span>
              ) : null}
              <span className="block text-[var(--b-mut)]">
                Recibe: {customer.name} · {customer.phone}
              </span>
            </div>
            <button
              type="button"
              aria-label="Cambiar entrega"
              className="min-h-11 shrink-0 px-2 text-sm font-semibold text-[var(--acc-tx)]"
              onClick={() => setSaved(false)}
            >
              Cambiar
            </button>
          </div>
        ) : (
          <LiveDeliveryForm
            delivery={delivery}
            receipt={receipt}
            options={options}
            total={quote?.total ?? receiptTotal ?? subtotal}
            name={customer.name}
            onDelivery={setDelivery}
            onReceipt={setReceipt}
          />
        )}
        {error ? (
          <p role="alert" className="rounded-xl bg-[var(--b-bad-bg)] p-3 text-sm text-[var(--b-err)]">
            {error}
          </p>
        ) : invalid ? (
          <p className="text-sm text-[var(--b-mut)]">{invalid}</p>
        ) : null}
      </div>
    </LivePayFrame>
  );
}
