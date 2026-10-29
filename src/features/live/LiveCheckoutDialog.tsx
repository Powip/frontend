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
import LiveManualPaymentDialog from "./LiveManualPaymentDialog";
import {
  checkoutLivePurchase,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    if (error) errorRef.current?.focus();
  }, [error]);
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
  function feedbackProps(name: keyof typeof issues) {
    const invalid = !!issues[name];
    return {
      "aria-invalid": (showErrors && invalid) || undefined,
      "aria-describedby": showErrors && invalid ? `${formId}-${name}-error` : undefined,
      "data-checkout-invalid": invalid ? "true" : undefined,
    };
  }
  function feedback(name: keyof typeof issues) {
    return showErrors && issues[name] ? (
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
  function acceptQuote(result: LiveQuote, selectionKey: string) {
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
  async function calculate() {
    if (lock.current || !valid) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const selectionKey = inputSelection;
    try {
      const result = await quoteLivePurchase(storeId, visitor, selectionInput());
      if (current.current) {
        acceptQuote(result, selectionKey);
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
    if (quoteDeadline <= Date.now()) {
      setExpiredQuoteId(currentQuote.quoteId);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await checkoutLivePurchase(storeId, visitor, input(currentQuote));
      if (result.manualPayment && result.checkoutId) {
        if (current.current) {
          setManualCheckout({ ...result, checkoutId: result.checkoutId });
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
    currentQuote?.items?.map((item, index) => ({
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
        aria-busy={busy}
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-5 py-4 pr-10 sm:px-6">
          <DialogTitle className="text-lg">
            {selection.reservationIds ? "Pagar tus apartados" : "Comprar ahora"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Completa tus datos, revisa el total y continúa con Yape.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
            <aside
              className="rounded-2xl border border-white/10 bg-black/20 p-4 md:sticky md:top-0 md:order-2"
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
              {currentQuote ? (
                <div className="space-y-2 border-t border-white/10 pt-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-400">Productos</span>
                    <span>{liveMoney(currentQuote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
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
                      Se suma a tu pedido {currentQuote.combinedOrderNumber}, sin pagar envío otra
                      vez.
                    </p>
                  ) : null}
                  <p className="text-xs text-zinc-400">
                    Total válido hasta{" "}
                    {new Date(currentQuote.expiresAt).toLocaleTimeString("es-PE", {
                      timeZone: "America/Lima",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                </div>
              ) : (
                <p className="border-t border-white/10 pt-3 text-xs leading-relaxed text-zinc-400">
                  Precios por confirmar. Calcula el total para incluir el envío y revisar los
                  precios actuales.
                </p>
              )}
            </aside>
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
                void (currentQuote ? checkout() : calculate());
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium">
                  Nombre
                  <input
                    {...feedbackProps("name")}
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
                    El negocio aún debe habilitar una modalidad de entrega antes de aceptar compras.
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
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#25F4EE]" aria-hidden="true" />
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
              {error}
            </div>
          ) : null}
          {quoteExpired ? (
            <p role="status" className="text-sm text-amber-200">
              El total venció. Actualízalo y revísalo antes de continuar con Yape.
            </p>
          ) : quote && !matchingQuote ? (
            <p role="status" className="text-sm text-zinc-300">
              Cambiaste los datos. Calcula el total otra vez para continuar.
            </p>
          ) : null}
          {!valid ? (
            <div
              id={`${formId}-requirements`}
              className="flex items-center justify-between gap-3 text-xs text-zinc-300"
            >
              <p>
                {!deliveryAvailable
                  ? "Falta habilitar una modalidad de entrega."
                  : !method
                    ? "El negocio debe habilitar Yape para continuar."
                    : `Completa tus datos para calcular el total. ${missingFields[0]}`}
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
                Total{!currentQuote ? " por calcular" : ""}
              </span>
              <p className="text-xl font-bold text-[#25F4EE]">
                {currentQuote ? liveMoney(currentQuote.total) : "—"}
              </p>
            </div>
            <button
              type="submit"
              form={formId}
              className={cn(primary, "w-full sm:w-auto")}
              disabled={busy || !valid}
              aria-describedby={!valid ? `${formId}-requirements` : undefined}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CreditCard className="h-4 w-4" aria-hidden="true" />
              )}
              {busy
                ? "Procesando…"
                : currentQuote
                  ? `Ver instrucciones Yape · ${liveMoney(currentQuote.total)}`
                  : quoteExpired
                    ? "Actualizar total"
                    : "Calcular total"}
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
