"use client";

import {
  ArrowLeft,
  Check,
  Clock3,
  CreditCard,
  ExternalLink,
  Loader2,
  Minus,
  Package,
  Pin,
  Plus,
  Radio,
  RefreshCw,
  ShoppingBag,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import ubigeos from "@/utils/json/ubigeos.json";
import { isJunkDni } from "@/utils/junk-document.util";
import LiveManualPaymentDialog from "./LiveManualPaymentDialog";
import { LiveProductImage, LiveReservationTimer } from "./LiveShared";
import {
  checkoutLivePurchase,
  getPublicLive,
  isLiveQuoteConflict,
  liveError,
  liveMoney,
  liveOrderLabel,
  liveVisitorToken,
  platformNames,
  quoteLivePurchase,
  removePublicLiveReservation,
  reserveLiveProduct,
  safeLiveUrl,
} from "./liveService";
import type {
  LiveCheckoutSnapshot,
  LiveCustomer,
  LivePaymentMethod,
  LiveProduct,
  LivePublicData,
  LivePublicOrder,
  LivePurchaseInput,
  LiveQuote,
  LiveQuoteInput,
  LiveReservation,
} from "./types";

const departments: { name: string; provinces: { name: string; districts: string[] }[] }[] =
  ubigeos[0].departments;

const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#25F4EE] px-4 py-3 text-sm font-bold text-[#0B0B0F] transition hover:bg-[#78FAF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0F] disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-[#25F4EE]/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE] disabled:cursor-not-allowed disabled:opacity-40";
const selectedSecondary = cn(secondary, "border-[#25F4EE] bg-[#25F4EE]/10 text-[#25F4EE]");
const field =
  "mt-1.5 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-[#25F4EE] focus:ring-2 focus:ring-[#25F4EE]/20 disabled:opacity-50";
const isActive = (reservation: LiveReservation) =>
  ["ACTIVE", "PENDING"].includes(reservation.status);
const customerValid = (customer: LiveCustomer) =>
  customer.name.trim().length >= 3 &&
  customer.name.trim().length <= 120 &&
  /^9\d{8}$/.test(customer.phone);

export default function PublicLivePage({ storeId }: { storeId: string }) {
  const [data, setData] = useState<LivePublicData | null>(null);
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
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [manualCheckoutId, setManualCheckoutId] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<{
    items: { variantId: string; quantity: number }[];
    reservationIds?: string[];
  } | null>(null);
  const generation = useRef(0);
  const busyLock = useRef(false);
  const cachedVisitor = useRef<{ storeId: string; token: string } | null>(null);
  const reserveAttempts = useRef(new Map<string, string>());
  const customerField = useRef<HTMLInputElement>(null);
  const refresh = useCallback(
    async (token: string, quiet = false) => {
      const current = generation.current;
      if (!quiet) setLoading(true);
      try {
        const result = await getPublicLive(storeId, token);
        if (generation.current !== current) return;
        setData(result);
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
        setError("");
      } catch (cause) {
        if (generation.current === current) setError(liveError(cause));
      } finally {
        if (generation.current === current) setLoading(false);
      }
    },
    [storeId],
  );
  useEffect(() => {
    generation.current += 1;
    const token =
      cachedVisitor.current?.storeId === storeId
        ? cachedVisitor.current.token
        : liveVisitorToken(storeId);
    cachedVisitor.current = { storeId, token };
    setVisitor(token);
    setData(null);
    setError("");
    setNotice("");
    setCustomer({ name: "", phone: "", socialUsername: "" });
    setQuantities({});
    setPurchase(null);
    setManualCheckoutId(null);
    reserveAttempts.current.clear();
    void refresh(token);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(token, true);
    }, 5000);
    return () => {
      generation.current += 1;
      clearInterval(timer);
    };
  }, [storeId, refresh]);

  async function operate(key: string, callback: () => Promise<unknown>, success?: string) {
    if (busyLock.current) return;
    busyLock.current = true;
    setBusy(key);
    setError("");
    const current = generation.current;
    try {
      await callback();
      if (generation.current !== current) return;
      if (success) setNotice(success);
      await refresh(visitor, true);
    } catch (cause) {
      if (generation.current === current) setError(liveError(cause));
    } finally {
      busyLock.current = false;
      if (generation.current === current) setBusy("");
    }
  }
  function ensureCustomer() {
    if (customerValid(customer)) return true;
    setError("Escribe tu nombre y un WhatsApp válido para guardar tus apartados.");
    customerField.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    customerField.current?.focus();
    return false;
  }
  async function reserve(product: LiveProduct, quantity: number) {
    if (!ensureCustomer()) return;
    const input = { variantId: product.variantId, quantity, customer };
    const selection = JSON.stringify(input);
    const attempt = reserveAttempts.current.get(selection) ?? crypto.randomUUID();
    reserveAttempts.current.set(selection, attempt);
    await operate(
      `reserve:${product.variantId}`,
      async () => {
        await reserveLiveProduct(storeId, visitor, { ...input, idempotencyKey: attempt });
        reserveAttempts.current.delete(selection);
        setQuantities((values) => ({ ...values, [product.variantId]: 1 }));
      },
      `${quantity} × ${product.name}: ${canAccumulate ? "acumulado guardado" : "apartado guardado"}.`,
    );
  }
  const canAccumulate = data?.config.allowAccumulation === true && data.isTrusted;
  const products = data?.products.filter((product) => product.enabled) ?? [];
  const reservations = data?.reservations.filter(isActive) ?? [];
  const payableReservations = reservations.filter((reservation) => !reservation.checkoutId);
  const paid = data?.reservations.filter((reservation) => reservation.status === "PAID") ?? [];
  const pinned = products.find((product) => product.variantId === data?.session?.pinnedVariantId);
  const remaining = pinned
    ? products.filter((product) => product.variantId !== pinned.variantId)
    : products;
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
            (isActive(reservation) || reservation.status === "PAID"),
        )
        .reduce((sum, reservation) => sum + reservation.quantity, 0) ?? 0;
    return Math.max(
      0,
      Math.min(
        product.availableStock,
        product.remainingLimit ??
          (product.maxPerCustomer === null ? Infinity : product.maxPerCustomer - used),
      ),
    );
  }
  function productCard(product: LiveProduct, featured = false) {
    const max = availableFor(product);
    const quantity = Math.max(1, Math.min(quantities[product.variantId] ?? 1, max || 1));
    return (
      <article
        key={product.variantId}
        className={`rounded-2xl border p-4 ${featured ? "border-[#FE2C55]/50 bg-gradient-to-br from-[#FE2C55]/10 to-[#25F4EE]/5 shadow-xl shadow-[#FE2C55]/10" : "border-white/10 bg-white/[0.035]"}`}
      >
        {featured ? (
          <p className="mb-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF8FA5]">
            <Pin className="h-3.5 w-3.5" />
            {onAir ? "Ahora en el live" : "Lo último que mostramos"}
          </p>
        ) : null}
        <div className="flex gap-4">
          <LiveProductImage
            product={product}
            className={featured ? "h-24 w-24 sm:h-32 sm:w-32" : "h-20 w-20"}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              {product.sku}
            </p>
            <h2 className={`mt-1 font-bold leading-snug ${featured ? "text-lg" : "text-sm"}`}>
              {product.name}
            </h2>
            {product.variantLabel ? (
              <p className="mt-1 text-xs text-zinc-400">{product.variantLabel}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className={`font-bold text-[#25F4EE] ${featured ? "text-2xl" : "text-lg"}`}>
                {liveMoney(product.livePrice)}
              </span>
              {product.regularPrice > product.livePrice ? (
                <s className="text-xs text-zinc-400">{liveMoney(product.regularPrice)}</s>
              ) : null}
            </div>
            <span className="mt-1 inline-block rounded bg-[#FE2C55]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#FFB5C4]">
              Precio live
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p
            className={`text-xs ${product.availableStock <= 3 ? "text-amber-300" : "text-zinc-400"}`}
          >
            {product.availableStock <= 0
              ? "Agotado"
              : product.availableStock <= 3
                ? `¡Quedan ${product.availableStock}!`
                : `${product.availableStock} disponibles`}
            {product.maxPerCustomer ? ` · Máx. ${product.maxPerCustomer} por cliente` : ""}
          </p>
          {max > 0 ? (
            <div className="inline-flex items-center gap-3 rounded-lg border border-white/15 bg-black/40">
              <button
                type="button"
                aria-label={`Quitar una unidad de ${product.name}`}
                disabled={quantity <= 1 || !!busy}
                className="p-2 disabled:opacity-30"
                onClick={() =>
                  setQuantities((values) => ({
                    ...values,
                    [product.variantId]: Math.max(1, quantity - 1),
                  }))
                }
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-3 text-center text-sm font-bold tabular-nums">{quantity}</span>
              <button
                type="button"
                aria-label={`Agregar una unidad de ${product.name}`}
                disabled={quantity >= max || !!busy}
                className="p-2 disabled:opacity-30"
                onClick={() =>
                  setQuantities((values) => ({ ...values, [product.variantId]: quantity + 1 }))
                }
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          ) : null}
        </div>
        {!closed ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {max <= 0 ? (
              <p className="col-span-2 rounded-xl bg-white/5 p-3 text-center text-xs text-zinc-400">
                {product.availableStock <= 0 ? "Agotado" : "Llegaste al máximo para este producto"}
              </p>
            ) : (
              <>
                {data?.config.allowBuyNow ? (
                  <button
                    type="button"
                    className={primary}
                    disabled={!!busy || !methods.length}
                    onClick={() =>
                      setPurchase({ items: [{ variantId: product.variantId, quantity }] })
                    }
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Comprar ahora
                  </button>
                ) : null}
                {data?.config.allowReservations ? (
                  <button
                    type="button"
                    className={secondary}
                    disabled={!!busy}
                    onClick={() => void reserve(product, quantity)}
                  >
                    {busy === `reserve:${product.variantId}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : canAccumulate ? (
                      <Plus className="h-4 w-4" />
                    ) : (
                      <Clock3 className="h-4 w-4" />
                    )}
                    {canAccumulate ? "Acumular" : "Apartar"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </article>
    );
  }
  return (
    <main className="min-h-screen border-t-2 border-[#25F4EE] bg-[#0B0B0F] text-zinc-100 selection:bg-[#25F4EE]/25">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
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
        {error ? (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-[#FE2C55]/30 bg-[#FE2C55]/10 p-4 text-sm text-[#FFB5C4]"
          >
            <p className="flex-1">{error}</p>
            <button type="button" aria-label="Cerrar error" onClick={() => setError("")}>
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
                          ({products.length})
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
                              <LiveReservationTimer
                                reservation={reservation}
                                serverNow={data.serverNow}
                              />
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
          onClose={() => setPurchase(null)}
          onUpdated={() => void refresh(visitor, true)}
        />
      ) : null}
    </main>
  );
}

function LiveCheckoutDialog({
  storeId,
  visitor,
  data,
  selection,
  customer,
  onCustomerChange,
  onClose,
  onUpdated,
}: {
  storeId: string;
  visitor: string;
  data: LivePublicData;
  selection: { items: { variantId: string; quantity: number }[]; reservationIds?: string[] };
  customer: LiveCustomer;
  onCustomerChange: (customer: LiveCustomer) => void;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const deliveryMethods = (["HOME", "AGENCY"] as const).filter((type) => {
    const amount = type === "HOME" ? data.config.homeShipping : data.config.agencyShipping;
    return (
      (data.deliveryMethods === undefined || data.deliveryMethods.includes(type)) &&
      typeof amount === "number" &&
      Number.isFinite(amount) &&
      amount >= 0
    );
  });
  const [manualCheckout, setManualCheckout] = useState<LiveCheckoutSnapshot | null>(null);
  const [delivery, setDelivery] = useState<LivePurchaseInput["delivery"]>({
    type: deliveryMethods[0] ?? "HOME",
    department: "",
    province: "",
    district: "",
    address: "",
    agency: "",
  });
  const [receipt, setReceipt] = useState<LivePurchaseInput["receipt"]>({
    type: "BOLETA",
    dni: "",
  });
  const method: LivePaymentMethod | "" = data.paymentMethods?.includes("yape") ? "yape" : "";
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ selection: string; id: string } | null>(null);
  const lock = useRef(false);
  const [quoteSelection, setQuoteSelection] = useState("");
  const current = useRef(true);
  useEffect(() => {
    current.current = true;
    return () => {
      current.current = false;
    };
  }, []);
  const inputSelection = JSON.stringify({ ...selection, customer, delivery, receipt, method });
  const currentQuote = quoteSelection === inputSelection ? quote : null;
  const department = departments.find((item) => item.name === delivery.department);
  const province = department?.provinces.find((item) => item.name === delivery.province);
  const locationValid =
    !!province?.districts.includes(delivery.district) &&
    [delivery.department, delivery.province, delivery.district].every(
      (value) => value.length >= 2 && value.length <= 50,
    );
  const valid =
    customerValid(customer) &&
    deliveryMethods.includes(delivery.type) &&
    locationValid &&
    delivery.address.trim().length >= 3 &&
    delivery.address.trim().length <= 150 &&
    (delivery.type === "HOME" ||
      (!!delivery.agency?.trim() && delivery.agency.trim().length <= 150)) &&
    (receipt.type === "BOLETA"
      ? /^\d{8}$/.test(receipt.dni) && !isJunkDni(receipt.dni)
      : /^(10|20)\d{9}$/.test(receipt.ruc) &&
        receipt.businessName.trim().length >= 3 &&
        receipt.businessName.trim().length <= 150) &&
    !!method &&
    !!data.paymentMethods?.includes(method);
  function selectionInput(): LiveQuoteInput {
    return { ...selection, customer, delivery, receipt };
  }
  function input(acceptedQuote: LiveQuote): LivePurchaseInput {
    const previous = attempt.current;
    const acceptedSelection = `${inputSelection}:${acceptedQuote.quoteId}`;
    const id = previous?.selection === acceptedSelection ? previous.id : crypto.randomUUID();
    attempt.current = { selection: acceptedSelection, id };
    return {
      ...selection,
      customer,
      delivery,
      receipt,
      method: method as LivePaymentMethod,
      idempotencyKey: id,
      quoteId: acceptedQuote.quoteId,
    };
  }
  async function calculate() {
    if (lock.current || !valid) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const selectionKey = inputSelection;
    try {
      const result = await quoteLivePurchase(storeId, visitor, selectionInput());
      if (current.current) {
        setQuote(result);
        setQuoteSelection(selectionKey);
      }
    } catch (cause) {
      if (current.current) {
        setError(liveError(cause));
        onUpdated();
      }
    } finally {
      lock.current = false;
      if (current.current) setBusy(false);
    }
  }
  async function checkout() {
    if (lock.current || !valid || !currentQuote) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await checkoutLivePurchase(storeId, visitor, input(currentQuote));
      if (result.manualPayment && result.checkoutId) {
        if (current.current) {
          setManualCheckout({ ...result, checkoutId: result.checkoutId });
          onUpdated();
        }
        return;
      }
      throw new Error(
        "No se generaron instrucciones Yape. Actualiza el estado antes de volver a intentar.",
      );
    } catch (cause) {
      if (current.current) {
        if (isLiveQuoteConflict(cause)) {
          setQuote(null);
          setQuoteSelection("");
          attempt.current = null;
          try {
            const updated = await quoteLivePurchase(storeId, visitor, selectionInput());
            if (current.current) {
              setQuote(updated);
              setQuoteSelection(inputSelection);
              setError(
                "La cotización cambió o venció. Revisa el total actualizado y vuelve a confirmar.",
              );
            }
          } catch (quoteError) {
            if (current.current) setError(liveError(quoteError));
          }
        } else {
          setError(liveError(cause));
        }
        onUpdated();
      }
    } finally {
      lock.current = false;
      if (current.current) setBusy(false);
    }
  }
  if (manualCheckout)
    return (
      <LiveManualPaymentDialog
        key={`${storeId}/${visitor}/${manualCheckout.checkoutId}`}
        storeId={storeId}
        visitor={visitor}
        checkoutId={manualCheckout.checkoutId}
        initial={manualCheckout}
        onClose={onClose}
        onUpdated={onUpdated}
      />
    );
  const items =
    currentQuote?.items?.map((item, index) => ({
      key: `${item.variantId}:${index}`,
      name: item.name,
      quantity: item.quantity,
      price: item.unitPrice,
    })) ??
    (selection.reservationIds
      ? data.reservations
          .filter((reservation) => selection.reservationIds?.includes(reservation.id))
          .map((reservation) => ({
            key: reservation.id,
            name:
              reservation.productName ||
              reservation.name ||
              data.products.find((product) => product.variantId === reservation.variantId)?.name ||
              "Producto",
            quantity: reservation.quantity,
            price: reservation.unitPrice,
          }))
      : selection.items.map((item) => {
          const product = data.products.find((product) => product.variantId === item.variantId);
          return {
            key: item.variantId,
            name: product?.name || "Producto",
            quantity: item.quantity,
            price: product?.livePrice ?? 0,
          };
        }));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/15 bg-[#16161C] text-zinc-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {selection.reservationIds ? "Pagar tus apartados" : "Comprar ahora"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Completa la entrega y revisa el total antes de elegir cómo pagar.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-white/10 rounded-xl border border-white/10 px-3">
          {items.map((item) => (
            <div key={item.key} className="flex justify-between gap-3 py-3 text-sm">
              <span>
                {item.quantity} × {item.name}
              </span>
              <b className="whitespace-nowrap">{liveMoney(item.price * item.quantity)}</b>
            </div>
          ))}
        </div>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void (currentQuote ? checkout() : calculate());
          }}
        >
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-[#FE2C55]/30 bg-[#FE2C55]/10 p-3 text-sm text-[#FFB5C4]"
            >
              {error}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium">
              Nombre
              <input
                className={field}
                required
                minLength={3}
                maxLength={120}
                autoComplete="name"
                value={customer.name}
                disabled={busy}
                onChange={(event) => onCustomerChange({ ...customer, name: event.target.value })}
              />
            </label>
            <label className="text-xs font-medium">
              WhatsApp
              <input
                className={field}
                required
                maxLength={9}
                readOnly={!!data.customer}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={customer.phone}
                disabled={busy}
                onChange={(event) =>
                  onCustomerChange({ ...customer, phone: event.target.value.replace(/\D/g, "") })
                }
              />
            </label>
          </div>
          <label className="block text-xs font-medium">
            Usuario en la red social (opcional)
            <input
              className={field}
              maxLength={60}
              placeholder="@tuusuario"
              value={customer.socialUsername ?? ""}
              disabled={busy}
              onChange={(event) =>
                onCustomerChange({ ...customer, socialUsername: event.target.value })
              }
            />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Entrega</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["HOME", "Domicilio"],
                ["AGENCY", "Agencia"],
              ]
                .filter(([value]) => deliveryMethods.includes(value as "HOME" | "AGENCY"))
                .map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setDelivery((previous) => ({ ...previous, type: value as "HOME" | "AGENCY" }))
                    }
                    className={delivery.type === value ? selectedSecondary : secondary}
                  >
                    {label}
                  </button>
                ))}
            </div>
            {!deliveryMethods.length ? (
              <p role="status" className="mt-3 text-sm text-amber-200">
                El negocio aún debe habilitar una modalidad de entrega antes de aceptar compras.
              </p>
            ) : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="min-w-0 text-xs font-medium">
                Departamento
                <select
                  aria-label="Departamento"
                  className={field}
                  value={delivery.department}
                  disabled={busy}
                  onChange={(event) =>
                    setDelivery((previous) => ({
                      ...previous,
                      department: event.target.value,
                      province: "",
                      district: "",
                    }))
                  }
                >
                  <option value="">Selecciona departamento</option>
                  {departments.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-xs font-medium">
                Provincia
                <select
                  aria-label="Provincia"
                  className={field}
                  value={delivery.province}
                  disabled={busy || !department}
                  onChange={(event) =>
                    setDelivery((previous) => ({
                      ...previous,
                      province: event.target.value,
                      district: "",
                    }))
                  }
                >
                  <option value="">Selecciona provincia</option>
                  {(department?.provinces ?? []).map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-xs font-medium">
                Distrito
                <select
                  aria-label="Distrito"
                  className={field}
                  value={delivery.district}
                  disabled={busy || !province}
                  onChange={(event) =>
                    setDelivery((previous) => ({ ...previous, district: event.target.value }))
                  }
                >
                  <option value="">Selecciona distrito</option>
                  {(province?.districts ?? []).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 grid gap-1.5 text-xs font-medium">
              {delivery.type === "HOME" ? "Dirección" : "Dirección de la agencia"}
              <input
                className={field}
                autoComplete="street-address"
                required
                minLength={3}
                maxLength={150}
                disabled={busy}
                value={delivery.address}
                onChange={(event) =>
                  setDelivery((previous) => ({ ...previous, address: event.target.value }))
                }
              />
            </label>
            {delivery.type === "AGENCY" ? (
              <label className="mt-3 grid gap-1.5 text-xs font-medium">
                Agencia y sucursal
                <input
                  className={field}
                  required
                  maxLength={150}
                  disabled={busy}
                  value={delivery.agency ?? ""}
                  onChange={(event) =>
                    setDelivery((previous) => ({ ...previous, agency: event.target.value }))
                  }
                />
              </label>
            ) : null}
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Comprobante</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["BOLETA", "Boleta"],
                ["FACTURA", "Factura (RUC)"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setReceipt(
                      value === "BOLETA"
                        ? { type: "BOLETA", dni: "" }
                        : { type: "FACTURA", ruc: "", businessName: "" },
                    )
                  }
                  className={receipt.type === value ? selectedSecondary : secondary}
                >
                  {label}
                </button>
              ))}
            </div>
            {receipt.type === "BOLETA" ? (
              <label className="mt-3 grid gap-1.5 text-xs font-medium">
                DNI del comprador
                <input
                  className={field}
                  required
                  pattern="[0-9]{8}"
                  inputMode="numeric"
                  maxLength={8}
                  disabled={busy}
                  value={receipt.dni}
                  onChange={(event) =>
                    setReceipt({ type: "BOLETA", dni: event.target.value.replace(/\D/g, "") })
                  }
                />
                {receipt.dni && (receipt.dni.length !== 8 || isJunkDni(receipt.dni)) ? (
                  <span className="text-amber-200">Ingresa un DNI válido de 8 dígitos.</span>
                ) : null}
              </label>
            ) : (
              <div className="mt-3 space-y-3">
                <label className="block text-xs font-medium">
                  RUC
                  <input
                    className={field}
                    required
                    pattern="(10|20)[0-9]{9}"
                    inputMode="numeric"
                    maxLength={11}
                    disabled={busy}
                    value={receipt.ruc ?? ""}
                    onChange={(event) =>
                      setReceipt((previous) =>
                        previous.type === "FACTURA"
                          ? { ...previous, ruc: event.target.value.replace(/\D/g, "") }
                          : previous,
                      )
                    }
                  />
                </label>
                <label className="block text-xs font-medium">
                  Razón social
                  <input
                    className={field}
                    required
                    minLength={3}
                    maxLength={150}
                    disabled={busy}
                    value={receipt.businessName ?? ""}
                    onChange={(event) =>
                      setReceipt((previous) =>
                        previous.type === "FACTURA"
                          ? { ...previous, businessName: event.target.value }
                          : previous,
                      )
                    }
                  />
                </label>
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Medio de pago</legend>
            {method ? (
              <div className="grid grid-cols-2 gap-2">
                {data.paymentMethods
                  ?.filter((value) => value === "yape")
                  .map((value) => (
                    <button
                      type="button"
                      key={value}
                      disabled={busy}
                      className={method === value ? selectedSecondary : secondary}
                    >
                      Yape · comprobante
                    </button>
                  ))}
              </div>
            ) : (
              <p className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">
                Este negocio aún no ha habilitado Yape.
              </p>
            )}
          </fieldset>
          {currentQuote ? (
            <div className="space-y-2 rounded-xl border border-[#25F4EE]/20 bg-[#25F4EE]/5 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Productos</span>
                <span>{liveMoney(currentQuote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">
                  Envío
                  {currentQuote.combinedOrderId || currentQuote.combinedOrderNumber
                    ? " (pedido abierto)"
                    : ""}
                </span>
                <span>{liveMoney(currentQuote.shipping)}</span>
              </div>
              {currentQuote.combinedOrderNumber ? (
                <p className="text-xs text-[#9AFBF7]">
                  Se suma a tu pedido {currentQuote.combinedOrderNumber}, sin pagar envío otra vez.
                </p>
              ) : null}
              <div className="flex justify-between border-t border-white/10 pt-2 text-lg font-bold">
                <span>Total</span>
                <span className="text-[#25F4EE]">{liveMoney(currentQuote.total)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">
              El costo de envío y el total se calculan con la información de entrega.
            </p>
          )}
          <button type="submit" className={`${primary} w-full`} disabled={busy || !valid}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {busy
              ? "Procesando…"
              : currentQuote
                ? `Ver instrucciones Yape · ${liveMoney(currentQuote.total)}`
                : "Calcular total"}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-zinc-400">
            El pedido se confirma cuando el negocio valida tu comprobante Yape.
          </p>
        </form>
      </DialogContent>
    </Dialog>
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
