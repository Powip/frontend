"use client";

import {
  ArrowLeft,
  Check,
  Clock3,
  CreditCard,
  ExternalLink,
  Loader2,
  Package,
  Radio,
  RefreshCw,
  ShoppingBag,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LiveCheckoutDraft } from "./LiveCheckoutDialog";
import LivePublicProductCard from "./LivePublicProductCard";
import { LiveReservationTimer } from "./LiveShared";
import { groupLiveProducts, type LiveCartItem, removePurchasedItems } from "./liveCatalog";
import { createLivePolling, type LivePollingController } from "./livePolling";
import {
  getPublicLive,
  isLiveReadDenied,
  liveError,
  liveMoney,
  liveOrderLabel,
  liveVisitorToken,
  platformNames,
  removePublicLiveReservation,
  reserveLiveProduct,
  safeLiveUrl,
} from "./liveService";
import type {
  LiveCustomer,
  LiveProduct,
  LivePublicData,
  LivePublicOrder,
  LiveReservation,
} from "./types";

const LiveCheckoutDialog = lazy(() => import("./LiveCheckoutDialog"));
const LiveManualPaymentDialog = lazy(() => import("./LiveManualPaymentDialog"));

const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#25F4EE] px-4 py-3 text-sm font-bold text-[#0B0B0F] transition hover:bg-[#78FAF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0F] disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-[#25F4EE]/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE] disabled:cursor-not-allowed disabled:opacity-40";
const field =
  "mt-1.5 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-[#25F4EE] focus:ring-2 focus:ring-[#25F4EE]/20 disabled:opacity-50";
const isActive = (reservation: LiveReservation) =>
  ["ACTIVE", "PENDING"].includes(reservation.status);
const customerValid = (customer: LiveCustomer) =>
  customer.name.trim().length >= 3 &&
  customer.name.trim().length <= 120 &&
  /^9\d{8}$/.test(customer.phone);

export default function PublicLivePage({ storeId }: { storeId: string }) {
  return <PublicLiveCatalog key={storeId} storeId={storeId} />;
}

function PublicLiveCatalog({ storeId }: { storeId: string }) {
  const [snapshot, setSnapshot] = useState<{
    storeId: string;
    value: LivePublicData;
    receivedAt: number;
  } | null>(null);
  const [clock, setClock] = useState(Date.now);
  const data = snapshot?.storeId === storeId ? snapshot.value : null;
  const [visitor, setVisitor] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [customer, setCustomer] = useState<LiveCustomer>({
    name: "",
    phone: "",
    socialUsername: "",
  });
  const [cart, setCart] = useState<LiveCartItem[]>([]);
  const [reserveSource, setReserveSource] = useState<"card" | "cart">("card");
  const [reserveSelection, setReserveSelection] = useState<LiveCartItem[] | null>(null);
  const [reservationError, setReservationError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [manualCheckoutId, setManualCheckoutId] = useState<string | null>(null);
  const [checkoutDraft, setCheckoutDraft] = useState<LiveCheckoutDraft | undefined>();
  const [purchase, setPurchase] = useState<{
    items: { variantId: string; quantity: number }[];
    reservationIds?: string[];
  } | null>(null);
  const generation = useRef(0);
  const busyLock = useRef<number | null>(null);
  const cachedVisitor = useRef<{ storeId: string; token: string } | null>(null);
  const reserveAttempts = useRef(new Map<string, string>());
  const customerField = useRef<HTMLInputElement>(null);
  const errorNotice = useRef<HTMLDivElement>(null);
  const cartSection = useRef<HTMLElement>(null);
  const reader = useRef<LivePollingController | null>(null);
  const modalWasOpen = useRef(false);
  const latestData = useRef<LivePublicData | null>(null);
  const [readError, setReadError] = useState("");
  const refresh = useCallback(async (_token: string, quiet = false) => {
    return (await reader.current?.refresh({ quiet, supersede: true })) ?? false;
  }, []);
  useEffect(() => {
    generation.current += 1;
    const token =
      cachedVisitor.current?.storeId === storeId
        ? cachedVisitor.current.token
        : liveVisitorToken(storeId);
    cachedVisitor.current = { storeId, token };
    latestData.current = null;
    busyLock.current = null;
    setBusy("");
    setVisitor(token);
    setSnapshot(null);
    setLoading(true);
    setError("");
    setReadError("");
    setNotice("");
    setCustomer({ name: "", phone: "", socialUsername: "" });
    setQuantities({});
    setCart([]);
    setReserveSelection(null);
    setReservationError("");
    setPurchase(null);
    setManualCheckoutId(null);
    setCheckoutDraft(undefined);
    reserveAttempts.current.clear();
    const polling = createLivePolling({
      load: (signal) => getPublicLive(storeId, token, signal),
      intervalMs: () => (latestData.current?.session?.status === "LIVE" ? 5000 : 15000),
      onData: (result) => {
        // Reads started before mutations are aborted by the scoped reader. A fresh response
        // is authoritative, including holds that expired or were released before reconciliation.
        latestData.current = result;
        setSnapshot({ storeId, value: result, receivedAt: Date.now() });
        setReadError("");
        const latestOrder = result.orders?.[0];
        if (
          latestOrder &&
          (["PAID", "FAILED", "REFUND_PENDING"].includes(latestOrder.status) ||
            ["APPROVED", "MANUAL_APPROVED"].includes(latestOrder.paymentStatus))
        ) {
          setNotice((previous) =>
            previous.startsWith("Estamos verificando el pago") ? "" : previous,
          );
        }
        const knownCustomer =
          result.customer ??
          result.reservations.find((reservation) => reservation.customer)?.customer;
        if (knownCustomer)
          setCustomer((previous) =>
            previous.phone ? previous : { name: knownCustomer.name, phone: knownCustomer.phone },
          );
      },
      onError: (cause) => {
        setReadError(liveError(cause));
        if (isLiveReadDenied(cause)) {
          latestData.current = null;
          setSnapshot(null);
        }
      },
      onLoading: (pending, quiet) => {
        if (!quiet || !pending) setLoading(pending);
      },
    });
    reader.current = polling;
    void polling.refresh({ quiet: false });
    return () => {
      generation.current += 1;
      polling.dispose();
      if (reader.current === polling) reader.current = null;
    };
  }, [storeId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Each store creates a reader that must inherit the current modal and mutation pause state.
  useEffect(() => {
    const modalOpen = !!purchase || !!manualCheckoutId || !!reserveSelection;
    reader.current?.setPaused(!!busy || modalOpen, {
      refreshOnResume: modalWasOpen.current && !modalOpen,
    });
    modalWasOpen.current = modalOpen;
  }, [busy, purchase, manualCheckoutId, reserveSelection, storeId]);
  const displayError = error || readError;
  useEffect(() => {
    if (!error || reserveSelection) return;
    errorNotice.current?.scrollIntoView?.({ block: "nearest" });
    errorNotice.current?.focus({ preventScroll: true });
  }, [error, reserveSelection]);
  const hasExpiringReservations =
    data?.reservations.some((item) => isActive(item) && item.expiresAt && !item.reviewHold) ??
    false;
  useEffect(() => {
    if (!hasExpiringReservations) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasExpiringReservations]);
  const serverTime =
    data && snapshot ? Date.parse(data.serverNow) + Math.max(0, clock - snapshot.receivedAt) : 0;
  const isCurrentReservation = (item: LiveReservation) =>
    isActive(item) &&
    (item.reviewHold || !item.expiresAt || Date.parse(item.expiresAt) > serverTime);

  async function operate(key: string, callback: () => Promise<unknown>, success?: string) {
    if (busyLock.current !== null) return;
    const current = generation.current;
    busyLock.current = current;
    setBusy(key);
    setError("");
    try {
      await callback();
      if (generation.current !== current) return;
      if (success) setNotice(success);
      // A completed command must not remain busy while a slower catalog read reconciles it.
      void refresh(visitor, true);
      return true;
    } catch (cause) {
      if (generation.current === current) {
        const message = liveError(cause);
        setError(message);
        setReservationError(message);
      }
      return false;
    } finally {
      if (busyLock.current === current) busyLock.current = null;
      if (generation.current === current) setBusy("");
    }
  }
  function acknowledgeReservation(reservation: LiveReservation, serverNow: string) {
    if (!reservation.id) return;
    setSnapshot((previous) => {
      if (!previous || previous.storeId !== storeId) return previous;
      const known = previous.value.reservations.some((item) => item.id === reservation.id);
      const value = {
        ...previous.value,
        serverNow,
        // Until the fresh read arrives, conservatively account for this acknowledged hold.
        // An idempotent replay already visible in the snapshot must not subtract it twice.
        products: known
          ? previous.value.products
          : previous.value.products.map((product) =>
              product.variantId === reservation.variantId
                ? {
                    ...product,
                    availableStock: Math.max(0, product.availableStock - reservation.quantity),
                    remainingLimit:
                      product.remainingLimit == null
                        ? product.remainingLimit
                        : Math.max(0, product.remainingLimit - reservation.quantity),
                  }
                : product,
            ),
        reservations: [
          ...previous.value.reservations.filter((item) => item.id !== reservation.id),
          reservation,
        ],
      };
      latestData.current = value;
      return { storeId, value, receivedAt: Date.now() };
    });
  }
  async function reserveItems(items: LiveCartItem[], fromCart = false) {
    if (!customerValid(customer)) {
      setReservationError("");
      setReserveSelection(items);
      return;
    }
    const current = generation.current;
    const done = await operate(
      items.length === 1 ? `reserve:${items[0].variantId}` : "reserve:selection",
      async () => {
        for (const item of items) {
          const input = { ...item, customer };
          const selection = JSON.stringify(input);
          const attempt = reserveAttempts.current.get(selection) ?? crypto.randomUUID();
          reserveAttempts.current.set(selection, attempt);
          const result = await reserveLiveProduct(storeId, visitor, {
            ...input,
            idempotencyKey: attempt,
          });
          if (generation.current !== current) return;
          acknowledgeReservation(result.reservation, result.serverNow);
          reserveAttempts.current.delete(selection);
          setQuantities((values) => ({ ...values, [item.variantId]: 1 }));
          if (fromCart) setCart((previous) => removePurchasedItems(previous, [item]));
          // Successfully accepted holds are removed from a batch retry, even if a later item fails.
          setReserveSelection(
            (previous) =>
              previous?.filter((pending) => pending.variantId !== item.variantId) ?? null,
          );
        }
      },
      "Apartados guardados. Puedes seguir eligiendo y pagarlos juntos antes de que venzan.",
    );
    if (done && generation.current === current) {
      setReserveSelection(null);
      setReservationError("");
    }
  }
  function reserve(product: LiveProduct, quantity: number) {
    setReserveSource("card");
    setReserveSelection([{ variantId: product.variantId, quantity }]);
    setReservationError("");
    if (customerValid(customer)) void reserveItems([{ variantId: product.variantId, quantity }]);
  }
  function addToCart(product: LiveProduct, quantity: number) {
    const previousQuantity =
      cart.find((item) => item.variantId === product.variantId)?.quantity ?? 0;
    if (previousQuantity + quantity > availableFor(product)) {
      setError(
        "La cantidad de esta variante supera el stock o el límite disponible. Revisa tu selección.",
      );
      return;
    }
    setCart((previous) => {
      const existing = previous.find((item) => item.variantId === product.variantId);
      return existing
        ? previous.map((item) =>
            item.variantId === product.variantId
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [...previous, { variantId: product.variantId, quantity }];
    });
    setNotice(
      `${quantity} × ${product.name}${product.variantLabel ? ` · ${product.variantLabel}` : ""} agregado a tu compra.`,
    );
  }
  const canAccumulate = data?.config.allowAccumulation === true && data.isTrusted;
  const products = data?.products.filter((product) => product.enabled) ?? [];
  const reservations = data?.reservations.filter(isCurrentReservation) ?? [];
  const payableReservations = reservations.filter(
    (reservation) => reservation.status === "ACTIVE" && !reservation.checkoutId,
  );
  const paid = data?.reservations.filter((reservation) => reservation.status === "PAID") ?? [];
  const productGroups = groupLiveProducts(products);
  const pinned = productGroups.find((group) =>
    group.variants.some((product) => product.variantId === data?.session?.pinnedVariantId),
  );
  const remaining = productGroups.filter((group) => group.id !== pinned?.id);
  const reservedUnits = reservations.reduce((sum, item) => sum + item.quantity, 0);
  const cartRows = cart.map((item) => ({
    ...item,
    product: products.find((product) => product.variantId === item.variantId),
    reservedQuantity: reservations
      .filter((reservation) => reservation.variantId === item.variantId)
      .reduce((sum, reservation) => sum + reservation.quantity, 0),
  }));
  const cartInvalid = cartRows.some(
    (item) => !item.product || item.quantity > availableFor(item.product),
  );
  const cartUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const reservationLimitExceeded = reservedUnits + cartUnits > (data?.config.maxReservedUnits ?? 0);
  const onAir = data?.session?.status === "LIVE";
  const closed = !data?.config.enabled || !data.session || data.session.status === "CLOSED";
  const socialUrl = data?.config.showBackLink ? safeLiveUrl(data.config.liveUrl) : null;
  const methods = data?.paymentMethods?.filter((method) => method === "yape") ?? [];
  function availableFor(product: LiveProduct) {
    const used =
      data?.reservations
        .filter(
          (reservation) =>
            reservation.variantId === product.variantId &&
            (!reservation.sessionId || reservation.sessionId === data?.session?.id) &&
            (isCurrentReservation(reservation) || reservation.status === "PAID"),
        )
        .reduce((sum, reservation) => sum + reservation.quantity, 0) ?? 0;
    return Math.max(
      0,
      Math.min(
        product.availableStock,
        Math.max(0, (data?.config.maxReservedUnits ?? 0) - reservedUnits),
        product.remainingLimit ??
          (product.maxPerCustomer === null ? Infinity : product.maxPerCustomer - used),
      ),
    );
  }
  function productCard(group: (typeof productGroups)[number], featured = false) {
    return (
      <LivePublicProductCard
        key={group.id}
        group={group}
        featured={featured}
        onAir={onAir}
        busy={busy}
        quantities={quantities}
        canBuy={!closed && data?.config.allowBuyNow === true}
        canReserve={!closed && data?.config.allowReservations === true}
        canPay={methods.length > 0}
        availableFor={availableFor}
        onQuantity={(variantId, quantity) =>
          setQuantities((values) => ({ ...values, [variantId]: quantity }))
        }
        onAdd={addToCart}
        onBuy={(product, quantity) =>
          setPurchase({ items: [{ variantId: product.variantId, quantity }] })
        }
        onReserve={reserve}
      />
    );
  }
  return (
    <main className="min-h-screen border-t-2 border-[#25F4EE] bg-[#0B0B0F] text-zinc-100 selection:bg-[#25F4EE]/25">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#25F4EE]/70 bg-[#25F4EE] text-sm font-black text-[#0B0B0F] shadow-[3px_3px_0_#FE2C55]">
              {data?.store.name.slice(0, 2).toUpperCase() || <ShoppingBag className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-base font-bold">{data?.store.name || "Catálogo del live"}</p>
              <p className="text-xs text-zinc-400">Compra lo que ves en el live</p>
            </div>
          </div>
          {data ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${onAir ? "bg-[#FE2C55]/15 text-[#FF8FA5]" : "bg-white/5 text-zinc-400"}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${onAir ? "bg-[#FE2C55]" : "bg-zinc-500"}`}
              />
              {onAir
                ? `EN VIVO · ${platformNames[data.session?.platform ?? "TIKTOK"]}`
                : closed
                  ? "CERRADO"
                  : "LIVE TERMINADO"}
            </span>
          ) : null}
        </header>
        {displayError ? (
          <div
            role="alert"
            ref={errorNotice}
            tabIndex={-1}
            className="mb-5 flex items-start gap-3 rounded-xl border border-[#FE2C55]/30 bg-[#FE2C55]/10 p-4 text-sm text-[#FFB5C4]"
          >
            <p className="flex-1">{displayError}</p>
            <button
              type="button"
              aria-label="Cerrar error"
              onClick={() => {
                setError("");
                setReadError("");
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {notice ? (
          <div
            role="status"
            className={`mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${notice.startsWith("Estamos verificando") ? "border-amber-400/30 bg-amber-500/10 text-amber-200" : "border-[#25F4EE]/30 bg-[#25F4EE]/10 text-[#9AFBF7]"}`}
          >
            {notice.startsWith("Estamos verificando") ? (
              <Clock3 className="h-4 w-4 shrink-0" />
            ) : (
              <Check className="h-4 w-4 shrink-0" />
            )}
            <p className="flex-1">{notice}</p>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice("")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {loading && !data ? (
          <div className="flex items-center justify-center gap-3 py-24 text-sm text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando catálogo…
          </div>
        ) : !data ? (
          <div className="rounded-2xl border border-white/10 p-8 text-center">
            <p className="text-zinc-400">No pudimos cargar este catálogo.</p>
            <button
              type="button"
              className={`${secondary} mt-4`}
              onClick={() => void refresh(visitor)}
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
                {closed
                  ? "El catálogo del live está cerrado. Los precios y las compras volverán a estar disponibles cuando el negocio lo abra."
                  : onAir
                    ? `Sigue viendo el live en ${platformNames[data.session?.platform ?? "TIKTOK"]}. Aquí compras y pagas lo que mostramos.`
                    : "El live terminó. Puedes seguir comprando mientras este catálogo esté abierto."}
              </p>
              {socialUrl ? (
                <a href={socialUrl} target="_blank" rel="noopener noreferrer" className={secondary}>
                  <ArrowLeft className="h-4 w-4" />
                  {onAir ? "Volver al live" : "Ver perfil"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
            {!methods.length && !closed ? (
              <div className="mb-5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
                El pago con Yape aún no está disponible en este negocio. Puedes consultar tus
                apartados; podrás pagar cuando se habilite Yape.
              </div>
            ) : null}
            {canAccumulate && !closed ? (
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
                <Star className="h-5 w-5 shrink-0" />
                <p>
                  Eres cliente de confianza. Acumula sin vencimiento y paga tus apartados juntos.
                </p>
              </div>
            ) : null}
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-5">
                {!closed ? (
                  <>
                    {pinned ? productCard(pinned, true) : null}
                    <div className="flex items-center justify-between">
                      <h1 className="flex items-center gap-2 text-lg font-bold">
                        <ShoppingBag className="h-5 w-5 text-[#FF8FA5]" />
                        Todo lo del live
                        <span className="text-sm font-medium text-zinc-400">
                          ({productGroups.length})
                        </span>
                      </h1>
                      <button
                        type="button"
                        aria-label="Actualizar catálogo"
                        className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
                        disabled={loading}
                        onClick={() => void refresh(visitor)}
                      >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                    {remaining.length ? (
                      remaining.map((product) => productCard(product))
                    ) : !pinned ? (
                      <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
                        <Package className="mx-auto h-8 w-8 text-zinc-400" />
                        <p className="mt-3 text-sm text-zinc-400">
                          Todavía no hay productos en este live.
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
                    <Clock3 className="mx-auto h-10 w-10 text-zinc-400" />
                    <h1 className="mt-4 text-xl font-bold">Nos vemos en el próximo live</h1>
                    <p className="mt-2 text-sm text-zinc-400">
                      Tus apartados anteriores siguen visibles aquí.
                    </p>
                  </div>
                )}
              </div>
              <aside className="space-y-5 lg:sticky lg:top-6">
                {!closed ? (
                  <section
                    ref={cartSection}
                    id="live-cart"
                    aria-labelledby="live-cart-title"
                    className="rounded-2xl border border-[#25F4EE]/40 bg-[#25F4EE]/[0.04] p-4"
                  >
                    <h2 id="live-cart-title" className="flex items-center gap-2 text-sm font-bold">
                      <ShoppingBag className="h-4 w-4 text-[#25F4EE]" />
                      Tu selección ({cartUnits})
                    </h2>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                      Agrega varias tallas, colores o productos y paga todo en una compra. Aquí
                      todavía no se reserva stock.
                    </p>
                    {cartRows.length ? (
                      <>
                        <ul className="mt-3 divide-y divide-white/10">
                          {cartRows.map((item) => (
                            <li key={item.variantId} className="py-3">
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold">
                                    {item.product?.name ?? "Producto no disponible"}
                                  </p>
                                  <p className="mt-1 text-[11px] text-zinc-400">
                                    {item.product?.variantLabel || item.product?.sku}
                                  </p>
                                  <p className="mt-1 text-xs text-[#25F4EE]">
                                    {item.product
                                      ? liveMoney(item.product.livePrice * item.quantity)
                                      : "Revisa este producto"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="rounded p-2 text-zinc-400 hover:text-[#FF8FA5]"
                                  aria-label={`Quitar de selección ${item.product?.name ?? "producto"} ${item.product?.variantLabel ?? ""}`}
                                  disabled={!!busy}
                                  onClick={() =>
                                    setCart((previous) =>
                                      previous.filter((row) => row.variantId !== item.variantId),
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <label className="mt-2 flex items-center justify-between text-xs">
                                Cantidad
                                <input
                                  type="number"
                                  className="w-20 rounded-lg border border-white/20 bg-[#16161C] px-2 py-2"
                                  min={1}
                                  max={item.product ? Math.max(1, availableFor(item.product)) : 1}
                                  step={1}
                                  value={item.quantity}
                                  aria-label={`Cantidad de ${item.product?.name ?? "producto"} ${item.product?.variantLabel ?? ""}`}
                                  disabled={!!busy}
                                  onChange={(event) => {
                                    const quantity = Number(event.target.value);
                                    if (Number.isInteger(quantity) && quantity > 0)
                                      setCart((previous) =>
                                        previous.map((row) =>
                                          row.variantId === item.variantId
                                            ? { ...row, quantity }
                                            : row,
                                        ),
                                      );
                                  }}
                                />
                              </label>
                              {item.reservedQuantity > 0 ? (
                                <p className="mt-2 text-xs text-amber-200">
                                  Ya tienes {item.reservedQuantity}{" "}
                                  {item.reservedQuantity === 1
                                    ? "unidad apartada"
                                    : "unidades apartadas"}{" "}
                                  de esta variante. Esta selección agrega {item.quantity}{" "}
                                  {item.quantity === 1 ? "unidad más" : "unidades más"}.
                                </p>
                              ) : null}
                              {!item.product || item.quantity > availableFor(item.product) ? (
                                <p className="mt-2 text-xs text-amber-200">
                                  Cambió la disponibilidad. Reduce la cantidad o retira esta
                                  variante para continuar.
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm font-bold">
                          <span>Productos</span>
                          <span>
                            {liveMoney(
                              cartRows.reduce(
                                (sum, item) => sum + (item.product?.livePrice ?? 0) * item.quantity,
                                0,
                              ),
                            )}
                          </span>
                        </p>
                        {data.config.allowBuyNow ? (
                          <button
                            type="button"
                            className={`${primary} mt-4 w-full`}
                            aria-describedby="live-selection-payment-help"
                            disabled={
                              !!busy || cartInvalid || reservationLimitExceeded || !methods.length
                            }
                            onClick={() =>
                              setPurchase({ items: cart.map((item) => ({ ...item })) })
                            }
                          >
                            <ShoppingBag className="h-4 w-4" />
                            Comprar selección
                          </button>
                        ) : null}
                        {data.config.allowBuyNow ? (
                          <p
                            id="live-selection-payment-help"
                            className="mt-2 text-xs text-zinc-400"
                          >
                            {reservations.length
                              ? "Compra los productos de esta selección. Para pagar lo que ya reservaste, usa Pagar apartados."
                              : "Compra estos productos directamente, sin apartarlos primero."}
                          </p>
                        ) : null}
                        {data.config.allowReservations ? (
                          <button
                            type="button"
                            className={`${secondary} mt-2 w-full`}
                            disabled={!!busy || cartInvalid || reservationLimitExceeded}
                            aria-describedby="live-selection-reserve-help"
                            onClick={() => {
                              setReserveSource("cart");
                              setReserveSelection(cart.map((item) => ({ ...item })));
                              setReservationError("");
                            }}
                          >
                            {busy === "reserve:selection" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Clock3 className="h-4 w-4" />
                            )}
                            Apartar selección
                          </button>
                        ) : null}
                        <p id="live-selection-reserve-help" className="mt-2 text-xs text-zinc-400">
                          {reservationLimitExceeded
                            ? `Puedes mantener hasta ${data.config.maxReservedUnits} unidades apartadas en total. Reduce tu selección o paga tus apartados.`
                            : `Los apartados duran ${data.config.reservationMinutes} minutos, con un máximo de ${data.config.maxReservedUnits} unidades en total.`}
                        </p>
                      </>
                    ) : (
                      <p className="mt-4 text-xs text-zinc-400">
                        Elige una variante y pulsa Agregar a mi compra para empezar.
                      </p>
                    )}
                  </section>
                ) : null}
                {!closed ? (
                  <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <h2 className="text-sm font-bold">Tus datos para apartar</h2>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                      Tu nombre y WhatsApp permiten al negocio contactarte por tu pedido.
                    </p>
                    <label className="mt-4 block text-xs font-medium text-zinc-300">
                      Nombre
                      <input
                        ref={customerField}
                        className={field}
                        autoComplete="name"
                        maxLength={120}
                        value={customer.name}
                        onChange={(event) =>
                          setCustomer((value) => ({ ...value, name: event.target.value }))
                        }
                        placeholder="Tu nombre"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-medium text-zinc-300">
                      WhatsApp
                      <input
                        className={field}
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        maxLength={9}
                        readOnly={!!data.customer}
                        value={customer.phone}
                        onChange={(event) =>
                          setCustomer((value) => ({
                            ...value,
                            phone: event.target.value.replace(/\D/g, ""),
                          }))
                        }
                        placeholder="9 dígitos, empieza con 9"
                      />
                    </label>
                  </section>
                ) : null}
                <section className="rounded-2xl border border-[#25F4EE]/20 bg-[#25F4EE]/[0.04] p-4">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-[#25F4EE]" />
                    <h2 className="flex-1 text-sm font-bold">
                      Tus apartados ({reservations.length})
                    </h2>
                  </div>
                  {reservations.length ? (
                    <>
                      <div className="mt-3 divide-y divide-white/10">
                        {reservations.map((reservation) => (
                          <div key={reservation.id} className="py-3">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold">
                                  {reservation.quantity} ×{" "}
                                  {reservation.productName ||
                                    reservation.name ||
                                    products.find(
                                      (product) => product.variantId === reservation.variantId,
                                    )?.name ||
                                    "Producto"}
                                </p>
                                {reservation.variantLabel ? (
                                  <p className="mt-1 text-[11px] text-zinc-400">
                                    {reservation.variantLabel}
                                  </p>
                                ) : null}
                                <p className="mt-1 text-xs text-[#25F4EE]">
                                  {liveMoney(reservation.unitPrice * reservation.quantity)}
                                </p>
                              </div>
                              <button
                                type="button"
                                aria-label={`Quitar apartado de ${reservation.productName || reservation.name || "producto"}`}
                                disabled={
                                  !!busy ||
                                  reservation.type === "ACCUMULATED" ||
                                  !!reservation.checkoutId
                                }
                                className="rounded p-1 text-zinc-400 hover:text-[#FF8FA5] disabled:opacity-40"
                                onClick={() =>
                                  void operate(
                                    "remove",
                                    () =>
                                      removePublicLiveReservation(storeId, visitor, reservation.id),
                                    "Apartado retirado. El stock volvió al catálogo.",
                                  )
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="mt-2">
                              {reservation.status === "PENDING" ? (
                                <p className="text-xs text-amber-200">Confirmando apartado…</p>
                              ) : (
                                <LiveReservationTimer
                                  reservation={reservation}
                                  serverNow={data.serverNow}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-between border-t border-white/10 pt-3 text-sm font-bold">
                        <span>Productos</span>
                        <span>
                          {liveMoney(
                            reservations.reduce(
                              (sum, item) => sum + item.quantity * item.unitPrice,
                              0,
                            ),
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`${primary} mt-4 w-full`}
                        aria-describedby="live-reservations-payment-help"
                        disabled={!!busy || !methods.length || !payableReservations.length}
                        onClick={() =>
                          setPurchase({
                            items: [],
                            reservationIds: payableReservations.map(
                              (reservation) => reservation.id,
                            ),
                          })
                        }
                      >
                        <CreditCard className="h-4 w-4" />
                        Pagar apartados
                      </button>
                      <p id="live-reservations-payment-help" className="mt-2 text-xs text-zinc-400">
                        {!methods.length
                          ? "El negocio aún debe habilitar Yape para recibir pagos."
                          : !payableReservations.length &&
                              reservations.some((item) => item.status === "PENDING")
                            ? "Podrás pagar cuando se confirme el stock de tus apartados."
                            : "Paga los productos ya apartados de esta lista, más el envío. Tu selección se compra por separado."}
                      </p>
                      {reservations.some((item) => item.checkoutId) ? (
                        <p className="mt-3 text-xs text-amber-200">
                          Hay apartados con un pago iniciado. Consulta el estado en tus compras del
                          live.
                        </p>
                      ) : null}
                      <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
                        Los apartados con tiempo se liberan al vencer. Un comprobante Yape enviado
                        conserva el stock mientras el negocio revisa el pago.
                      </p>
                    </>
                  ) : (
                    <p className="py-5 text-xs leading-relaxed text-zinc-400">
                      Cuando apartes un producto aparecerá aquí. Podrás pagar tus apartados juntos.
                    </p>
                  )}
                </section>
                {data.orders?.length ? (
                  <section className="space-y-3 rounded-2xl border border-[#25F4EE]/20 p-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-[#25F4EE]">
                      <Package className="h-4 w-4" />
                      Tus compras del live
                    </h2>
                    {data.orders.map((order) => (
                      <article key={order.id} className="rounded-xl bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold">
                            {order.orderNumber || `Compra ${order.id.slice(0, 8)}`}
                          </p>
                          <span className="text-xs font-semibold text-[#25F4EE]">
                            {liveMoney(order.total)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                          {order.status === "REFUND_PENDING"
                            ? "Pago recibido · devolución pendiente"
                            : paymentLabel(order)}
                        </p>
                        {liveOrderLabel(order.status) ? (
                          <p className="mt-1 text-xs font-semibold text-zinc-200">
                            {liveOrderLabel(order.status)}
                          </p>
                        ) : null}
                        <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                          {order.items.map((item) => (
                            <li
                              key={
                                item.variantId ?? `${item.name}-${item.unitPrice}-${item.quantity}`
                              }
                            >
                              {item.quantity} × {item.name}
                            </li>
                          ))}
                        </ul>
                        {order.method === "yape" || order.manualPayment ? (
                          <button
                            type="button"
                            className={`${secondary} mt-3 w-full py-2 text-xs`}
                            onClick={() => setManualCheckoutId(order.checkoutId ?? order.id)}
                          >
                            {order.manualPayment?.status === "UNDER_REVIEW"
                              ? "Ver comprobante en revisión"
                              : order.manualPayment?.status === "REJECTED"
                                ? "Ver resultado de revisión"
                                : "Ver pago Yape"}
                          </button>
                        ) : null}
                        {safeLiveUrl(order.trackingUrl) ? (
                          <a
                            href={safeLiveUrl(order.trackingUrl) ?? undefined}
                            className={`${secondary} mt-3 w-full py-2 text-xs`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Seguir pedido
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="mt-2 text-[11px] text-zinc-400">
                            {order.status === "REFUND_PENDING"
                              ? "El negocio gestionará la devolución del pago."
                              : ["PAID", "APPROVED", "MANUAL_APPROVED", "approved"].includes(
                                    order.paymentStatus,
                                  )
                                ? order.status === "ANULADO"
                                  ? "Contacta al negocio para coordinar el pago de este pedido anulado."
                                  : "El negocio te informará sobre la entrega de tu pedido."
                                : ["FAILED", "CANCELLED"].includes(order.status)
                                  ? "Puedes iniciar una nueva compra para volver a intentarlo."
                                  : "Espera la revisión del comprobante Yape."}
                          </p>
                        )}
                      </article>
                    ))}
                  </section>
                ) : null}
                {paid.length ? (
                  <section className="rounded-2xl border border-[#25F4EE]/20 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#25F4EE]">
                      <Check className="h-4 w-4" />
                      Apartados pagados
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      {paid.reduce((sum, item) => sum + item.quantity, 0)} unidades con pago
                      verificado. El negocio preparará tu pedido.
                    </p>
                  </section>
                ) : null}
                <p className="px-2 text-center text-[11px] leading-relaxed text-zinc-400">
                  El precio live aplica solo en este catálogo mientras esté abierto.
                  <br />
                  <span className="mt-3 inline-flex items-center gap-1">
                    <Radio className="h-3 w-3" />
                    POWIP Live
                  </span>
                </p>
              </aside>
            </div>
          </>
        )}
      </div>
      {reserveSelection ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) {
              setReserveSelection(null);
              setReservationError("");
            }
          }}
        >
          <DialogContent
            className="max-h-[90dvh] overflow-y-auto border-white/15 bg-[#16161C] text-zinc-100 sm:max-w-md"
            aria-busy={!!busy}
          >
            <DialogHeader>
              <DialogTitle>Guardar tus apartados</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Confirma tus datos. El stock se aparta por {data?.config.reservationMinutes} minutos
                y podrás pagar varios productos juntos.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!customerValid(customer)) {
                  setReservationError(
                    "Escribe un nombre de al menos 3 caracteres y un WhatsApp de 9 dígitos que empiece por 9.",
                  );
                  return;
                }
                void reserveItems(reserveSelection, reserveSource === "cart");
              }}
            >
              {reservationError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-[#FE2C55]/30 p-3 text-sm text-[#FFB5C4]"
                >
                  {reservationError} Los productos ya apartados siguen en Tus apartados. Reintenta
                  los que faltan.
                </p>
              ) : null}
              <label className="block text-xs font-medium">
                Nombre
                <input
                  className={field}
                  value={customer.name}
                  maxLength={120}
                  autoComplete="name"
                  disabled={!!busy}
                  onChange={(event) =>
                    setCustomer((previous) => ({ ...previous, name: event.target.value }))
                  }
                />
              </label>
              <label className="block text-xs font-medium">
                WhatsApp
                <input
                  className={field}
                  type="tel"
                  inputMode="tel"
                  value={customer.phone}
                  maxLength={9}
                  autoComplete="tel"
                  readOnly={!!data?.customer}
                  disabled={!!busy}
                  onChange={(event) =>
                    setCustomer((previous) => ({
                      ...previous,
                      phone: event.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
              </label>
              <p className="text-xs text-zinc-400">
                {reserveSelection.reduce((sum, item) => sum + item.quantity, 0)} unidades por
                apartar. Máximo {data?.config.maxReservedUnits} unidades activas.
              </p>
              <button
                type="submit"
                className={`${primary} w-full`}
                disabled={!!busy || !reserveSelection.length}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock3 className="h-4 w-4" />
                )}
                {busy ? "Confirmando apartados…" : "Confirmar apartados"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
      {!closed && data && cartUnits > 0 ? (
        <button
          type="button"
          className={`${primary} fixed inset-x-4 bottom-4 z-30 shadow-xl lg:hidden`}
          onClick={() =>
            cartSection.current?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        >
          <ShoppingBag className="h-4 w-4" />
          Ver mi selección · {cartUnits} {cartUnits === 1 ? "unidad" : "unidades"}
        </button>
      ) : null}
      <Suspense
        fallback={
          <p
            role="status"
            className="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-[#25F4EE]/30 bg-[#16161C] p-4 text-center text-sm text-[#25F4EE]"
          >
            Cargando compra…
          </p>
        }
      >
        {manualCheckoutId ? (
          <LiveManualPaymentDialog
            key={`${storeId}/${visitor}/${manualCheckoutId}`}
            storeId={storeId}
            visitor={visitor}
            checkoutId={manualCheckoutId}
            onClose={() => setManualCheckoutId(null)}
            onUpdated={() => void refresh(visitor, true)}
          />
        ) : null}
        {purchase && data ? (
          <LiveCheckoutDialog
            key={JSON.stringify(purchase)}
            storeId={storeId}
            visitor={visitor}
            data={data}
            selection={purchase}
            customer={customer}
            onCustomerChange={setCustomer}
            initialDraft={checkoutDraft}
            onDraftChange={setCheckoutDraft}
            onCheckoutCreated={() =>
              setCart((previous) => removePurchasedItems(previous, purchase.items))
            }
            onClose={() => setPurchase(null)}
            onUpdated={() => void refresh(visitor, true)}
          />
        ) : null}
      </Suspense>
    </main>
  );
}

function paymentLabel(order: LivePublicOrder) {
  if (order.manualPayment?.status === "APPROVED") return "Pago validado por el negocio";
  if (order.manualPayment?.status === "UNDER_REVIEW") return "Comprobante Yape en revisión";
  if (order.manualPayment?.status === "REJECTED") return "Comprobante no validado";
  if (order.manualPayment?.status === "AWAITING_PROOF") return "Pendiente de comprobante Yape";
  if (["REFUNDED", "refunded"].includes(order.paymentStatus)) return "Pago devuelto";
  if (["PARTIALLY_REFUNDED", "partially_refunded"].includes(order.paymentStatus))
    return "Devolución parcial";
  if (["CHARGED_BACK", "charged_back"].includes(order.paymentStatus)) return "Pago con contracargo";
  if (["FAILED", "CANCELLED"].includes(order.status)) return "Pago no completado";
  if (order.status === "PAID" || ["PAID", "APPROVED", "approved"].includes(order.paymentStatus))
    return "Pago verificado";
  return "Pago en verificación";
}
