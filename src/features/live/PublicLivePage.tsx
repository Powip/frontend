"use client";
import { isLiveReadDenied } from "./liveService";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LiveProductImage, LiveReservationTimer, LiveCountdown } from "./LiveShared";
import LiveManualPaymentDialog from "./LiveManualPaymentDialog";
import { createLivePolling, type LivePollingController } from "./livePolling";
import LiveCheckoutDelivery from "./LiveCheckoutDelivery";
import { purchaseField } from "./LiveDeliveryForm";
import {
  getPublicLive,
  identifyLiveCustomer,
  lookupLiveCustomer,
  liveBuyerLabel,
  liveError,
  liveMoney,
  liveVisitorToken,
  platformNames,
  removePublicLiveReservation,
  reserveLiveProduct,
  resizeLiveReservation,
  safeLiveUrl,
} from "./liveService";
import type {
  LiveCheckoutSnapshot,
  LiveCustomer,
  LiveDelivery,
  LivePurchaseInput,
  LiveProduct,
  LivePublicData,
} from "./types";
const action =
  "min-h-11 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40";
const outline = "min-h-11 rounded-xl border border-white/20 px-4 py-3 text-sm disabled:opacity-40";
export default function PublicLivePage({ storeId }: { storeId: string }) {
  const [data, setData] = useState<LivePublicData | null>(null),
    [visitor, setVisitor] = useState("");
  const [customer, setCustomer] = useState<LiveCustomer>({
    name: "",
    phone: "",
  });
  const [knownPhone, setKnownPhone] = useState("");
  const [welcome, setWelcome] = useState(false),
    [cart, setCart] = useState(false),
    [pay, setPay] = useState(false);
  const [manual, setManual] = useState<LiveCheckoutSnapshot | null>(null),
    [manualId, setManualId] = useState<string | null>(null);
  const [deliveryDraft, setDeliveryDraft] = useState<{
    delivery: LiveDelivery;
    receipt: LivePurchaseInput["receipt"];
  } | null>(null);
  const [readError, setReadError] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const generation = useRef(0),
    lock = useRef(false),
    request = useRef(0),
    attempts = useRef(new Map<string, string>()),
    initialized = useRef(false);
  const pendingSelection = useRef<{
    product: LiveProduct;
    quantity: number;
  } | null>(null);
  const [returningPayment, setReturningPayment] = useState(false);
  const polling = useRef<LivePollingController | null>(null);
  const refresh = useCallback(async (_token: string) => {
    await polling.current?.refresh({ quiet: true, supersede: true });
  }, []);
  useEffect(() => {
    generation.current++;
    initialized.current = false;
    lock.current = false;
    pendingSelection.current = null;
    setBusy(false);
    setNotice("");
    setReadError("");
    setWelcome(false);
    setDeliveryDraft(null);
    setReturningPayment(
      ["payment_id", "collection_id", "payment_status", "livePayment"].some((key) =>
        new URLSearchParams(window.location.search).has(key),
      ),
    );
    const token = liveVisitorToken(storeId);
    setVisitor(token);
    setData(null);
    setCustomer({ name: "", phone: "" });
    setKnownPhone("");
    setError("");
    setPay(false);
    setCart(false);
    setManualId(null);
    setManual(null);
    attempts.current.clear();
    const reader = createLivePolling({
      load: (signal) => getPublicLive(storeId, token, signal),
      intervalMs: 5000,
      onData: (result) => {
        setData(result);
        if (result.customer) setCustomer(result.customer);
        if (!initialized.current) {
          setWelcome(!result.customer);
          initialized.current = true;
        }
        setReadError("");
      },
      onError: (cause) => {
        if (isLiveReadDenied(cause)) {
          setData(null);
          setPay(false);
          setManualId(null);
        }
        setReadError(liveError(cause));
      },
    });
    polling.current = reader;
    void reader.refresh({ quiet: false });
    return () => {
      generation.current++;
      reader.dispose();
      if (polling.current === reader) polling.current = null;
    };
  }, [storeId]);
  useEffect(() => {
    polling.current?.setPaused(pay || !!manualId || busy);
  }, [pay, manualId, busy]);
  useEffect(() => {
    let canceled = false;
    if (!welcome || !visitor || !/^9\d{8}$/.test(customer.phone)) return;
    const timer = setTimeout(() => {
      void lookupLiveCustomer(storeId, visitor, customer.phone)
        .then((result) => {
          if (canceled) return;
          if (result.known && result.name) {
            setKnownPhone(customer.phone);
            setCustomer((c) => ({ ...c, name: result.name! }));
          } else setKnownPhone("");
        })
        .catch(() => {
          if (!canceled) setKnownPhone("");
        });
    }, 250);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [customer.phone, storeId, visitor, welcome]);
  async function operate(key: string, work: (id: string) => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const epoch = generation.current;
    const id = attempts.current.get(key) || crypto.randomUUID();
    attempts.current.set(key, id);
    try {
      await work(id);
      if (epoch !== generation.current) return;
      attempts.current.delete(key);
      await refresh(visitor);
      return true;
    } catch (e) {
      if (epoch === generation.current) setError(liveError(e));
    } finally {
      if (epoch === generation.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function separate(product: LiveProduct, quantity: number, known = customer) {
    if (!known.name.trim() || !/^9\d{8}$/.test(known.phone)) {
      pendingSelection.current = { product, quantity };
      setWelcome(true);
      return;
    }
    const epoch = generation.current;
    await operate(`reserve:${product.variantId}:${quantity}:${known.phone}`, async (id) => {
      await reserveLiveProduct(storeId, visitor, {
        variantId: product.variantId,
        quantity,
        customer: { name: known.name, phone: known.phone },
        idempotencyKey: id,
      });
      if (epoch !== generation.current) return;
      setNotice(
        `✓ Separado: ${quantity} × ${product.name}${product.variantLabel ? ` (${product.variantLabel})` : ""}`,
      );
    });
  }
  async function identify() {
    if (!customer.name.trim() || !/^9\d{8}$/.test(customer.phone) || lock.current) return;
    const epoch = generation.current;
    const identified = await operate(`customer:${customer.phone}`, async () => {
      const result = await identifyLiveCustomer(storeId, visitor, {
        name: customer.name,
        phone: customer.phone,
      });
      if (epoch !== generation.current) return;
      setCustomer({
        ...result.customer,
        savedDelivery: result.delivery || undefined,
        savedReceipt: result.receipt || undefined,
      });
      setWelcome(false);
    });
    if (!identified) return;
    const selection = pendingSelection.current;
    if (selection) {
      pendingSelection.current = null;
      await separate(selection.product, selection.quantity);
    }
  }
  const reservations =
    data?.reservations.filter(
      (r) => ["ACTIVE", "PENDING"].includes(r.status) && !r.checkoutId && !r.reviewHold,
    ) || [];
  const units = reservations.reduce((n, r) => n + r.quantity, 0),
    subtotal = reservations.reduce((n, r) => n + r.quantity * r.unitPrice, 0);
  const timer = reservations.find((r) => r.expiresAt) || reservations[0];
  const groups = new Map<string, LiveProduct[]>();
  for (const p of data?.products || [])
    if (p.enabled) {
      const key = p.productId || p.variantId;
      groups.set(key, [...(groups.get(key) || []), p]);
    }
  const grouped = [...groups.values()].sort(
    (a, b) =>
      Number(b.some((p) => p.variantId === data?.session?.pinnedVariantId)) -
      Number(a.some((p) => p.variantId === data?.session?.pinnedVariantId)),
  );
  const closed =
    !data?.config.enabled || (data?.channel !== "WHATSAPP" && data?.session?.status === "CLOSED");
  const social =
    data?.channel !== "WHATSAPP" && data?.config.showBackLink
      ? safeLiveUrl(data.config.liveUrl)
      : null;
  const purchases = (data?.orders || [])
    .filter(
      (o, i, all) =>
        all.findIndex((p) => (p.orderNumber || p.id) === (o.orderNumber || o.id)) === i,
    )
    .slice(0, 5);
  return (
    <main className="min-h-dvh bg-[#100e1d] pb-32 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#171428]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">{data?.store.name || "POWIP"}</h1>
            <p className="text-xs text-slate-300">
              {data?.channel === "WHATSAPP"
                ? "Catálogo · POWIP Link"
                : data?.session?.status === "LIVE"
                  ? `En vivo en ${platformNames[data.session.platform]}`
                  : "Catálogo del live"}
            </p>
          </div>
          {social ? (
            <a className={outline} href={social} target="_blank" rel="noopener noreferrer">
              Volver al live ↗
            </a>
          ) : null}
        </div>
        <div className="mx-auto mt-2 flex max-w-3xl flex-wrap items-center justify-between gap-2 text-xs">
          {timer && data ? (
            <span>
              Tus prendas separadas{" "}
              <LiveReservationTimer reservation={timer} serverNow={data.serverNow} />
            </span>
          ) : null}
          {data?.channel !== "WHATSAPP" && data?.session?.closesAt ? (
            <span>
              Precios del live por{" "}
              <LiveCountdown expiresAt={data.session.closesAt} serverNow={data.serverNow} />
            </span>
          ) : null}
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-5 p-4">
        {returningPayment ? (
          <p role="status" className="p-4 text-sm">
            Estamos verificando el pago. Consulta el estado de tu pedido para ver la confirmación.
          </p>
        ) : null}
        {error || readError ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100"
          >
            {error || readError}
            <button className="ml-3 underline" onClick={() => void refresh(visitor)}>
              Actualizar
            </button>
          </div>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">
            {notice}
          </p>
        ) : null}
        {!data ? <p role="status">Cargando catálogo…</p> : null}
        {customer.name && data?.customer ? (
          <p className="text-sm text-slate-300">
            Hola, {customer.name}.{" "}
            {customer.savedDelivery
              ? "Tu entrega anterior está guardada."
              : "Tu pedido queda guardado en este celular."}
          </p>
        ) : null}
        {purchases.map((o) => (
          <article key={o.orderNumber || o.id} className="rounded-xl border border-white/15 p-4">
            <p className="text-xs text-slate-400">Tu compra · {o.orderNumber || "Pago iniciado"}</p>
            <p className="mt-1 font-semibold">
              {liveBuyerLabel(
                o.buyerStatus ||
                  (o.status === "ANULADO"
                    ? "CANCELLED"
                    : o.manualPayment?.status || o.paymentStatus),
              )}
            </p>
            <div className="mt-2 flex gap-3">
              {o.trackingUrl?.startsWith("/p/") ? (
                <a href={o.trackingUrl} className={outline}>
                  Ver mi pedido
                </a>
              ) : null}
              {o.method === "yape" &&
              o.checkoutId &&
              !["ANULADO", "CANCELLED"].includes(o.status) ? (
                <button
                  className={outline}
                  onClick={() => {
                    setManual(null);
                    setManualId(o.checkoutId!);
                  }}
                >
                  {o.manualPayment?.status === "REJECTED"
                    ? "Enviar otro comprobante"
                    : o.manualPayment?.status === "AWAITING_PROOF"
                      ? "Continuar pago"
                      : "Ver pago"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {closed ? (
          <p className="rounded-xl border border-white/20 p-5">
            El catálogo del live está cerrado. Puedes consultar tus pedidos arriba.
          </p>
        ) : (
          grouped.map((variants) => (
            <ProductCard
              key={`${storeId}/${variants[0].productId || variants[0].variantId}`}
              variants={variants}
              featured={variants.some((p) => p.variantId === data?.session?.pinnedVariantId)}
              busy={busy}
              maxCart={
                data?.isTrusted ? 10000 : Math.max(0, (data?.config.maxReservedUnits || 5) - units)
              }
              minutes={data?.config.reservationMinutes || 15}
              onSeparate={separate}
            />
          ))
        )}
        {data && !closed && !grouped.length ? (
          <p className="py-10 text-center text-slate-300">Todavía no hay prendas disponibles.</p>
        ) : null}
      </div>
      {units && data ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/15 bg-[#171428] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button className="flex-1 text-left" onClick={() => setCart(true)}>
              <span className="block text-xs text-slate-300">{units} prendas separadas</span>
              <span className="font-bold">Ver mi pedido · {liveMoney(subtotal)}</span>
            </button>
            <button
              className={action}
              disabled={busy || reservations.some((r) => r.status !== "ACTIVE")}
              onClick={() => setPay(true)}
            >
              Pagar →
            </button>
          </div>
        </div>
      ) : null}
      {welcome ? (
        <Dialog open onOpenChange={setWelcome}>
          <DialogContent className="border-white/15 bg-[#171428] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Bienvenida a {data?.store.name || "la tienda"}</DialogTitle>
              <DialogDescription className="text-slate-300">
                Guarda tus prendas con tu WhatsApp. Te lo pedimos una sola vez en este celular.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void identify();
              }}
              className="space-y-4"
            >
              <label className="block text-sm">
                WhatsApp
                <input
                  aria-label="WhatsApp"
                  className={purchaseField}
                  inputMode="tel"
                  autoComplete="tel-national"
                  maxLength={9}
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer((c) => ({
                      ...c,
                      phone: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
              </label>
              {knownPhone === customer.phone && knownPhone ? (
                <p className="text-emerald-200">¡Hola de nuevo, {customer.name}!</p>
              ) : customer.phone.length === 9 ? (
                <label className="block text-sm">
                  Nombre
                  <input
                    aria-label="Nombre"
                    className={purchaseField}
                    autoComplete="given-name"
                    maxLength={120}
                    value={customer.name}
                    onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                  />
                </label>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm text-rose-200">
                  {error}
                </p>
              ) : null}
              <button
                className={`${action} w-full`}
                disabled={busy || !customer.name.trim() || !/^9\d{8}$/.test(customer.phone)}
              >
                Entrar a comprar
              </button>
              <button
                type="button"
                className="min-h-11 w-full text-sm text-slate-300"
                onClick={() => setWelcome(false)}
              >
                Solo quiero mirar primero
              </button>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
      {cart && data ? (
        <Dialog open onOpenChange={setCart}>
          <DialogContent className="top-auto bottom-0 max-h-[90dvh] translate-y-0 overflow-y-auto rounded-t-3xl border-white/15 bg-[#171428] text-white sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
            <DialogHeader>
              <DialogTitle>Mi pedido</DialogTitle>
              <DialogDescription className="text-slate-300">
                Todo lo separado comparte el mismo tiempo.
              </DialogDescription>
            </DialogHeader>
            {timer ? <LiveReservationTimer reservation={timer} serverNow={data.serverNow} /> : null}
            {reservations.map((r) => (
              <article key={r.id} className="flex items-center gap-3 border-b border-white/10 py-3">
                {data.products.find((p) => p.variantId === r.variantId) ? (
                  <LiveProductImage
                    product={data.products.find((p) => p.variantId === r.variantId)!}
                    className="h-14 w-14 shrink-0"
                  />
                ) : null}
                <div className="flex-1">
                  <p className="font-semibold">{r.productName || r.name}</p>
                  <p className="text-sm text-slate-300">
                    {r.variantLabel ||
                      data.products.find((p) => p.variantId === r.variantId)?.variantLabel}{" "}
                    · {liveMoney(r.unitPrice)}
                  </p>
                  <button
                    className="min-h-11 text-sm text-rose-200"
                    disabled={busy}
                    onClick={() =>
                      void operate(`remove:${r.id}`, async () => {
                        await removePublicLiveReservation(storeId, visitor, r.id);
                      })
                    }
                  >
                    Quitar
                  </button>
                </div>
                <button
                  aria-label={`Restar ${r.productName || r.name}`}
                  className={outline}
                  disabled={busy || r.quantity <= 1}
                  onClick={() =>
                    void operate(`resize:${r.id}:${r.quantity - 1}`, async (key) => {
                      await resizeLiveReservation(storeId, visitor, r.id, r.quantity - 1, key);
                    })
                  }
                >
                  −
                </button>
                <span>{r.quantity}</span>
                <button
                  aria-label={`Sumar ${r.productName || r.name}`}
                  className={outline}
                  disabled={busy}
                  onClick={() =>
                    void operate(`resize:${r.id}:${r.quantity + 1}`, async (key) => {
                      await resizeLiveReservation(storeId, visitor, r.id, r.quantity + 1, key);
                    })
                  }
                >
                  +
                </button>
              </article>
            ))}
            <p className="text-xl font-bold">Productos · {liveMoney(subtotal)}</p>
            <button
              className={action}
              disabled={busy || !units}
              onClick={() => {
                setCart(false);
                setPay(true);
              }}
            >
              Continuar a entrega
            </button>
            <button className={outline} onClick={() => setCart(false)}>
              Seguir viendo productos
            </button>
          </DialogContent>
        </Dialog>
      ) : null}
      {pay && data ? (
        <LiveCheckoutDelivery
          storeId={storeId}
          visitor={visitor}
          customer={customer}
          draft={deliveryDraft}
          onDraft={setDeliveryDraft}
          reservations={reservations}
          options={data.deliveryOptions || []}
          methods={data.paymentMethods || []}
          onClose={() => setPay(false)}
          onYape={(s) => {
            setPay(false);
            setManual(s);
            setManualId(s.checkoutId);
            void refresh(visitor);
          }}
        />
      ) : null}
      {manualId ? (
        <LiveManualPaymentDialog
          key={manualId}
          storeId={storeId}
          visitor={visitor}
          checkoutId={manualId}
          initial={manual}
          onClose={() => setManualId(null)}
          onUpdated={() => void refresh(visitor)}
        />
      ) : null}
    </main>
  );
}
function ProductCard({
  variants,
  featured,
  busy,
  maxCart,
  minutes,
  onSeparate,
}: {
  variants: LiveProduct[];
  featured: boolean;
  busy: boolean;
  maxCart: number;
  minutes: number;
  onSeparate: (p: LiveProduct, q: number) => Promise<void>;
}) {
  const [selection, setSelection] = useState<Record<string, string>>({}),
    [quantity, setQuantity] = useState(1);
  const keys = [...new Set(variants.flatMap((p) => Object.keys(p.attributes || {})))];
  const selected = variants.find(
    (p) =>
      keys.every((k) => selection[k] && p.attributes?.[k] === selection[k]) &&
      (keys.length > 0 || variants.length === 1),
  );
  const [fallback, setFallback] = useState("");
  const product = selected || variants.find((p) => p.variantId === fallback),
    display = product || variants[0];
  const missing = keys.find((k) => !selection[k]);
  const maximum = product
    ? Math.min(
        product.availableStock,
        product.remainingLimit ?? product.maxPerCustomer ?? 10000,
        maxCart,
      )
    : 0;
  const reason = missing
    ? `Elige ${missing.toLowerCase()}`
    : !product
      ? "Elige tu talla o color"
      : product.availableStock === 0
        ? "Agotado"
        : product.remainingLimit === 0
          ? "Máximo por cliente alcanzado"
          : maxCart === 0
            ? "Máximo de prendas separadas alcanzado"
            : quantity > maximum
              ? `Quedan ${maximum} disponibles para separar`
              : "";
  const discount =
    display.regularPrice > display.livePrice
      ? Math.round((1 - display.livePrice / display.regularPrice) * 100)
      : 0;
  return (
    <article
      aria-label={display.name}
      className={`overflow-hidden rounded-2xl border ${featured ? "border-emerald-400/50" : "border-white/10"} bg-[#1a172a]`}
    >
      {featured ? (
        <p className="bg-emerald-400/10 p-3 text-sm font-semibold text-emerald-200">
          📌 Lo que muestran ahora en el live
        </p>
      ) : null}
      <LiveProductImage product={display} className="aspect-[4/3] w-full !rounded-none" />
      <div className="space-y-4 p-4">
        <h2 className="text-xl font-bold">{display.name}</h2>
        <p className="flex flex-wrap items-center gap-3">
          <strong className="text-2xl text-emerald-300">{liveMoney(display.livePrice)}</strong>
          {discount ? (
            <>
              <s className="text-sm text-slate-400">{liveMoney(display.regularPrice)}</s>
              <span className="text-xs text-emerald-200">−{discount}% en el live</span>
            </>
          ) : null}
        </p>
        {keys.map((k, i) => (
          <fieldset key={k}>
            <legend className="mb-2 text-sm font-semibold">{k}</legend>
            <div className="flex flex-wrap gap-2">
              {[...new Set(variants.map((p) => p.attributes?.[k]).filter(Boolean))].map((v) => {
                const available = variants.some(
                  (p) =>
                    p.attributes?.[k] === v &&
                    p.availableStock > 0 &&
                    keys
                      .slice(0, i)
                      .every(
                        (previous) =>
                          !selection[previous] || p.attributes?.[previous] === selection[previous],
                      ),
                );
                return (
                  <button
                    type="button"
                    key={v}
                    className={`${outline} ${selection[k] === v ? "border-emerald-300 bg-emerald-400/10" : ""} ${!available ? "line-through" : ""}`}
                    aria-pressed={selection[k] === v}
                    disabled={!available || busy}
                    onClick={() => {
                      setSelection(
                        Object.fromEntries([
                          ...Object.entries(selection).filter(([key]) => keys.indexOf(key) < i),
                          [k, v!],
                        ]),
                      );
                      setQuantity(1);
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        {!keys.length && variants.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.variantId}
                className={outline}
                disabled={!v.availableStock || busy}
                aria-pressed={fallback === v.variantId}
                onClick={() => {
                  setFallback(v.variantId);
                  setQuantity(1);
                }}
              >
                {v.variantLabel || v.sku}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            className={outline}
            aria-label={`Restar cantidad de ${display.name}`}
            disabled={quantity <= 1 || busy}
            onClick={() => setQuantity((q) => q - 1)}
          >
            −
          </button>
          <span className="w-6 text-center">{quantity}</span>
          <button
            className={outline}
            aria-label={`Sumar cantidad de ${display.name}`}
            disabled={quantity >= maximum || busy}
            onClick={() => setQuantity((q) => q + 1)}
          >
            +
          </button>
          <button
            className={`${action} flex-1`}
            disabled={busy || !!reason || quantity > maximum}
            onClick={() => {
              if (product) void onSeparate(product, quantity);
            }}
          >
            {reason || `Separar · ${liveMoney(display.livePrice * quantity)}`}
          </button>
        </div>
        <p className="text-xs text-slate-300">
          {product && product.availableStock < 4 ? `¡Quedan ${product.availableStock}! · ` : ""}
          Te lo guardamos {minutes} min
          {display.maxPerCustomer ? ` · Máx. ${display.maxPerCustomer} por cliente` : ""}
        </p>
      </div>
    </article>
  );
}
