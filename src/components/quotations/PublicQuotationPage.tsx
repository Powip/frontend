"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Truck,
} from "lucide-react";
import type {
  PublicQuotation,
  QuotationCatalogPage,
  QuotationCatalogItem,
  QuotationLine,
  QuotationPaymentMethod,
} from "@/types/quotations";
import PublicQuotationTrackingDetails from "./PublicQuotationTrackingDetails";
import PublicQuotationPaymentDestinations from "./PublicQuotationPaymentDestinations";
import QuotationLocationFields from "./QuotationLocationFields";
import { isCompleteQuotationLocation, quotationLocation } from "./quotationLocations";
import { quotationHttpUrl } from "./quotationHelpers";
import {
  addPublicQuotationLine,
  confirmPublicQuotation,
  getPublicQuotation,
  getPublicQuotationCatalog,
  quotationError,
  quotationMoney,
  registerPublicQuotationPayment,
  removePublicQuotationLine,
  savePublicQuotationAddress,
  uploadPublicQuotationProof,
} from "@/services/quotationService";

const money = quotationMoney;
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const field =
  "mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const trackingStatusLabels: Record<string, string> = {
  PENDIENTE: "Pedido recibido",
  PREPARADO: "En preparación",
  LLAMADO: "Contactándote",
  EN_ENVIO: "En camino",
  ENTREGADO: "Entregado",
  ANULADO: "Anulado",
  LEAD: "Compra pendiente de confirmación",
};

export default function PublicQuotationPage({ token }: { token: string }) {
  const [quote, setQuote] = useState<PublicQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<QuotationCatalogItem[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [method, setMethod] = useState<QuotationPaymentMethod>("YAPE_QR");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [address, setAddress] = useState("");
  const [department, setDepartment] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [reference, setReference] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const requestGeneration = useRef(0);
  const quoteRevision = useRef(0);
  const busyRef = useRef(false);
  const quoteRequest = useRef<{ generation: number; controller: AbortController } | null>(null);
  const catalogRequest = useRef<{ controller: AbortController; key: string } | null>(null);
  const catalogCache = useRef(new Map<string, QuotationCatalogPage & { fetchedAt: number }>());
  const catalogSessionToken = useRef(token);
  const catalogSessionReady = catalogSessionToken.current === token;

  const refresh = useCallback(
    async (initial = false) => {
      const generation = requestGeneration.current;
      if (quoteRequest.current?.generation === generation || busyRef.current) return;
      const revision = quoteRevision.current;
      const controller = new AbortController();
      quoteRequest.current = { generation, controller };
      try {
        const data = await getPublicQuotation(token, { signal: controller.signal });
        if (generation !== requestGeneration.current || revision !== quoteRevision.current || controller.signal.aborted) return;
        setQuote(data);
        if (initial) {
          const location = quotationLocation(data.address);
          setAddress(data.address?.address ?? "");
          setDepartment(location.department);
          setProvince(location.province);
          setDistrict(location.district);
          setReference(data.address?.reference ?? "");
          setDocumentNumber(data.address?.documentNumber ?? "");
        }
        setError("");
      } catch (cause) {
        if (generation !== requestGeneration.current || revision !== quoteRevision.current || controller.signal.aborted) return;
        setError(quotationError(cause));
      } finally {
        if (quoteRequest.current?.controller === controller) quoteRequest.current = null;
        if (generation === requestGeneration.current) setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    requestGeneration.current += 1;
    setLoading(true);
    setQuote(null);
    setError("");
    setNotice("");
    setBusy(false);
    busyRef.current = false;
    setCatalog([]);
    setCatalogOpen(false);
    setCatalogLoading(false);
    setCatalogSearch("");
    setCatalogQuery("");
    setCatalogPage(0);
    setCatalogHasMore(false);
    setPaymentOpen(false);
    setProof(null);
    setAddress("");
    setDepartment("");
    setProvince("");
    setDistrict("");
    setReference("");
    setDocumentNumber("");
    catalogCache.current.clear();
    catalogSessionToken.current = token;
    void refresh(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      requestGeneration.current += 1;
      quoteRequest.current?.controller.abort();
      quoteRequest.current = null;
      catalogRequest.current?.controller.abort();
      catalogRequest.current = null;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => setCatalogQuery(catalogSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [catalogSearch]);

  const loadCatalog = useCallback(async (page: number, search: string) => {
    const generation = requestGeneration.current;
    const revision = quoteRevision.current;
    const key = `${search}\u0000${page}`;
    if (catalogRequest.current?.key === key) return;
    catalogRequest.current?.controller.abort();
    catalogRequest.current = null;
    const cached = page === 1 ? catalogCache.current.get(search) : undefined;
    if (cached && Date.now() - cached.fetchedAt < 30_000) {
      setCatalog(cached.data);
      setCatalogPage(cached.page);
      setCatalogHasMore(cached.hasMore);
      setCatalogLoading(false);
      return;
    }
    const controller = new AbortController();
    catalogRequest.current = { controller, key };
    setCatalogLoading(true);
    if (page === 1) {
      setCatalog([]);
      setCatalogPage(0);
      setCatalogHasMore(false);
    }
    try {
      const response = await getPublicQuotationCatalog(token, { signal: controller.signal, search, page, limit: 30 });
      if (generation !== requestGeneration.current || revision !== quoteRevision.current || controller.signal.aborted) return;
      const result: QuotationCatalogPage = Array.isArray(response)
        ? { data: response, page, limit: 30, hasMore: false }
        : response;
      setCatalog((previous) => {
        if (page === 1) return result.data;
        const combined = new Map(previous.map((item) => [item.productVariantId, item]));
        result.data.forEach((item) => combined.set(item.productVariantId, item));
        return [...combined.values()];
      });
      setCatalogPage(result.page);
      setCatalogHasMore(result.hasMore);
      if (page === 1) {
        catalogCache.current.set(search, { ...result, fetchedAt: Date.now() });
        if (catalogCache.current.size > 8) catalogCache.current.delete(catalogCache.current.keys().next().value!);
      }
    } catch (cause) {
      if (generation !== requestGeneration.current || revision !== quoteRevision.current || controller.signal.aborted) return;
      setError(quotationError(cause));
    } finally {
      if (catalogRequest.current?.controller === controller) catalogRequest.current = null;
      if (generation === requestGeneration.current && !controller.signal.aborted) setCatalogLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!catalogOpen || !catalogSessionReady) return;
    void loadCatalog(1, catalogQuery);
    return () => {
      catalogRequest.current?.controller.abort();
      catalogRequest.current = null;
    };
  }, [catalogOpen, catalogQuery, loadCatalog, catalogSessionReady]);

  async function act(action: () => Promise<PublicQuotation>, success: string) {
    const generation = requestGeneration.current;
    setBusy(true);
    busyRef.current = true;
    quoteRevision.current += 1;
    catalogCache.current.clear();
    setError("");
    setNotice("");
    try {
      const data = await action();
      if (generation !== requestGeneration.current) return;
      setQuote(data);
      setNotice(success);
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      setError(quotationError(cause));
    } finally {
      if (generation === requestGeneration.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) return;
    const generation = requestGeneration.current;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingresa un monto válido.");
      return;
    }
    if (quote.paymentType === "COMPLETO" && amount < quote.total) {
      setError(
        `Para confirmar este pedido debes registrar el pago completo de ${money(quote.total)}.`,
      );
      return;
    }
    setBusy(true);
    busyRef.current = true;
    quoteRevision.current += 1;
    setError("");
    setNotice("");
    try {
      const proofUrl = proof ? await uploadPublicQuotationProof(token, proof) : undefined;
      if (generation !== requestGeneration.current) return;
      const data = await registerPublicQuotationPayment(token, { amount, method, proofUrl });
      if (generation !== requestGeneration.current) return;
      setQuote(data);
      setPaymentOpen(false);
      setProof(null);
      setNotice("Pago reportado. El vendedor revisará el comprobante antes de aprobarlo.");
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      setError(quotationError(cause));
    } finally {
      if (generation === requestGeneration.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin" />
        Cargando tu cotización…
      </div>
    );
  if (!quote)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-amber-500" size={36} />
          <h1 className="text-xl font-bold">No encontramos esta cotización</h1>
          <p role="alert" className="my-4 text-sm text-slate-500">
            {error || "Revisa el enlace que te compartió el vendedor."}
          </p>
          <button
            className={secondary}
            onClick={() => {
              setLoading(true);
              void refresh(true);
            }}
          >
            <RefreshCw size={16} />
            Volver a intentar
          </button>
        </div>
      </div>
    );

  const converted = quote.status === "CONVERTIDA";
  const orderTracking = converted ? quote.tracking : null;
  const trackingStatus = orderTracking?.status ?? quote.trackingStatus ?? "PENDIENTE";
  const cancelled = converted && trackingStatus === "ANULADO";
  const awaitingConfirmation = converted && trackingStatus === "LEAD";
  const customerName = orderTracking?.customer.fullName ?? quote.customerName;
  const businessName = orderTracking ? orderTracking.businessName : quote.businessName ?? quote.storeName;
  const orderNumber = orderTracking?.orderNumber ?? quote.orderNumber;
  const verifiedBalance = orderTracking?.totals.pendingAmount ?? quote.verifiedBalance;
  const displayLines: QuotationLine[] = orderTracking
    ? orderTracking.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        variant: item.attributes
          ? Object.entries(item.attributes).map(([key, value]) => `${key}: ${String(value)}`).join(" | ")
          : undefined,
      }))
    : quote.lines;
  const expired =
    quote.status === "VENCIDA" || (!converted && new Date(quote.expiresAt).getTime() <= Date.now());
  const active = !converted && !expired;
  const stockProblem = quote.lines.some((line) => line.stockInsufficient);
  const activePayment = quote.payments[quote.payments.length - 1];
  const pendingPayment =
    !cancelled && activePayment?.status === "PENDIENTE" && !(converted && verifiedBalance === 0)
      ? activePayment
      : undefined;
  const fullyPaid =
    verifiedBalance != null
      ? verifiedBalance <= 0
      : quote.pendingBalance <= 0 && !pendingPayment;
  const stage = /ENTREGAD|DELIVERED/i.test(trackingStatus)
    ? 3
    : /EN_ENVIO|ENVIAD|CAMINO|TRANSIT/i.test(trackingStatus)
      ? 2
      : /PREPAR|CONFIRM/i.test(trackingStatus)
        ? 1
        : 0;
  const stages = converted
    ? ["Pedido recibido", "En preparación", "En camino", "Entregado"]
    : ["Cotización enviada", "Confirmada por ti", "En preparación", "Entregado"];
  const stageIndex = converted ? stage : quote.customerConfirmed ? 1 : 0;
  const timeline = orderTracking?.timeline ?? stages.map((label, index) => ({
    step: label,
    label,
    completed: index < stageIndex,
    current: index === stageIndex,
  }));
  const sellerPhone = (orderTracking ? orderTracking.businessPhone : quote.businessPhone ?? quote.sellerPhone)?.replace(/\D/g, "");
  const whatsapp = sellerPhone
    ? `https://wa.me/${sellerPhone.length === 9 ? `51${sellerPhone}` : sellerPhone}?text=${encodeURIComponent(`Hola, quisiera consultar sobre ${quote.number}.`)}`
    : null;
  const visibleCatalog = catalog.filter((item) => item.stockAvailable != null && item.stockAvailable > 0);
  const catalogSearching = catalogSearch.trim() !== catalogQuery;

  return (
    <div className="min-h-screen bg-[#f4f7f7] px-4 py-6 text-slate-800 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex items-center justify-between">
          <a
            href="https://powip.lat"
            className="text-xl font-extrabold tracking-wide text-violet-700"
            aria-label="POWIP"
          >
            POWIP<span className="text-teal-600">.</span>
          </a>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
            {quote.number}
          </span>
        </header>
        <section className="rounded-3xl bg-teal-800 px-6 py-8 text-white sm:px-9">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
            {cancelled ? (
              <AlertCircle />
            ) : expired || awaitingConfirmation ? (
              <Clock3 />
            ) : converted ? (
              <Truck />
            ) : quote.customerConfirmed ? (
              <CheckCircle2 />
            ) : (
              <ShoppingBag />
            )}
          </div>
          <p className="mb-2 text-sm text-teal-100">Hola, {customerName}</p>
          {businessName && (
            <p className="mb-2 text-sm font-semibold text-teal-100">{businessName}</p>
          )}
          <h1 className="text-2xl font-bold sm:text-3xl">
            {cancelled
              ? "Tu pedido fue anulado"
              : expired
                ? "Tu cotización ha vencido"
                : awaitingConfirmation
                  ? "Compra pendiente de confirmación"
                  : converted
                    ? "Sigue tu pedido"
                    : quote.customerConfirmed
                      ? "Pedido confirmado"
                      : "Esperando tu confirmación"}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-teal-50/85">
            {cancelled
              ? `Tu pedido ${orderNumber ?? ""} fue anulado. Contacta al vendedor si necesitas ayuda.`
              : expired
                ? "El precio y el stock pueden haber cambiado. Contacta al vendedor para renovar tu cotización."
                : awaitingConfirmation
                  ? "El vendedor está revisando tu compra. Aquí verás el avance cuando esté confirmada."
                  : converted
                    ? `Tu pedido ${orderNumber ?? ""} ya está registrado. Aquí podrás consultar su avance.`
                    : quote.paymentType === "COMPLETO"
                      ? "Revisa tus productos y reporta el pago completo para confirmar tu pedido."
                      : "Confirma tu pedido o adelanta un monto. Podrás pagar el saldo contraentrega."}
          </p>
          {orderTracking && !cancelled && (
            <p className="mt-3 text-sm font-semibold">
              Estado actual: {trackingStatusLabels[trackingStatus] ?? trackingStatus.replace(/_/g, " ")}
            </p>
          )}
        </section>

        {!expired && !cancelled && (
          <ol aria-label="Estado del pedido" className="my-7 grid auto-cols-fr grid-flow-col gap-2">
            {timeline.map((item, index) => (
              <li
                key={item.step}
                aria-current={item.current ? "step" : undefined}
                className="text-center"
              >
                <span
                  className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${item.completed || item.current ? "bg-teal-700 text-white" : "bg-slate-200 text-slate-400"}`}
                >
                  {item.completed || item.current ? <Check size={15} /> : index + 1}
                </span>
                <span
                  className={`block text-[11px] sm:text-xs ${item.completed || item.current ? "font-semibold text-teal-800" : "text-slate-400"}`}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ol>
        )}
        {error && (
          <div
            role="alert"
            className="my-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}
        {notice && !cancelled && (
          <div
            role="status"
            className="my-4 flex gap-2 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800"
          >
            <CheckCircle2 size={18} className="shrink-0" />
            {notice}
          </div>
        )}

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Package size={19} className="text-teal-700" />
              {converted ? "Resumen del pedido" : "Tu cotización"}
            </h2>
            <button
              aria-label="Actualizar cotización"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"
              disabled={busy}
              onClick={() => void refresh()}
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="divide-y divide-slate-100 px-6">
            {displayLines.map((line, index) => (
              <div key={line.id ?? index} className="flex items-start justify-between gap-4 py-5">
                {quotationHttpUrl(line.imageUrl) && (
                  <img src={quotationHttpUrl(line.imageUrl)!} alt={line.name} width={64} height={64} loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{line.name}</p>
                  {line.variant && <p className="mt-1 text-xs text-slate-500">{line.variant}</p>}
                  <p className="mt-1 text-sm text-slate-500">
                    {line.quantity} × {money(line.unitPrice)}
                  </p>
                  {line.isPack && (
                    <span className="mt-2 inline-block rounded bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
                      PACK
                    </span>
                  )}
                  {line.stockInsufficient && active && (
                    <div className="mt-3 text-xs text-red-600">
                      <p>
                        Ya no hay stock suficiente
                        {line.stockAvailable != null ? `; quedan ${line.stockAvailable}` : ""}.
                      </p>
                      {line.id && (
                        <button
                          className="mt-2 underline underline-offset-2 disabled:opacity-50"
                          disabled={busy || quote.lines.length === 1}
                          onClick={() =>
                            void act(
                              () => removePublicQuotationLine(token, line.id!),
                              "Producto retirado del pedido.",
                            )
                          }
                        >
                          Quitar del pedido
                        </button>
                      )}
                      {quote.lines.length === 1 && (
                        <p className="mt-2 text-slate-500">
                          Agrega otro producto antes de quitar el último del pedido.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <span className="whitespace-nowrap font-bold">
                  {money(orderTracking?.items[index]?.subtotal ?? line.quantity * line.unitPrice)}
                </span>
              </div>
            ))}
          </div>
          {orderTracking?.customerNotes?.trim() && (
            <div className="border-t border-slate-100 px-6 py-5">
              <h3 className="font-semibold">Comentarios del pedido</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 [overflow-wrap:anywhere]">
                {orderTracking.customerNotes}
              </p>
            </div>
          )}
          {orderTracking && (cancelled || awaitingConfirmation) && (
            <p className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
              Pagos aprobados registrados: {money(orderTracking.totals.totalPaid)}
            </p>
          )}
          <div className="flex items-center justify-between bg-slate-50 px-6 py-5">
            <span className="font-semibold">
              {orderTracking ? "Total del pedido" : `Total ${converted ? "de productos" : "cotizado"}`}
            </span>
            <span className="text-2xl font-extrabold text-teal-800">
              {money(orderTracking?.totals.grandTotal ?? quote.total)}
            </span>
          </div>
        </section>

        {pendingPayment && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Pago por verificar: {money(pendingPayment.amount)}</p>
            <p className="mt-1 text-xs">
              El vendedor revisará el pago reportado. Aún no figura como aprobado.
            </p>
          </div>
        )}

        {active && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <button
              className="flex w-full items-center justify-between text-left font-semibold text-teal-800"
              aria-expanded={catalogOpen}
              onClick={() => setCatalogOpen((open) => !open)}
            >
              <span className="flex items-center gap-2">
                <Plus size={18} />
                Agregar más productos
              </span>
              <span>{catalogOpen ? "−" : "+"}</span>
            </button>
            {catalogOpen && (
              <div className="mt-4">
                <p className="mb-3 text-xs text-slate-500">
                  Los productos nuevos se agregan con su precio actual y el stock disponible.
                </p>
                <input
                  className={field}
                  aria-label="Buscar productos"
                  placeholder="Buscar por producto o SKU"
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                />
                {catalogSearching || (catalogLoading && catalogPage === 0) ? (
                  <p className="py-5 text-sm text-slate-400">Cargando productos…</p>
                ) : (
                  <div className="mt-3 max-h-80 divide-y divide-slate-100 overflow-auto">
                    {visibleCatalog.length === 0 && (
                      <p className="py-5 text-sm text-slate-500">
                        {catalogHasMore ? "No hay productos con stock en esta página. Puedes cargar más." : "No hay productos disponibles."}
                      </p>
                    )}
                    {visibleCatalog.map((item) => (
                      <div
                        key={item.productVariantId}
                        className="flex items-center justify-between gap-3 py-4"
                      >
                        <div>
                          <p className="text-sm font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.variant} · {money(item.unitPrice)}
                          </p>
                        </div>
                        <button
                          className={secondary}
                          disabled={busy || item.stockAvailable == null || item.stockAvailable < 1}
                          onClick={() =>
                            void act(
                              () => addPublicQuotationLine(token, item.productVariantId),
                              "Producto agregado a tu cotización.",
                            )
                          }
                        >
                          <Plus size={14} />
                          {item.stockAvailable === 0
                            ? "Sin stock"
                            : item.stockAvailable == null
                              ? "No disponible"
                              : "Agregar"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {catalogHasMore && !catalogSearching && (
                  <button
                    type="button"
                    className={`${secondary} mt-4 w-full`}
                    disabled={catalogLoading}
                    onClick={() => void loadCatalog(catalogPage + 1, catalogQuery)}
                  >
                    {catalogLoading ? "Cargando…" : "Cargar más productos"}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {active && !quote.customerConfirmed && (
          <section className="mt-5 rounded-2xl border border-teal-200 bg-white p-6">
            <h2 className="font-bold">Completa tu confirmación</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {quote.paymentType === "COMPLETO"
                ? "Este pedido requiere el pago completo. El vendedor verificará el pago que reportes."
                : "Puedes confirmar sin costo o registrar un adelanto para tu pedido."}
            </p>
            {stockProblem && (
              <p className="mt-3 text-sm text-red-600">
                Quita los productos sin stock suficiente antes de continuar.
              </p>
            )}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {quote.paymentType === "ADELANTO" && (
                <button
                  className={primary}
                  disabled={busy || stockProblem}
                  onClick={() =>
                    void act(
                      () => confirmPublicQuotation(token),
                      "Pedido confirmado. Completa tu dirección de entrega.",
                    )
                  }
                >
                  <CheckCircle2 size={17} />
                  Confirmar pedido
                </button>
              )}
              <button
                className={quote.paymentType === "COMPLETO" ? primary : secondary}
                disabled={busy || stockProblem}
                onClick={() => {
                  setPaymentAmount(
                    String(
                      quote.paymentType === "COMPLETO"
                        ? quote.total
                        : (quote.suggestedDeposit ?? Math.round(quote.total * 0.3 * 100) / 100),
                    ),
                  );
                  setPaymentOpen(true);
                }}
              >
                <CreditCard size={17} />
                {quote.paymentType === "COMPLETO"
                  ? `Pagar ${money(quote.total)} ahora`
                  : `Pagar adelanto de ${money(quote.suggestedDeposit ?? quote.total * 0.3)}`}
              </button>
            </div>
          </section>
        )}

        {active &&
          quote.customerConfirmed &&
          quote.paymentType === "ADELANTO" &&
          (!activePayment || activePayment.status === "RECHAZADO") && (
            <section className="mt-5 rounded-2xl border border-teal-200 bg-white p-6">
              <h2 className="font-bold">Puedes adelantar un pago</h2>
              <p className="mt-2 text-sm text-slate-500">
                Tu pedido ya está confirmado. Si deseas, reporta un adelanto y paga el saldo
                contraentrega.
              </p>
              <button
                className={`${secondary} mt-4`}
                disabled={busy || stockProblem}
                onClick={() => {
                  setPaymentAmount(
                    String(quote.suggestedDeposit ?? Math.round(quote.total * 0.3 * 100) / 100),
                  );
                  setPaymentOpen(true);
                }}
              >
                <CreditCard size={17} />
                Pagar adelanto de {money(quote.suggestedDeposit ?? quote.total * 0.3)}
              </button>
            </section>
          )}

        {active && paymentOpen && (
          <section className="mt-5 rounded-2xl border border-violet-200 bg-white p-6">
            <h2 className="font-bold">Reportar un pago</h2>
            <PublicQuotationPaymentDestinations destinations={quote.paymentDestinations} />
            <form className="mt-5 space-y-4" onSubmit={submitPayment}>
              <label className="block text-sm font-semibold">
                Método de pago
                <select
                  className={field}
                  value={method}
                  onChange={(event) => setMethod(event.target.value as QuotationPaymentMethod)}
                >
                  <option value="YAPE_QR">Yape / Plin</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="MERCADO_PAGO">Mercado Pago</option>
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Monto pagado (S/)
                <input
                  className={field}
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold">
                Comprobante{" "}
                <span className="font-normal text-slate-400">(opcional, máximo 5 MB)</span>
                <input
                  className={`${field} text-xs`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => setProof(event.target.files?.[0] ?? null)}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="submit" className={primary} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}Ya
                  pagué, avisar al vendedor
                </button>
                <button
                  type="button"
                  className={secondary}
                  disabled={busy}
                  onClick={() => setPaymentOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )}

        {active && quote.customerConfirmed && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <MapPin size={18} className="text-teal-700" />
              Dirección de entrega
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Completa estos datos para que el vendedor pueda despachar tu pedido.
            </p>
            <form
              className="mt-5 space-y-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!address.trim() || !isCompleteQuotationLocation({ department, province, district })) {
                  setError("Completa tu dirección y selecciona departamento, provincia y distrito.");
                  return;
                }
                if (documentNumber && !/^\d{8}$/.test(documentNumber)) {
                  setError("El DNI debe tener 8 dígitos.");
                  return;
                }
                void act(
                  () =>
                    savePublicQuotationAddress(token, {
                      address: address.trim(),
                      department,
                      province,
                      district,
                      reference: reference.trim(),
                      documentNumber,
                    }),
                  "Dirección guardada. El vendedor ya puede verla.",
                );
              }}
            >
              <label className="block text-sm font-semibold">
                Dirección completa
                <input
                  className={field}
                  maxLength={150}
                  required
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Calle, número, piso o departamento"
                />
              </label>
              <QuotationLocationFields
                idPrefix="public-delivery"
                value={{ department, province, district }}
                disabled={busy}
                onChange={(location) => {
                  setDepartment(location.department);
                  setProvince(location.province);
                  setDistrict(location.district);
                }}
              />
              <label className="block text-sm font-semibold">
                Referencia (opcional)
                <input className={field} maxLength={150} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Frente al parque, puerta azul…" />
              </label>
              <label className="block text-sm font-semibold">
                DNI (opcional)
                <input className={field} inputMode="numeric" maxLength={8} value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value.replace(/\D/g, ""))} placeholder="8 dígitos" />
              </label>
              <button
                className={primary}
                disabled={busy || !address.trim() || !isCompleteQuotationLocation({ department, province, district })}
                type="submit"
              >
                <Check size={16} />
                Guardar dirección
              </button>
            </form>
          </section>
        )}

        {orderTracking && <PublicQuotationTrackingDetails tracking={orderTracking} />}

        {converted && !cancelled && !awaitingConfirmation && !orderTracking && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-bold">Información de entrega</h2>
            <p className="mt-3 text-sm text-slate-600">{quote.customerName}</p>
            <p className="mt-1 text-sm text-slate-500">
              {quote.address
                ? `${quote.address.address}, ${quote.address.district}`
                : "Coordinada por WhatsApp"}
            </p>
            <div className="mt-5 rounded-xl bg-teal-50 p-4 text-sm font-semibold text-teal-800">
              {fullyPaid
                ? "Pedido pagado en su totalidad"
                : `Saldo pendiente${quote.paymentType === "ADELANTO" ? " contraentrega" : ""}: ${money(quote.pendingBalance)}`}
            </div>
          </section>
        )}

        <footer className="mt-7 pb-5 text-center">
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={secondary}>
              <MessageCircle size={17} />
              {expired ? "Pedir cotización nueva" : "Escribir al vendedor"}
              <ArrowRight size={14} />
            </a>
          )}
          {active && (
            <p className="mt-4 text-xs text-slate-400">
              Vigente hasta{" "}
              {new Date(quote.expiresAt).toLocaleString("es-PE", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/Lima",
              })}
            </p>
          )}
          <p className="mt-4 text-xs text-slate-400">
            Gestionado con POWIP · Un solo enlace para tu compra y seguimiento.
          </p>
        </footer>
      </div>
    </div>
  );
}
