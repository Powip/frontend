"use client";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LiveDeliveryForm, { deliveryError } from "./LiveDeliveryForm";
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
  const subtotal = reservations.reduce((n, r) => n + r.quantity * r.unitPrice, 0);
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
      if (alive.current) setError(liveError(e));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[94dvh] overflow-y-auto border-white/15 bg-[#171428] text-slate-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>1 Entrega · 2 Paga · 3 Confirma</DialogTitle>
          <DialogDescription className="text-slate-300">
            Elige dónde recibir tu pedido.
          </DialogDescription>
        </DialogHeader>
        {saved ? (
          <div className="rounded-xl border border-emerald-300/30 p-4">
            <p>Enviar a {delivery.address || delivery.agency}</p>
            <p className="text-sm text-slate-300">
              {delivery.district}, {delivery.province}, {delivery.department}
            </p>
            <button className="mt-2 min-h-11 text-emerald-300" onClick={() => setSaved(false)}>
              Cambiar entrega
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
          <p role="alert" className="text-sm text-rose-200">
            {error}
          </p>
        ) : invalid ? (
          <p className="text-sm text-slate-300">{invalid}</p>
        ) : null}
        {quote?.combinedOrderNumber ? (
          <p className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">
            Se suma a {quote.combinedOrderNumber}. No pagas envío otra vez.
          </p>
        ) : null}
        <footer className="sticky -bottom-6 space-y-3 border-t border-white/15 bg-[#171428] py-4">
          <p className="flex justify-between text-sm">
            <span>Productos {liveMoney(subtotal)}</span>
            <span>Envío {quote ? liveMoney(quote.shipping) : "según entrega"}</span>
          </p>
          <p className="flex justify-between text-xl font-bold">
            <span>Total</span>
            <span>
              {liveMoney(quote?.total ?? subtotal)}
              {!quote ? " + envío" : ""}
            </span>
          </p>
          {quoting ? (
            <p role="status" className="text-sm">
              Actualizando total…
            </p>
          ) : null}
          {methods.map((m) => (
            <button
              key={m}
              className="min-h-12 w-full rounded-xl bg-emerald-400 p-3 font-bold text-slate-950 disabled:opacity-40"
              disabled={busy || quoting || !quote || !!invalid}
              onClick={() => void proceed(m)}
            >
              {busy ? "Guardando…" : m === "yape" ? "Continuar a Yape →" : "Pagar con Mercado Pago"}
            </button>
          ))}
          {!methods.length ? (
            <p className="text-sm text-amber-200">
              La tienda todavía no habilitó un medio de pago.
            </p>
          ) : null}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
