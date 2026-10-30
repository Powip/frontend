"use client";

import { Check, CreditCard, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
import LiveCheckoutDetails, { type LiveCheckoutDetailGroup } from "./LiveCheckoutDetails";
import LiveCheckoutSteps from "./LiveCheckoutSteps";
import LiveManualPaymentDialog from "./LiveManualPaymentDialog";
import {
  checkoutLivePurchase,
  isLiveCustomerReviewRequired,
  isLiveDeliveryReviewRequired,
  isLiveQuoteConflict,
  liveError,
  liveMoney,
  quoteLivePurchase,
} from "./liveService";
import type {
  LiveCheckoutSnapshot,
  LiveCustomer,
  LivePaymentMethod,
  LivePublicData,
  LivePurchaseInput,
  LiveQuote,
  LiveQuoteInput,
} from "./types";

export type LiveCheckoutDraft = {
  delivery: LivePurchaseInput["delivery"];
  receipt: LivePurchaseInput["receipt"];
};
type CheckoutFieldName =
  | "name"
  | "phone"
  | "department"
  | "province"
  | "district"
  | "address"
  | "agency"
  | "dni"
  | "ruc"
  | "businessName";
const departments: { name: string; provinces: { name: string; districts: string[] }[] }[] =
  ubigeos[0].departments;
const primary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25F4EE] px-4 py-3 text-sm font-bold text-[#0B0B0F] hover:bg-[#78FAF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE] disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-[#25F4EE]/60 hover:bg-white/10 focus-within:ring-2 focus-within:ring-[#25F4EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE] disabled:opacity-40";
const selectedSecondary = cn(secondary, "border-[#25F4EE] bg-[#25F4EE]/10 text-[#25F4EE]");
const field =
  "mt-1.5 w-full min-w-0 rounded-xl border border-white/15 bg-black/50 px-3 py-3 text-base text-white outline-none placeholder:text-zinc-400 focus:border-[#25F4EE] focus:ring-2 focus:ring-[#25F4EE]/20 aria-invalid:border-[#FE2C55] disabled:opacity-50 sm:text-sm";
const customerValid = (customer: LiveCustomer) =>
  customer.name.trim().length >= 3 &&
  customer.name.trim().length <= 120 &&
  /^9\d{8}$/.test(customer.phone);

type LiveCheckoutDialogProps = {
  storeId: string;
  visitor: string;
  data: LivePublicData;
  selection: { items: { variantId: string; quantity: number }[]; reservationIds?: string[] };
  customer: LiveCustomer;
  onCustomerChange: (customer: LiveCustomer) => void;
  onClose: () => void;
  onUpdated: () => void;
  onCheckoutCreated?: () => void;
  initialDraft?: LiveCheckoutDraft;
  onDraftChange?: (draft: LiveCheckoutDraft) => void;
};

export default function LiveCheckoutDialog(props: LiveCheckoutDialogProps) {
  return <LiveCheckoutForm key={`${props.storeId}/${props.visitor}`} {...props} />;
}

function LiveCheckoutForm({
  storeId,
  visitor,
  data,
  selection,
  customer,
  onCustomerChange,
  onClose,
  onUpdated,
  onCheckoutCreated,
  initialDraft,
  onDraftChange,
}: LiveCheckoutDialogProps) {
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
  const [step, setStep] = useState<1 | 2>(1);
  const [reviewedSelection, setReviewedSelection] = useState("");
  const [touchedFields, setTouchedFields] = useState<Partial<Record<CheckoutFieldName, boolean>>>(
    {},
  );
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const editTarget = useRef<LiveCheckoutDetailGroup | null>(null);
  const [customerReviewRequired, setCustomerReviewRequired] = useState(false);
  const [deliveryReviewRequired, setDeliveryReviewRequired] = useState(false);
  const customerNameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const [delivery, setDelivery] = useState<LivePurchaseInput["delivery"]>(
    initialDraft?.delivery ?? {
      type: deliveryMethods[0] ?? "HOME",
      department: "",
      province: "",
      district: "",
      address: "",
      agency: "",
    },
  );
  const [receipt, setReceipt] = useState<LivePurchaseInput["receipt"]>(
    initialDraft?.receipt ?? {
      type: "BOLETA",
      dni: "",
    },
  );
  const method: LivePaymentMethod | "" = data.paymentMethods?.includes("yape") ? "yape" : "";
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [quoteChanged, setQuoteChanged] = useState(false);
  const hasQuoted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const focusError = useRef(true);
  const [pendingQuoteSelection, setPendingQuoteSelection] = useState("");
  const [failedQuoteSelection, setFailedQuoteSelection] = useState("");
  const quoteRequest = useRef(0);
  const quoteTimer = useRef<number | undefined>(undefined);
  const activeQuote = useRef<{ selection: string; request: number } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [quoteDeadline, setQuoteDeadline] = useState(0);
  const [expiredQuoteId, setExpiredQuoteId] = useState("");
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const draftCallback = useRef(onDraftChange);
  useEffect(() => {
    draftCallback.current = onDraftChange;
  }, [onDraftChange]);
  useEffect(() => {
    draftCallback.current?.({ delivery, receipt });
  }, [delivery, receipt]);
  useEffect(() => {
    if (error && focusError.current) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (step === 2) {
      reviewHeading.current?.focus();
      return;
    }
    const group = editTarget.current;
    if (!group && !customerReviewRequired && !deliveryReviewRequired) return;
    editTarget.current = null;
    const frame = requestAnimationFrame(() => {
      const target =
        group === "receipt"
          ? formRef.current?.querySelector<HTMLInputElement>('[data-receipt-document="true"]')
          : group === "delivery" || deliveryReviewRequired
            ? addressRef.current
            : customerNameRef.current;
      target?.scrollIntoView?.({ block: "center" });
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [step, customerReviewRequired, deliveryReviewRequired]);
  useEffect(() => {
    if (!quote || !quoteDeadline) return;
    const quoteId = quote.quoteId;
    let timeout: number;
    function scheduleExpiry() {
      const remaining = quoteDeadline - Date.now();
      if (remaining <= 0) setExpiredQuoteId(quoteId);
      else timeout = window.setTimeout(scheduleExpiry, Math.min(2_147_483_647, remaining));
    }
    scheduleExpiry();
    return () => window.clearTimeout(timeout);
  }, [quote, quoteDeadline]);
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
  const latestSelection = useRef(inputSelection);
  useEffect(() => {
    if (latestSelection.current !== inputSelection) {
      setQuote(null);
      setQuoteSelection("");
      setQuoteChanged(hasQuoted.current);
    }
    latestSelection.current = inputSelection;
    setError("");
    setCustomerReviewRequired(false);
    setDeliveryReviewRequired(false);
    setReviewedSelection("");
    setStep(1);
  }, [inputSelection]);
  const quoting = pendingQuoteSelection === inputSelection;
  const matchingQuote = quoteSelection === inputSelection ? quote : null;
  const quoteExpired =
    !!matchingQuote && (expiredQuoteId === matchingQuote.quoteId || quoteDeadline <= Date.now());
  const currentQuote = matchingQuote && !quoteExpired ? matchingQuote : null;
  const department = departments.find((item) => item.name === delivery.department);
  const province = department?.provinces.find((item) => item.name === delivery.province);
  const locationValid =
    !!province?.districts.includes(delivery.district) &&
    [delivery.department, delivery.province, delivery.district].every(
      (value) => value.length >= 2 && value.length <= 50,
    );
  const issues = {
    name:
      customer.name.trim().length < 3 || customer.name.trim().length > 120
        ? "Ingresa un nombre de 3 a 120 caracteres."
        : "",
    phone: !/^9\d{8}$/.test(customer.phone)
      ? "Ingresa un WhatsApp de 9 dígitos que empiece por 9."
      : "",
    department: !department ? "Selecciona el departamento." : "",
    province: !province ? "Selecciona la provincia." : "",
    district: !locationValid ? "Selecciona un distrito válido." : "",
    address:
      delivery.address.trim().length < 3 || delivery.address.trim().length > 150
        ? "Ingresa una dirección de 3 a 150 caracteres."
        : "",
    agency:
      delivery.type === "AGENCY" &&
      (!delivery.agency?.trim() || delivery.agency.trim().length > 150)
        ? "Ingresa la agencia y sucursal (máximo 150 caracteres)."
        : "",
    dni:
      receipt.type === "BOLETA" && (!/^\d{8}$/.test(receipt.dni) || isJunkDni(receipt.dni))
        ? "Ingresa un DNI válido de 8 dígitos."
        : "",
    ruc:
      receipt.type === "FACTURA" && !/^(10|20)\d{9}$/.test(receipt.ruc)
        ? "Ingresa un RUC de 11 dígitos que empiece por 10 o 20."
        : "",
    businessName:
      receipt.type === "FACTURA" &&
      (receipt.businessName.trim().length < 3 || receipt.businessName.trim().length > 150)
        ? "Ingresa una razón social de 3 a 150 caracteres."
        : "",
  };
  const missingFields = Object.values(issues).filter(Boolean);
  const deliveryAvailable = deliveryMethods.includes(delivery.type);
  const valid = customerValid(customer) && !missingFields.length && deliveryAvailable && !!method;
  function feedbackProps(name: CheckoutFieldName) {
    const invalid = !!issues[name];
    const visible = showErrors || touchedFields[name];
    return {
      "aria-invalid": (visible && invalid) || undefined,
      "aria-describedby": visible && invalid ? `${formId}-${name}-error` : undefined,
      "data-checkout-invalid": invalid ? "true" : undefined,
      onBlur: () => setTouchedFields((previous) => ({ ...previous, [name]: true })),
    };
  }
  function feedback(name: CheckoutFieldName) {
    return (showErrors || touchedFields[name]) && issues[name] ? (
      <span id={`${formId}-${name}-error`} className="mt-1 block text-xs text-[#FFB5C4]">
        {issues[name]}
      </span>
    ) : null;
  }
  function reviewFields() {
    setShowErrors(true);
    formRef.current
      ?.querySelector<HTMLElement>('[data-checkout-invalid="true"]:not(:disabled)')
      ?.focus();
  }
  function modify(group: LiveCheckoutDetailGroup) {
    editTarget.current = group;
    setReviewedSelection("");
    setStep(1);
  }
  function acceptQuote(result: LiveQuote, selectionKey: string) {
    hasQuoted.current = true;
    setQuoteChanged(false);
    const expires = Date.parse(result.expiresAt);
    const serverNow = result.serverNow ? Date.parse(result.serverNow) : Date.now();
    setQuoteDeadline(
      Number.isFinite(expires) && Number.isFinite(serverNow)
        ? Date.now() + Math.max(0, expires - serverNow)
        : Date.now(),
    );
    setExpiredQuoteId("");
    setQuote(result);
    setQuoteSelection(selectionKey);
  }
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
  async function calculate(shouldFocusError = true) {
    window.clearTimeout(quoteTimer.current);
    if (currentQuote) return currentQuote;
    if (lock.current || !valid || activeQuote.current?.selection === inputSelection) return null;
    focusError.current = shouldFocusError;
    const request = ++quoteRequest.current;
    activeQuote.current = { selection: inputSelection, request };
    setPendingQuoteSelection(inputSelection);
    setError("");
    setCustomerReviewRequired(false);
    setDeliveryReviewRequired(false);
    const selectionKey = inputSelection;
    try {
      const result = await quoteLivePurchase(storeId, visitor, selectionInput());
      if (
        current.current &&
        request === quoteRequest.current &&
        latestSelection.current === selectionKey
      ) {
        setFailedQuoteSelection("");
        acceptQuote(result, selectionKey);
        return result;
      }
    } catch (cause) {
      if (
        current.current &&
        request === quoteRequest.current &&
        latestSelection.current === selectionKey
      ) {
        setFailedQuoteSelection(selectionKey);
        setError(liveError(cause));
        setCustomerReviewRequired(isLiveCustomerReviewRequired(cause));
        setDeliveryReviewRequired(isLiveDeliveryReviewRequired(cause));
        if (isLiveCustomerReviewRequired(cause) || isLiveDeliveryReviewRequired(cause)) {
          setStep(1);
          setReviewedSelection("");
          setQuote(null);
          setQuoteSelection("");
        }
        onUpdated();
      }
    } finally {
      if (activeQuote.current?.request === request) activeQuote.current = null;
      if (current.current && request === quoteRequest.current) setPendingQuoteSelection("");
    }
    return null;
  }
  async function reviewPurchase() {
    if (!valid) {
      reviewFields();
      return;
    }
    const selectionKey = inputSelection;
    const result = await calculate();
    if (result && current.current && latestSelection.current === selectionKey) {
      setReviewedSelection(selectionKey);
      setStep(2);
    }
  }
  const calculateRef = useRef(calculate);
  useEffect(() => {
    calculateRef.current = calculate;
  });
  useEffect(() => {
    if (
      !valid ||
      currentQuote ||
      quoteExpired ||
      busy ||
      manualCheckout ||
      failedQuoteSelection === inputSelection
    )
      return;
    quoteTimer.current = window.setTimeout(() => void calculateRef.current(false), 600);
    return () => window.clearTimeout(quoteTimer.current);
  }, [
    inputSelection,
    valid,
    currentQuote,
    quoteExpired,
    busy,
    manualCheckout,
    failedQuoteSelection,
  ]);
  async function checkout() {
    if (
      lock.current ||
      !valid ||
      !currentQuote ||
      step !== 2 ||
      reviewedSelection !== inputSelection
    )
      return;
    if (quoteDeadline <= Date.now()) {
      setExpiredQuoteId(currentQuote.quoteId);
      return;
    }
    lock.current = true;
    focusError.current = true;
    setBusy(true);
    setError("");
    setCustomerReviewRequired(false);
    setDeliveryReviewRequired(false);
    try {
      const result = await checkoutLivePurchase(storeId, visitor, input(currentQuote));
      if (result.manualPayment && result.checkoutId) {
        if (current.current) {
          setManualCheckout({
            customer,
            delivery,
            receipt,
            ...result,
            checkoutId: result.checkoutId,
          });
          onCheckoutCreated?.();
          onUpdated();
        }
        return;
      }
      throw new Error(
        "No se generaron instrucciones Yape. Actualiza el estado antes de volver a intentar.",
      );
    } catch (cause) {
      if (current.current) {
        if (isLiveCustomerReviewRequired(cause) || isLiveDeliveryReviewRequired(cause)) {
          setStep(1);
          setReviewedSelection("");
          setCustomerReviewRequired(isLiveCustomerReviewRequired(cause));
          setDeliveryReviewRequired(isLiveDeliveryReviewRequired(cause));
          setFailedQuoteSelection(inputSelection);
          setQuote(null);
          setQuoteSelection("");
        }
        if (isLiveQuoteConflict(cause)) {
          setQuote(null);
          setQuoteSelection("");
          attempt.current = null;
          try {
            const updated = await quoteLivePurchase(storeId, visitor, selectionInput());
            if (current.current) {
              acceptQuote(updated, inputSelection);
              setError(
                "La cotización cambió o venció. Revisa el total actualizado y vuelve a confirmar.",
              );
            }
          } catch (quoteError) {
            if (current.current) setError(liveError(quoteError));
            if (current.current)
              setCustomerReviewRequired(isLiveCustomerReviewRequired(quoteError));
            if (current.current) {
              setDeliveryReviewRequired(isLiveDeliveryReviewRequired(quoteError));
              setFailedQuoteSelection(inputSelection);
              if (
                isLiveCustomerReviewRequired(quoteError) ||
                isLiveDeliveryReviewRequired(quoteError)
              ) {
                setStep(1);
                setReviewedSelection("");
              }
            }
          }
        } else {
          setError(liveError(cause));
        }
        if (current.current) onUpdated();
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
    matchingQuote?.items?.map((item, index) => ({
      key: `${item.variantId}:${index}`,
      name: item.name,
      variantLabel:
        data.products.find((product) => product.variantId === item.variantId)?.variantLabel ||
        data.reservations.find((reservation) => reservation.variantId === item.variantId)
          ?.variantLabel,
      sku: item.sku || data.products.find((product) => product.variantId === item.variantId)?.sku,
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
            variantLabel:
              reservation.variantLabel ||
              data.products.find((product) => product.variantId === reservation.variantId)
                ?.variantLabel,
            sku: data.products.find((product) => product.variantId === reservation.variantId)?.sku,
            quantity: reservation.quantity,
            price: reservation.unitPrice,
          }))
      : selection.items.map((item) => {
          const product = data.products.find((product) => product.variantId === item.variantId);
          return {
            key: item.variantId,
            name: product?.name || "Producto",
            variantLabel: product?.variantLabel,
            sku: product?.sku,
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
      <DialogContent
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden border-white/15 bg-[#16161C] p-0 text-zinc-100 sm:max-w-4xl"
        aria-busy={busy || quoting}
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-5 py-4 pr-10 sm:px-6">
          <DialogTitle className="text-lg">
            {selection.reservationIds ? "Pagar tus apartados" : "Comprar ahora"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {step === 1
              ? "Completa tus datos y elige dónde recibir tu compra."
              : "Revisa tus datos y el total antes de continuar con Yape."}
          </DialogDescription>
          <LiveCheckoutSteps step={step} />
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
            <aside
              className={cn(
                "rounded-2xl border border-white/10 bg-black/20 p-4 md:sticky md:top-0 md:order-2",
                step === 2 && "order-2",
              )}
              aria-label="Resumen de compra"
            >
              <h3 className="mb-1 text-sm font-semibold">
                Tu compra · {items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                {items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "unidad" : "unidades"}
              </h3>
              <div className="divide-y divide-white/10">
                {items.map((item) => (
                  <div key={item.key} className="flex justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0 break-words">
                      <p className="font-medium">
                        {item.quantity} × {item.name}
                      </p>
                      {item.variantLabel ? (
                        <p className="mt-1 text-xs text-zinc-300">{item.variantLabel}</p>
                      ) : null}
                      {item.sku ? (
                        <p className="mt-1 text-xs text-zinc-400">SKU: {item.sku}</p>
                      ) : null}
                    </div>
                    <b className="shrink-0 whitespace-nowrap text-xs">
                      {liveMoney(item.price * item.quantity)}
                    </b>
                  </div>
                ))}
              </div>
              {matchingQuote ? (
                <div className="space-y-2 border-t border-white/10 pt-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-400">Productos</span>
                    <span>{liveMoney(matchingQuote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-400">
                      Envío
                      {matchingQuote.combinedOrderId || matchingQuote.combinedOrderNumber
                        ? " (pedido abierto)"
                        : ""}
                    </span>
                    <span>{liveMoney(matchingQuote.shipping)}</span>
                  </div>
                  {matchingQuote.combinedOrderNumber ? (
                    <p className="text-xs text-[#9AFBF7]">
                      Se suma a tu pedido {matchingQuote.combinedOrderNumber}, sin pagar envío otra
                      vez.
                    </p>
                  ) : null}
                  <p className="text-xs text-zinc-400">
                    Total válido hasta{" "}
                    {new Date(matchingQuote.expiresAt).toLocaleTimeString("es-PE", {
                      timeZone: "America/Lima",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                </div>
              ) : (
                <p className="border-t border-white/10 pt-3 text-xs leading-relaxed text-zinc-400">
                  Al completar tus datos confirmaremos los precios y sumaremos el envío
                  automáticamente. Todavía no se inicia ningún pago.
                </p>
              )}
            </aside>
            {step === 2 ? (
              <section className="min-w-0 space-y-5" aria-labelledby={`${formId}-review-title`}>
                <h2
                  id={`${formId}-review-title`}
                  ref={reviewHeading}
                  tabIndex={-1}
                  className="text-lg font-bold outline-none"
                >
                  Revisar compra
                </h2>
                <LiveCheckoutDetails
                  customer={customer}
                  delivery={delivery}
                  receipt={receipt}
                  onModify={modify}
                  disabled={busy}
                />
                <p className="rounded-xl border border-[#25F4EE]/20 bg-[#25F4EE]/5 p-3 text-sm text-zinc-300">
                  Al continuar verás el número o QR del negocio para yapear el monto exacto.
                </p>
              </section>
            ) : (
              <form
                id={formId}
                ref={formRef}
                noValidate
                className="min-w-0 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!valid) {
                    reviewFields();
                    return;
                  }
                  void reviewPurchase();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium">
                    Nombre
                    <input
                      {...feedbackProps("name")}
                      aria-label="Nombre"
                      ref={customerNameRef}
                      className={field}
                      required
                      minLength={3}
                      maxLength={120}
                      autoComplete="name"
                      value={customer.name}
                      disabled={busy}
                      onChange={(event) =>
                        onCustomerChange({ ...customer, name: event.target.value })
                      }
                    />
                    {feedback("name")}
                  </label>
                  <label className="text-xs font-medium">
                    WhatsApp
                    <input
                      {...feedbackProps("phone")}
                      aria-label="WhatsApp"
                      aria-describedby={
                        [
                          (showErrors || touchedFields.phone) && issues.phone
                            ? `${formId}-phone-error`
                            : "",
                          customerReviewRequired && data.customer
                            ? `${formId}-linked-phone-help`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
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
                        onCustomerChange({
                          ...customer,
                          phone: event.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                    {feedback("phone")}
                    {customerReviewRequired && data.customer ? (
                      <span
                        id={`${formId}-linked-phone-help`}
                        className="mt-1 block text-xs leading-relaxed text-zinc-300"
                      >
                        Este WhatsApp está vinculado a tus apartados. Si necesitas corregirlo,
                        contacta al negocio antes de pagar.
                      </span>
                    ) : null}
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
                        <label
                          key={value}
                          className={cn(
                            delivery.type === value ? selectedSecondary : secondary,
                            busy ? "opacity-50" : "cursor-pointer",
                          )}
                        >
                          <input
                            type="radio"
                            name={`${formId}-delivery`}
                            value={value}
                            checked={delivery.type === value}
                            disabled={busy}
                            onChange={() =>
                              setDelivery((previous) => ({
                                ...previous,
                                type: value as "HOME" | "AGENCY",
                              }))
                            }
                            className="h-4 w-4 accent-[#25F4EE]"
                          />
                          {label}
                        </label>
                      ))}
                  </div>
                  {!deliveryMethods.length ? (
                    <p role="status" className="mt-3 text-sm text-amber-200">
                      El negocio aún debe habilitar una modalidad de entrega antes de aceptar
                      compras.
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="min-w-0 text-xs font-medium">
                      Departamento
                      <select
                        aria-label="Departamento"
                        {...feedbackProps("department")}
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
                      {feedback("department")}
                    </label>
                    <label className="min-w-0 text-xs font-medium">
                      Provincia
                      <select
                        aria-label="Provincia"
                        {...feedbackProps("province")}
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
                      {feedback("province")}
                    </label>
                    <label className="min-w-0 text-xs font-medium">
                      Distrito
                      <select
                        aria-label="Distrito"
                        {...feedbackProps("district")}
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
                      {feedback("district")}
                    </label>
                  </div>
                  <label className="mt-3 grid gap-1.5 text-xs font-medium">
                    {delivery.type === "HOME" ? "Dirección" : "Dirección de la agencia"}
                    <input
                      {...feedbackProps("address")}
                      aria-label={
                        delivery.type === "HOME" ? "Dirección" : "Dirección de la agencia"
                      }
                      ref={addressRef}
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
                    {feedback("address")}
                  </label>
                  {delivery.type === "AGENCY" ? (
                    <label className="mt-3 grid gap-1.5 text-xs font-medium">
                      Agencia y sucursal
                      <input
                        {...feedbackProps("agency")}
                        aria-label="Agencia y sucursal"
                        className={field}
                        required
                        maxLength={150}
                        disabled={busy}
                        value={delivery.agency ?? ""}
                        onChange={(event) =>
                          setDelivery((previous) => ({ ...previous, agency: event.target.value }))
                        }
                      />
                      {feedback("agency")}
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
                      <label
                        key={value}
                        className={cn(
                          receipt.type === value ? selectedSecondary : secondary,
                          busy ? "opacity-50" : "cursor-pointer",
                        )}
                      >
                        <input
                          type="radio"
                          name={`${formId}-receipt`}
                          value={value}
                          checked={receipt.type === value}
                          disabled={busy}
                          onChange={() =>
                            setReceipt(
                              value === "BOLETA"
                                ? { type: "BOLETA", dni: "" }
                                : { type: "FACTURA", ruc: "", businessName: "" },
                            )
                          }
                          className="h-4 w-4 accent-[#25F4EE]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {receipt.type === "BOLETA" ? (
                    <label className="mt-3 grid gap-1.5 text-xs font-medium">
                      DNI del comprador
                      <input
                        {...feedbackProps("dni")}
                        aria-label="DNI del comprador"
                        data-receipt-document="true"
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
                      {feedback("dni")}
                    </label>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <label className="block text-xs font-medium">
                        RUC
                        <input
                          {...feedbackProps("ruc")}
                          aria-label="RUC"
                          data-receipt-document="true"
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
                        {feedback("ruc")}
                      </label>
                      <label className="block text-xs font-medium">
                        Razón social
                        <input
                          {...feedbackProps("businessName")}
                          aria-label="Razón social"
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
                        {feedback("businessName")}
                      </label>
                    </div>
                  )}
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Medio de pago</legend>
                  {method ? (
                    <div className="flex items-start gap-3 rounded-xl border border-[#25F4EE]/30 bg-[#25F4EE]/5 p-3 text-sm">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#25F4EE]"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-semibold">Yape · comprobante</p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                          Verás el número o QR del negocio. Después de yapear, envía tu comprobante
                          para que validen el pedido.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">
                      Este negocio aún no ha habilitado Yape.
                    </p>
                  )}
                </fieldset>
              </form>
            )}
          </div>
        </div>
        <div className="shrink-0 space-y-3 border-t border-white/15 bg-[#0B0B0F] px-5 py-4 sm:px-6">
          {error ? (
            <div
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              className="rounded-xl border border-[#FE2C55]/40 bg-[#FE2C55]/10 p-3 text-sm text-[#FFB5C4] outline-none focus-visible:ring-2 focus-visible:ring-[#FE2C55]"
            >
              <p>{error}</p>
              {customerReviewRequired || deliveryReviewRequired ? (
                <button
                  type="button"
                  disabled={busy}
                  className="mt-2 rounded-md py-2 font-semibold text-[#25F4EE] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE]"
                  onClick={() => {
                    const target = deliveryReviewRequired
                      ? addressRef.current
                      : customerNameRef.current;
                    target?.scrollIntoView?.({ block: "center" });
                    target?.focus();
                  }}
                >
                  {deliveryReviewRequired
                    ? "Revisar dirección de entrega"
                    : "Revisar datos del comprador"}
                </button>
              ) : null}
            </div>
          ) : null}
          {quoteExpired ? (
            <p role="status" className="text-sm text-amber-200">
              El total venció. Actualízalo y revísalo antes de continuar con Yape.
            </p>
          ) : quoteChanged ? (
            <p role="status" className="text-sm text-zinc-300">
              Cambiaste los datos. El total con envío se actualizará automáticamente.
            </p>
          ) : null}
          {step === 2 && !currentQuote ? (
            <button
              type="button"
              disabled={busy || quoting}
              onClick={() => void calculate()}
              className={secondary}
            >
              Actualizar total
            </button>
          ) : null}
          {step === 1 && !valid ? (
            <div
              id={`${formId}-requirements`}
              className="flex items-center justify-between gap-3 text-xs text-zinc-300"
            >
              <p>
                {!deliveryAvailable
                  ? "Falta habilitar una modalidad de entrega."
                  : !method
                    ? "El negocio debe habilitar Yape para continuar."
                    : `Completa tus datos para ver el total con envío. ${missingFields[0]}`}
              </p>
              {missingFields.length ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={reviewFields}
                  className="shrink-0 rounded-md px-1 py-2 font-semibold text-[#25F4EE] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE]"
                >
                  Revisar datos
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-baseline justify-between gap-4 sm:block" aria-live="polite">
              <span className="text-sm text-zinc-400">
                {currentQuote
                  ? "Total con envío"
                  : quoteExpired
                    ? "Total vencido"
                    : quoting
                      ? "Confirmando total con envío…"
                      : "Total con envío por confirmar"}
              </span>
              <p className="text-xl font-bold text-[#25F4EE]">
                {matchingQuote ? liveMoney(matchingQuote.total) : "—"}
              </p>
            </div>
            <button
              type={step === 1 ? "submit" : "button"}
              form={step === 1 ? formId : undefined}
              className={cn(primary, "w-full sm:w-auto")}
              disabled={busy || quoting || (step === 2 && (!valid || !currentQuote))}
              aria-describedby={!valid ? `${formId}-requirements` : undefined}
              onClick={step === 2 ? () => void checkout() : undefined}
            >
              {busy || quoting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CreditCard className="h-4 w-4" aria-hidden="true" />
              )}
              {busy
                ? "Procesando…"
                : quoting
                  ? "Confirmando total…"
                  : step === 2
                    ? `Continuar con Yape${currentQuote ? ` · ${liveMoney(currentQuote.total)}` : ""}`
                    : failedQuoteSelection === inputSelection
                      ? "Reintentar y continuar"
                      : "Continuar"}
            </button>
          </div>
          <p className="text-center text-[11px] leading-relaxed text-zinc-400">
            El pedido se confirma cuando el negocio valida tu comprobante Yape.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
