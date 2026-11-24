"use client";
import { isLiveReadDenied } from "./liveService";
import { isValidMobilePhone, normalizePhone } from "@/lib/phone";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LiveProductImage, LiveReservationTimer, LiveCountdown } from "./LiveShared";
import { LiveLogo, useLiveBodyLook } from "./LiveBrand";
import { liveAppearance, liveAppearanceStyle } from "./liveAppearance";
import LiveManualPaymentDialog from "./LiveManualPaymentDialog";
// FEAT-32 M7: la vitrina muestra el contenido del producto (foto, título y «Ver detalle»).
import LiveProductDetailDialog, { groupContent } from "./LiveProductDetailDialog";
import { createLivePolling, type LivePollingController } from "./livePolling";
import LiveCheckoutDelivery from "./LiveCheckoutDelivery";
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
// FEAT-33 B5: todo color sale de las variables de la apariencia (`liveAppearanceStyle`).
const cta =
  "min-h-[52px] w-full rounded-2xl bg-[var(--acc)] p-4 text-[17px] font-bold text-[var(--acc-ink)] disabled:bg-[var(--b-dis)] disabled:text-[var(--b-dis-ink)]";
const ghost =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] px-4 py-2.5 text-sm font-semibold text-[var(--b-ink)] disabled:opacity-40";
const chip =
  "min-h-11 min-w-[50px] rounded-xl border-[1.5px] border-[var(--b-line)] bg-[var(--b-in)] px-3.5 py-2.5 text-sm font-medium text-[var(--b-ink)] aria-pressed:border-[var(--acc)] aria-pressed:bg-[var(--acc-soft)] aria-pressed:font-bold aria-pressed:text-[var(--acc-tx)] disabled:opacity-35";
const stepper = "h-9 w-9 text-base disabled:opacity-30";
const label = "block text-[13px] font-semibold text-[var(--b-ink2)]";
const bigField =
  "mt-1.5 w-full rounded-[14px] border-[1.5px] border-[var(--b-line)] bg-[var(--b-in)] px-3.5 py-[15px] text-[17px] text-[var(--b-ink)] outline-none focus:border-[var(--acc)]";
const tiny = "text-center text-xs leading-normal text-[var(--b-mut)] mt-3";
const banner = "mx-4 mt-3 rounded-2xl bg-[var(--acc-soft)] px-3.5 py-3 text-[13.5px] text-[var(--b-ink)]";
const pill = {
  live: "inline-flex items-center gap-1.5 rounded-full bg-[var(--b-live-bg)] px-3 py-1 text-xs font-bold text-[var(--b-live)]",
  purple: "rounded-full bg-[var(--b-pur-bg)] px-3 py-1 text-xs font-semibold text-[var(--b-pur)]",
};
const sheet =
  "top-auto bottom-0 max-h-[90dvh] translate-y-0 overflow-y-auto rounded-t-3xl border-[var(--b-line)] bg-[var(--b-bg)] text-[var(--b-ink)] sm:top-1/2 sm:bottom-auto sm:max-w-[430px] sm:-translate-y-1/2";
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
  const [detail, setDetail] = useState<LiveProduct[] | null>(null);
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
    setDetail(null);
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
    if (!welcome || !visitor || !isValidMobilePhone(customer.phone)) return;
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
    if (!known.name.trim() || !isValidMobilePhone(known.phone)) {
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
    if (!customer.name.trim() || !isValidMobilePhone(customer.phone) || lock.current) return;
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
  const look = liveAppearance(data?.config.appearance, data?.store.name || "POWIP");
  const lookStyle = liveAppearanceStyle(look);
  useLiveBodyLook(lookStyle);
  const whatsapp = data?.channel === "WHATSAPP";
  const live = data?.session?.status === "LIVE";
  const platform = data?.session ? platformNames[data.session.platform] : "";
  return (
    <main
      data-testid="live-buyer"
      data-theme={look.theme}
      style={lookStyle}
      className="flex min-h-dvh justify-center bg-[var(--b-out)] sm:py-[18px]"
    >
      <div className="relative flex min-h-dvh w-full max-w-[430px] flex-col bg-[var(--b-bg)] text-[var(--b-ink)] sm:min-h-[calc(100dvh-36px)] sm:rounded-[28px] sm:shadow-[0_0_0_1px_var(--b-line),0_30px_80px_-30px_#000]">
        <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-[var(--b-line)] bg-[var(--b-bg)] px-4 py-3.5 sm:rounded-t-[28px]">
          <LiveLogo look={look} />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[15px]">{look.displayName}</b>
            <small className="flex items-center gap-1.5 text-xs text-[var(--b-mut)]">
              {whatsapp ? (
                "💬 Catálogo por WhatsApp"
              ) : live ? (
                <>
                  <i
                    aria-hidden="true"
                    className="inline-block h-[7px] w-[7px] rounded-full bg-[#ff4d6d] motion-safe:animate-pulse"
                  />
                  En vivo en {platform}
                </>
              ) : data?.session?.status === "ENDED" ? (
                "Live terminado"
              ) : (
                "Catálogo del live"
              )}
            </small>
          </div>
          {social ? (
            <a
              className="shrink-0 rounded-full border border-[var(--b-line)] bg-[var(--b-card)] px-3 py-2 text-xs font-semibold"
              href={social}
              target="_blank"
              rel="noopener noreferrer"
            >
              Volver al live ↗
            </a>
          ) : null}
        </header>
        {returningPayment ? (
          <p role="status" className={banner}>
            Estamos verificando el pago. Consulta el estado de tu pedido para ver la confirmación.
          </p>
        ) : null}
        {welcome && readError ? (
          <div role="alert" className={`${banner} bg-[var(--b-bad-bg)] text-[var(--b-bad)]`}>
            {readError}
            <button className="ml-3 font-semibold underline" onClick={() => void refresh(visitor)}>
              Actualizar
            </button>
          </div>
        ) : null}
        {welcome ? (
          <section className="px-4 pb-6 pt-5">
            <div className="flex flex-wrap gap-2">
              {whatsapp ? (
                <span className={pill.purple}>💬 Catálogo por WhatsApp</span>
              ) : (
                <>
                  <span className={pill.live}>
                    <i aria-hidden="true" className="inline-block h-[7px] w-[7px] rounded-full bg-current" />
                    {live ? `EN VIVO · ${platform}` : "Live terminado"}
                  </span>
                  <span className={pill.purple}>Precios del live</span>
                </>
              )}
            </div>
            <h1 className="mb-2 mt-3.5 text-[27px] font-bold leading-tight [text-wrap:balance]">
              {whatsapp ? "Elige, separa y paga desde tu celular" : "Compra lo que ves en el live"}
            </h1>
            <p className="leading-relaxed text-[var(--b-mut)]">
              Déjanos tu WhatsApp una sola vez. Luego solo eliges, separas y pagas con Yape.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void identify();
              }}
              className="mt-5 rounded-[20px] border border-[var(--b-line)] bg-[var(--b-card)] p-[18px]"
            >
              <label htmlFor="live-welcome-phone" className={label}>
                Tu WhatsApp
              </label>
              <input
                id="live-welcome-phone"
                aria-label="WhatsApp"
                className={bigField}
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                placeholder="9xx xxx xxx"
                value={customer.phone}
                onChange={(e) =>
                  setCustomer((c) => ({
                    ...c,
                    // Dígitos y un "+" inicial para números de otros países.
                    phone: normalizePhone(e.target.value),
                  }))
                }
              />
              {knownPhone === customer.phone && knownPhone ? (
                <p className="mt-3 rounded-xl border border-[var(--acc)] bg-[var(--acc-soft)] px-3 py-2.5 text-sm">
                  👋 ¡Hola de nuevo, <b>{customer.name}</b>!
                </p>
              ) : isValidMobilePhone(customer.phone) ? (
                // B2: el nombre se pide recién con un WhatsApp válido.
                <>
                  <label htmlFor="live-welcome-name" className={`${label} mt-3.5`}>
                    Tu nombre
                  </label>
                  <input
                    id="live-welcome-name"
                    aria-label="Nombre"
                    className={bigField}
                    autoComplete="name"
                    maxLength={120}
                    placeholder="Nombre y apellido"
                    value={customer.name}
                    onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                  />
                </>
              ) : null}
              {error ? (
                <p role="alert" className="mt-1.5 text-[13px] text-[var(--b-err)]">
                  {error}
                </p>
              ) : null}
              <button
                className={`${cta} mt-4`}
                disabled={busy || !customer.name.trim() || !isValidMobilePhone(customer.phone)}
              >
                Entrar a comprar<span aria-hidden="true"> →</span>
              </button>
              <p className={tiny}>Solo para avisarte de tu pedido. Nadie más ve tu número.</p>
            </form>
            <button
              type="button"
              className="mx-auto mt-3 block p-2 text-sm font-semibold text-[var(--acc-tx)]"
              onClick={() => setWelcome(false)}
            >
              Solo quiero mirar primero
            </button>
          </section>
        ) : (
          <div className="flex-1 pb-32">
            <p className="px-4 pt-3.5 text-[15px] leading-normal">
              {customer.name && data?.customer ? (
                <>
                  Hola, <b>{customer.name.trim().split(/\s+/)[0]}</b> 👋{" "}
                  {data.isTrusted ? (
                    <span className="block text-[13px] text-[var(--b-pur)]">
                      ⭐ Cliente de confianza: tus prendas no vencen
                    </span>
                  ) : (
                    "Separa lo que quieras y paga todo junto."
                  )}
                </>
              ) : data ? (
                "Estás mirando. Para separar te pediremos tu WhatsApp."
              ) : null}
            </p>
            {!whatsapp && data?.session?.closesAt ? (
              <p className="px-4 pt-1 text-xs text-[var(--b-mut)]">
                Precios del live por{" "}
                <LiveCountdown expiresAt={data.session.closesAt} serverNow={data.serverNow} />
              </p>
            ) : null}
            {error || readError ? (
              <div role="alert" className={`${banner} bg-[var(--b-bad-bg)] text-[var(--b-bad)]`}>
                {error || readError}
                <button className="ml-3 font-semibold underline" onClick={() => void refresh(visitor)}>
                  Actualizar
                </button>
              </div>
            ) : null}
            {notice ? (
              <p role="status" className={banner}>
                {notice}
              </p>
            ) : null}
            {!data ? (
              <p role="status" className="px-4 py-10 text-center text-[var(--b-mut)]">
                Cargando catálogo…
              </p>
            ) : null}
            {purchases.map((o) => (
              <article
                key={o.orderNumber || o.id}
                className="mx-4 mt-3 rounded-2xl border border-[var(--b-line)] bg-[var(--b-card)] p-3"
              >
                <div className="flex items-start gap-2.5">
                  <span aria-hidden="true">📦</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--b-mut)]">
                      Tu compra · {o.orderNumber || "Pago iniciado"}
                    </p>
                    <p className="mt-0.5 text-sm font-bold">
                      {liveBuyerLabel(
                        o.buyerStatus ||
                          (o.status === "ANULADO"
                            ? "CANCELLED"
                            : o.manualPayment?.status || o.paymentStatus),
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.trackingUrl?.startsWith("/p/") ? (
                    <a href={o.trackingUrl} className={ghost}>
                      Ver mi pedido
                    </a>
                  ) : null}
                  {o.method === "yape" &&
                  o.checkoutId &&
                  !["ANULADO", "CANCELLED"].includes(o.status) ? (
                    <button
                      className={ghost}
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
              <div className="px-4 py-10 text-center">
                <p aria-hidden="true" className="text-4xl">
                  🕛
                </p>
                <h2 className="mt-2 text-xl font-bold">El catálogo del live cerró</h2>
                <p className="mt-1 text-[var(--b-mut)]">
                  El catálogo del live está cerrado. Puedes consultar tus pedidos arriba.
                </p>
              </div>
            ) : (
              <div className="grid gap-3.5 px-4 pt-3.5">
                {grouped.map((variants) => (
                  <ProductCard
                    key={`${storeId}/${variants[0].productId || variants[0].variantId}`}
                    variants={variants}
                    featured={variants.some((p) => p.variantId === data?.session?.pinnedVariantId)}
                    busy={busy}
                    maxCart={
                      data?.isTrusted
                        ? 10000
                        : Math.max(0, (data?.config.maxReservedUnits || 5) - units)
                    }
                    minutes={data?.config.reservationMinutes || 15}
                    onSeparate={separate}
                    onDetail={() => setDetail(variants)}
                  />
                ))}
              </div>
            )}
            {data && !closed && !grouped.length ? (
              <p className="px-4 py-10 text-center text-[var(--b-mut)]">
                El negocio aún no publica productos con stock.
              </p>
            ) : null}
            {data ? (
              <p className={`${tiny} px-4 pt-3`}>
                {whatsapp
                  ? "Pagas con Yape y te lo enviamos a todo el Perú"
                  : "El precio live vale solo aquí mientras el catálogo esté abierto"}{" "}
                · ⚡ POWIP
              </p>
            ) : null}
          </div>
        )}
        {units && data && !welcome ? (
          <div className="sticky bottom-0 z-20 mt-auto bg-gradient-to-t from-[var(--b-bg)] from-70% to-transparent px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5">
            <button
              className="flex w-full items-center gap-3 rounded-[18px] bg-[var(--acc)] px-4 py-3 text-left text-[var(--acc-ink)]"
              onClick={() => setCart(true)}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--acc-ink)] font-bold text-[var(--acc)]">
                {units}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">Ver mi pedido · {liveMoney(subtotal)}</b>
                <small className="text-[12.5px] opacity-80">
                  <span>{units} prendas separadas</span>
                  {data.isTrusted ? (
                    " · ⭐ No vence"
                  ) : timer ? (
                    <>
                      {" · "}
                      <LiveReservationTimer reservation={timer} serverNow={data.serverNow} />
                    </>
                  ) : null}
                </small>
              </span>
              <span aria-hidden="true" className="font-bold">
                Pagar →
              </span>
            </button>
          </div>
        ) : null}
      </div>
      {cart && data ? (
        <Dialog open onOpenChange={setCart}>
          <DialogContent className={sheet}>
            <DialogHeader>
              <DialogTitle>Mi pedido</DialogTitle>
              <DialogDescription className="text-[var(--b-mut)]">
                Todo lo separado comparte el mismo tiempo.
              </DialogDescription>
            </DialogHeader>
            {timer ? <LiveReservationTimer reservation={timer} serverNow={data.serverNow} /> : null}
            {reservations.map((r) => {
              const product = data.products.find((p) => p.variantId === r.variantId);
              return (
                <article
                  key={r.id}
                  className="flex items-center gap-3 border-b border-[var(--b-line)] py-3"
                >
                  {product ? (
                    <LiveProductImage product={product} className="h-14 w-14 shrink-0" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.productName || r.name}</p>
                    <p className="text-sm text-[var(--b-mut)]">
                      {r.variantLabel || product?.variantLabel} · {liveMoney(r.unitPrice)}
                    </p>
                    <button
                      className="min-h-11 text-sm text-[var(--b-err)]"
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
                  <div className="inline-flex shrink-0 items-center overflow-hidden rounded-[14px] border-[1.5px] border-[var(--b-line)] bg-[var(--b-in)]">
                    <button
                      aria-label={`Restar ${r.productName || r.name}`}
                      className={stepper}
                      disabled={busy || r.quantity <= 1}
                      onClick={() =>
                        void operate(`resize:${r.id}:${r.quantity - 1}`, async (key) => {
                          await resizeLiveReservation(storeId, visitor, r.id, r.quantity - 1, key);
                        })
                      }
                    >
                      −
                    </button>
                    <span className="min-w-7 text-center font-bold">{r.quantity}</span>
                    <button
                      aria-label={`Sumar ${r.productName || r.name}`}
                      className={stepper}
                      disabled={busy}
                      onClick={() =>
                        void operate(`resize:${r.id}:${r.quantity + 1}`, async (key) => {
                          await resizeLiveReservation(storeId, visitor, r.id, r.quantity + 1, key);
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                </article>
              );
            })}
            <p className="text-xl font-bold">Productos · {liveMoney(subtotal)}</p>
            <button
              className={cta}
              disabled={busy || !units || reservations.some((r) => r.status !== "ACTIVE")}
              onClick={() => {
                setCart(false);
                setPay(true);
              }}
            >
              Continuar a entrega
            </button>
            <button className={ghost} onClick={() => setCart(false)}>
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
      {detail && visitor ? (
        <LiveProductDetailDialog
          storeId={storeId}
          visitor={visitor}
          variants={detail}
          onClose={() => setDetail(null)}
        />
      ) : null}
      {manualId ? (
        <LiveManualPaymentDialog
          key={manualId}
          storeId={storeId}
          visitor={visitor}
          checkoutId={manualId}
          initial={manual}
          storeName={look.displayName}
          continueLabel={whatsapp ? "Seguir mirando el catálogo" : "Seguir comprando en el live"}
          combineShipping={!!data?.config.combineShipping}
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
  onDetail,
}: {
  variants: LiveProduct[];
  featured: boolean;
  busy: boolean;
  maxCart: number;
  minutes: number;
  onSeparate: (p: LiveProduct, q: number) => Promise<void>;
  /** FEAT-32 M7: abre «Ver detalle» (fotos y descripción). */
  onDetail?: () => void;
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
  const optionValue = (k: string) => selection[k];
  // FEAT-32 M7: el contenido es del producto (igual en todas sus variantes); sin él, como antes.
  const content = groupContent(variants);
  const title = content?.title?.trim() || display.name;
  // Foto: la propia de la variante elegida (la de su color). Con solo el color elegido, la de una variante de ese
  // color. Si no, la principal del contenido; sin contenido, la de siempre.
  const chosen = Object.entries(selection).filter(([, value]) => value);
  const variantPhoto =
    product?.variantImageUrl ||
    (chosen.length
      ? variants.find((p) => p.variantImageUrl && chosen.every(([k, value]) => p.attributes?.[k] === value))
          ?.variantImageUrl
      : null);
  return (
    <article
      aria-label={title}
      className={`overflow-hidden rounded-[22px] border bg-[var(--b-card)] ${featured ? "border-[var(--acc)] shadow-[inset_0_0_0_1px_var(--acc)]" : "border-[var(--b-line)]"}`}
    >
      {featured ? (
        <p className="bg-[var(--acc-soft)] px-3.5 py-2 text-xs font-bold text-[var(--acc-tx)]">
          📌 Lo que muestran ahora en el live
        </p>
      ) : null}
      <div className="relative">
        <LiveProductImage
          product={display}
          src={variantPhoto || content?.photos[0]}
          className="aspect-[4/3] w-full !rounded-none bg-[var(--b-in)]"
        />
        {discount ? (
          <span className="absolute left-3 top-3 rounded-lg bg-[#e2465f] px-2 py-0.5 text-[13px] font-bold text-white">
            −{discount}% en el live
          </span>
        ) : null}
      </div>
      <div className="px-4 pb-4 pt-3.5">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {content?.shortDescription?.trim() ? (
          <p className="mt-0.5 text-sm text-[var(--b-mut)]">{content.shortDescription}</p>
        ) : null}
        {content && onDetail ? (
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-[var(--acc-tx)] underline-offset-2 hover:underline"
            aria-label={`Ver detalle de ${title}`}
            onClick={onDetail}
          >
            Ver detalle
          </button>
        ) : null}
        <p className="mb-1.5 mt-1 flex flex-wrap items-baseline gap-2.5">
          <strong className="text-2xl text-[var(--acc-tx)]">{liveMoney(display.livePrice)}</strong>
          {discount ? (
            <s className="text-[var(--b-mut)]">{liveMoney(display.regularPrice)}</s>
          ) : null}
        </p>
        {keys.map((k, i) => (
          <fieldset key={k}>
            <legend className="mb-2 mt-3 text-[13px] text-[var(--b-mut)]">
              {k}
              {optionValue(k) ? (
                <>
                  : <b className="text-[var(--b-ink)]">{optionValue(k)}</b>
                </>
              ) : null}
            </legend>
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
                    className={`${chip} ${!available ? "line-through" : ""}`}
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
          <div className="mt-3 flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.variantId}
                className={chip}
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
        <div className="mt-4 flex items-stretch gap-2.5">
          <div className="inline-flex shrink-0 items-center overflow-hidden rounded-[14px] border-[1.5px] border-[var(--b-line)] bg-[var(--b-in)]">
            <button
              className="h-[52px] w-11 text-xl disabled:opacity-30"
              aria-label={`Restar cantidad de ${display.name}`}
              disabled={quantity <= 1 || busy}
              onClick={() => setQuantity((q) => q - 1)}
            >
              −
            </button>
            <span className="min-w-7 text-center font-bold">{quantity}</span>
            <button
              className="h-[52px] w-11 text-xl disabled:opacity-30"
              aria-label={`Sumar cantidad de ${display.name}`}
              disabled={quantity >= maximum || busy}
              onClick={() => setQuantity((q) => q + 1)}
            >
              +
            </button>
          </div>
          <button
            className="min-h-[52px] flex-1 rounded-[14px] bg-[var(--acc)] px-3 text-[15.5px] font-bold text-[var(--acc-ink)] disabled:bg-[var(--b-dis)] disabled:text-[var(--b-dis-ink)]"
            disabled={busy || !!reason || quantity > maximum}
            onClick={() => {
              if (product) void onSeparate(product, quantity);
            }}
          >
            {reason || `Separar · ${liveMoney(display.livePrice * quantity)}`}
          </button>
        </div>
        <p className="mt-2.5 text-xs text-[var(--b-mut)]">
          {product && product.availableStock < 4 ? (
            <b className="text-[var(--b-err)]">¡Quedan {product.availableStock}! · </b>
          ) : (
            ""
          )}
          Te lo guardamos {minutes} min
          {display.maxPerCustomer ? ` · Máx. ${display.maxPerCustomer} por cliente` : ""}
        </p>
      </div>
    </article>
  );
}
