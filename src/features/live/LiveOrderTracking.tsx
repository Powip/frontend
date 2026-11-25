"use client";
import { createLivePolling } from "./livePolling";
import { isLiveReadDenied } from "./liveService";
import { useEffect, useState } from "react";
import axios from "axios";
import { GATEWAY } from "@/lib/gateway";
import { liveBuyerLabel, liveError, liveMoney } from "./liveService";
import LiveManualPaymentDialog from "./LiveManualPaymentDialog";
import { LiveLogo, useLiveBodyLook } from "./LiveBrand";
import { liveAppearance, liveAppearanceStyle } from "./liveAppearance";
import { payCta, payGhost } from "./LivePayFrame";
import type { LiveAppearanceConfig } from "./types";

// FEAT-33 L4c: la página del pedido (y su cuadro de pago Yape) se ve con la apariencia del catálogo
// de la tienda; un servidor viejo no la manda y se usa la de por defecto.
interface Tracking {
  storeId: string;
  orderNumber: string;
  status: string;
  buyerStatus: string;
  /** FEAT-33 A12: por dónde entró la compra (un servidor viejo no lo manda). */
  origin?: "POWIP_LIVE" | "POWIP_LINK";
  businessName: string;
  businessPhone?: string | null;
  appearance?: LiveAppearanceConfig | null;
  customer: { fullName: string };
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    attributes?: Record<string, unknown> | null;
    /** FEAT-33 L7b: regalo de una promo del live. */
    isGift?: boolean;
  }[];
  totals: { grandTotal: number; totalPaid: number; pendingAmount: number };
  paymentReviewAmount: number;
  timeline: {
    step: string;
    label: string;
    completed: boolean;
    current: boolean;
  }[];
  payments: {
    checkoutId: string;
    amount: number;
    status: string;
    reason: string | null;
    operationNumber: string | null;
  }[];
  delivery?: {
    address?: string;
    agency?: string;
    reference?: string;
    district?: string;
    province?: string;
    department?: string;
  };
}
export default function LiveOrderTracking({ token }: { token: string }) {
  const [data, setData] = useState<Tracking | null>(null),
    [error, setError] = useState(""),
    [checkout, setCheckout] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    setData(null);
    setError("");
    setCheckout(null);
    const reader = createLivePolling<Tracking>({
      load: async (signal) =>
        (
          await axios.get<Tracking>(`${GATEWAY.ventas}/live/orders/${encodeURIComponent(token)}`, {
            withCredentials: false,
            timeout: 20000,
            signal,
          })
        ).data,
      intervalMs: 5000,
      onData: (result) => {
        setData(result);
        setError("");
      },
      onError: (e) => {
        if (isLiveReadDenied(e)) setData(null);
        setError(liveError(e));
      },
    });
    void reader.refresh({ quiet: false });
    return () => reader.dispose();
  }, [token, revision]);
  const look = liveAppearance(data?.appearance || undefined, data?.businessName || "POWIP");
  const lookStyle = liveAppearanceStyle(look);
  useLiveBodyLook(lookStyle);
  const state =
    data?.status === "ANULADO" || data?.buyerStatus === "CANCELLED" ? "CANCELLED" : data?.buyerStatus;
  const review = data?.payments.find((p) => p.status === "UNDER_REVIEW");
  const rejected = data?.payments.find((p) => p.status === "REJECTED");
  const itemsTotal = data?.items.reduce((n, item) => n + item.subtotal, 0) || 0;
  const shipping = data ? Math.round((data.totals.grandTotal - itemsTotal) * 100) / 100 : 0;
  const whatsapp = /^9\d{8}$/.test(data?.businessPhone || "") ? `https://wa.me/51${data!.businessPhone}` : null;
  const pill =
    state === "APPROVED"
      ? "bg-[var(--b-ok-bg)] text-[var(--b-ok)]"
      : state === "REJECTED"
        ? "bg-[var(--b-bad-bg)] text-[var(--b-bad)]"
        : state === "CANCELLED"
          ? "bg-[var(--b-in)] text-[var(--b-mut)]"
          : "bg-[var(--b-warn-bg)] text-[var(--b-warn)]";
  return (
    <main
      data-testid="live-order"
      data-theme={look.theme}
      style={lookStyle}
      className="min-h-dvh bg-[var(--b-out)] px-4 pt-6 pb-16 text-[var(--b-ink)]"
    >
      <div className="mx-auto max-w-[440px] overflow-hidden rounded-[22px] border border-[var(--b-line)] bg-[var(--b-bg)] shadow-xl">
        <header className="bg-[var(--acc)] px-5 py-[18px] text-[var(--acc-ink)]">
          <p data-testid="pedido-origen" className="mb-2.5 text-[11.5px] font-semibold opacity-80">
            {data?.origin === "POWIP_LIVE" ? "POWIP Live" : data?.origin === "POWIP_LINK" ? "POWIP Link" : "POWIP"}
          </p>
          <div className="flex items-center gap-2.5">
            <LiveLogo look={look} className="h-10 w-10 rounded-[11px] text-sm ring-1 ring-black/10" />
            <div className="min-w-0 flex-1">
              <b className="block truncate">{look.displayName}</b>
              {data ? (
                <span className="whitespace-nowrap text-[12.5px] opacity-85">
                  Pedido <b>{data.orderNumber}</b>
                </span>
              ) : null}
            </div>
            {data ? (
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${pill}`}>
                {state === "CANCELLED" ? "Pedido anulado" : liveBuyerLabel(data.buyerStatus)}
              </span>
            ) : null}
          </div>
        </header>
        <div className="space-y-3.5 p-5">
          {error ? (
            <p role="alert" className="rounded-xl bg-[var(--b-bad-bg)] p-3 text-sm text-[var(--b-err)]">
              {error}
            </p>
          ) : null}
          {!data ? (
            <p>Cargando pedido…</p>
          ) : (
            <>
              <section aria-labelledby="pedido-estado">
                {state === "UNDER_REVIEW" ? (
                  <>
                    <h1 id="pedido-estado" className="mb-1.5 text-[21px] font-bold">
                      Recibimos tu comprobante
                    </h1>
                    <p className="text-sm text-[var(--b-mut)]">
                      {look.displayName} está validando tu Yape
                      {review?.operationNumber ? ` (op. ${review.operationNumber})` : ""}. Te avisamos
                      por WhatsApp apenas se confirme. Tus productos siguen separados.
                    </p>
                  </>
                ) : state === "APPROVED" ? (
                  <>
                    <h1 id="pedido-estado" className="mb-1.5 text-[21px] font-bold">
                      ¡Pago confirmado! 🎉
                    </h1>
                    <p className="text-sm text-[var(--b-mut)]">
                      Tu pedido entra a preparación. Te enviaremos el seguimiento por WhatsApp.
                    </p>
                  </>
                ) : state === "REJECTED" ? (
                  <>
                    <h1 id="pedido-estado" className="mb-1.5 text-[21px] font-bold">
                      No pudimos validar tu pago
                    </h1>
                    <p className="text-sm text-[var(--b-mut)]">
                      Motivo: {rejected?.reason || "no encontramos el ingreso"}. Tus productos siguen
                      separados mientras lo revisas.
                    </p>
                    {rejected ? (
                      <button className={`${payCta} mt-3`} onClick={() => setCheckout(rejected.checkoutId)}>
                        Enviar otro comprobante
                      </button>
                    ) : null}
                  </>
                ) : state === "CANCELLED" ? (
                  <>
                    <h1 id="pedido-estado" className="mb-1.5 text-[21px] font-bold">
                      Este pedido ya no está disponible
                    </h1>
                    <p className="text-sm text-[var(--b-mut)]">Escríbenos si tienes dudas.</p>
                  </>
                ) : (
                  <>
                    <h1 id="pedido-estado" className="mb-1.5 text-[21px] font-bold">
                      {liveBuyerLabel(data.buyerStatus)}
                    </h1>
                    <p className="text-sm text-[var(--b-mut)]">
                      Te avisamos por WhatsApp cuando cambie el estado de tu pedido.
                    </p>
                  </>
                )}
              </section>
              <ol
                aria-label="Seguimiento del pedido"
                className="space-y-3 rounded-[14px] border border-[var(--b-line)] p-3.5"
              >
                {data.timeline.map((t) => {
                  const hint = stepHint(t.step, data, state);
                  return (
                    <li
                      key={t.step}
                      aria-current={t.current ? "step" : undefined}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <i
                        aria-hidden="true"
                        className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-xs not-italic ${
                          t.completed
                            ? "bg-[var(--acc)] text-[var(--acc-ink)]"
                            : t.current
                              ? "bg-[var(--b-warn-bg)] text-[var(--b-warn)] ring-1 ring-[var(--b-warn)]"
                              : "border border-[var(--b-line2)] bg-[var(--b-in)] text-[var(--b-mut)]"
                        }`}
                      >
                        {t.completed ? "✓" : t.current ? "•" : ""}
                      </i>
                      <span className="min-w-0">
                        <b className={`block ${t.completed || t.current ? "" : "text-[var(--b-mut)]"}`}>
                          {STEP_LABELS[t.step] || t.label}
                        </b>
                        {hint ? <small className="block text-xs text-[var(--b-mut)]">{hint}</small> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <section
                aria-labelledby="pedido-items"
                className="rounded-[14px] border border-[var(--b-line)] p-3.5 text-[13.5px]"
              >
                <h2 id="pedido-items" className="mb-2 text-sm font-bold">
                  Tu pedido
                </h2>
                {data.items.map((item, i) => (
                  <div key={i} className="flex justify-between gap-2.5 py-1.5">
                    <span>
                      <span className="block">
                        {item.quantity} × {item.productName}
                      </span>
                      {item.isGift ? (
                        <small className="block text-xs font-semibold text-[var(--acc-tx)]">🎁 Regalo</small>
                      ) : null}
                      {variantText(item.attributes) ? (
                        <small className="block text-xs text-[var(--b-mut)]">{variantText(item.attributes)}</small>
                      ) : null}
                    </span>
                    <span className="tabular-nums">{liveMoney(item.subtotal)}</span>
                  </div>
                ))}
                {shipping > 0.004 ? (
                  <div className="flex justify-between gap-2.5 py-1.5">
                    <span>Envío</span>
                    <span className="tabular-nums">{liveMoney(shipping)}</span>
                  </div>
                ) : null}
                <div className="mt-1.5 flex justify-between gap-2.5 border-t border-[var(--b-line)] pt-2 text-base font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">{liveMoney(data.totals.grandTotal)}</span>
                </div>
                {data.totals.totalPaid > 0 ? (
                  <div className="flex justify-between gap-2.5 pt-1 text-[var(--b-mut)]">
                    <span>Pagado</span>
                    <span className="tabular-nums">{liveMoney(data.totals.totalPaid)}</span>
                  </div>
                ) : null}
                {data.paymentReviewAmount > 0 ? (
                  <div className="flex justify-between gap-2.5 pt-1 text-[var(--b-mut)]">
                    <span>Por validar</span>
                    <span className="tabular-nums">{liveMoney(data.paymentReviewAmount)}</span>
                  </div>
                ) : null}
              </section>
              <section
                aria-labelledby="pedido-entrega"
                className="rounded-[14px] border border-[var(--b-line)] p-3.5"
              >
                <h2 id="pedido-entrega" className="mb-2 text-sm font-bold">
                  Entrega
                </h2>
                <p className="text-[13.5px] text-[var(--b-ink2)]">
                  {[data.customer.fullName, data.delivery?.agency || data.delivery?.address]
                    .filter(Boolean)
                    .join(" · ")}
                  {data.delivery?.district ? `, ${data.delivery.district}` : ""}
                  {data.delivery?.province
                    ? ` · ${data.delivery.province}${data.delivery.department ? `, ${data.delivery.department}` : ""}`
                    : ""}
                </p>
                {data.delivery?.reference ? (
                  <p className="mt-1 text-xs text-[var(--b-mut)]">Ref.: {data.delivery.reference}</p>
                ) : null}
              </section>
              {data.payments.length > 1 ? (
                <section aria-labelledby="pedido-pagos" className="space-y-2">
                  <h2 id="pedido-pagos" className="text-sm font-bold">
                    Tus pagos
                  </h2>
                  {data.payments.map((p) => (
                    <article
                      key={p.checkoutId}
                      className="rounded-[14px] border border-[var(--b-line)] p-3 text-sm"
                    >
                      <p className="font-semibold">
                        {liveMoney(p.amount)} ·{" "}
                        {data.status === "ANULADO" ? "Anulado" : liveBuyerLabel(p.status)}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--b-mut)]">
                        Operación {p.operationNumber || "pendiente"}
                      </p>
                      {p.reason ? <p className="mt-1 text-xs text-[var(--b-err)]">{p.reason}</p> : null}
                      {p.status === "REJECTED" && data.status !== "ANULADO" && p !== rejected ? (
                        <button
                          className={`${payGhost} mt-2`}
                          onClick={() => setCheckout(p.checkoutId)}
                        >
                          Enviar otro comprobante
                        </button>
                      ) : null}
                    </article>
                  ))}
                </section>
              ) : null}
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${payGhost} block text-center`}
                >
                  💬 Escribir a la tienda
                </a>
              ) : null}
              {checkout ? (
                <LiveManualPaymentDialog
                  storeId={data.storeId}
                  visitor={token}
                  checkoutId={checkout}
                  storeName={look.displayName}
                  continueLabel="Volver a mi pedido"
                  showTrackingLink={false}
                  onClose={() => setCheckout(null)}
                  onUpdated={() => setRevision((n) => n + 1)}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
      <p className="mt-3.5 text-center text-xs text-[var(--b-mut)]">⚡ POWIP</p>
    </main>
  );
}

const STEP_LABELS: Record<string, string> = {
  RECEIVED: "Pedido recibido",
  PAYMENT: "Pago con Yape",
  PREPARADO: "En preparación",
  EN_ENVIO: "En camino",
  DESPACHADO: "Despachado",
  ENTREGADO: "Entregado",
  ANULADO: "Pedido anulado",
};
function stepHint(step: string, data: Tracking, state?: string) {
  if (step === "RECEIVED")
    return data.origin === "POWIP_LINK" ? "Desde el catálogo por WhatsApp" : "Desde el catálogo del live";
  if (step === "PAYMENT")
    return state === "APPROVED"
      ? "Confirmado"
      : state === "REJECTED"
        ? "Rechazado · reenvía tu comprobante"
        : state === "UNDER_REVIEW"
          ? "En validación"
          : state === "CANCELLED"
            ? ""
            : "Pendiente";
  if (step === "EN_ENVIO") return data.delivery?.agency ? "A la agencia elegida" : "A tu dirección";
  return "";
}
/** Talla y color del producto («M · Negro»). */
function variantText(attributes?: Record<string, unknown> | null) {
  return attributes && typeof attributes === "object"
    ? Object.values(attributes)
        .filter((v) => typeof v === "string" || typeof v === "number")
        .join(" · ")
    : "";
}
