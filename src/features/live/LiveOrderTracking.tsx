"use client";
import { createLivePolling } from "./livePolling";
import { isLiveReadDenied } from "./liveService";
import { useEffect, useState } from "react";
import axios from "axios";
import { GATEWAY } from "@/lib/gateway";
import { liveBuyerLabel, liveError, liveMoney } from "./liveService";
import LiveManualPaymentDialog from "./LiveManualPaymentDialog";
interface Tracking {
  storeId: string;
  orderNumber: string;
  status: string;
  buyerStatus: string;
  businessName: string;
  customer: { fullName: string };
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
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
  return (
    <main className="min-h-dvh bg-[#100e1d] p-4 text-slate-100">
      <div className="mx-auto max-w-lg space-y-5 py-5">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">POWIP Link</p>
        {error ? <p role="alert">{error}</p> : null}
        {!data ? (
          <p>Cargando pedido…</p>
        ) : (
          <>
            <header>
              <p className="text-sm text-slate-300">{data.businessName}</p>
              <h1 className="mt-2 text-2xl font-bold">{data.orderNumber}</h1>
              <p className="mt-3 rounded-xl bg-emerald-400/10 p-4 font-bold text-emerald-200">
                {liveBuyerLabel(data.buyerStatus)}
              </p>
            </header>
            <ol className="flex flex-wrap gap-3 text-xs">
              {data.timeline.map((t) => (
                <li
                  key={t.step}
                  className={`rounded-full border px-3 py-2 ${t.completed || t.current ? "border-emerald-300 text-emerald-200" : "border-white/15 text-slate-400"}`}
                >
                  {t.completed ? "✓ " : ""}
                  {t.label}
                </li>
              ))}
            </ol>
            <section className="rounded-2xl border border-white/15 p-4">
              <h2 className="font-bold">Tu pedido</h2>
              {data.items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between gap-3 border-b border-white/10 py-3 text-sm"
                >
                  <span>
                    {item.quantity} × {item.productName}
                  </span>
                  <span>{liveMoney(item.subtotal)}</span>
                </div>
              ))}
              <p className="mt-3 flex justify-between font-bold">
                <span>Total</span>
                <span>{liveMoney(data.totals.grandTotal)}</span>
              </p>
              <p className="mt-2 flex justify-between text-sm">
                <span>Pagado</span>
                <span>{liveMoney(data.totals.totalPaid)}</span>
              </p>
              <p className="mt-2 flex justify-between text-sm">
                <span>Por validar</span>
                <span>{liveMoney(data.paymentReviewAmount)}</span>
              </p>
            </section>
            <section className="rounded-2xl border border-white/15 p-4">
              <h2 className="font-bold">Entrega</h2>
              <p className="mt-2 text-sm">{data.delivery?.agency || data.delivery?.address}</p>
              <p className="mt-1 text-sm text-slate-300">
                {data.delivery?.district}, {data.delivery?.province}, {data.delivery?.department}
              </p>
              {data.delivery?.reference ? (
                <p className="mt-1 text-sm">{data.delivery.reference}</p>
              ) : null}
            </section>
            <section className="space-y-3">
              <h2 className="font-bold">Tus pagos</h2>
              {data.payments.map((p) => (
                <article key={p.checkoutId} className="rounded-xl border border-white/15 p-4">
                  <p className="font-semibold">
                    {liveMoney(p.amount)} ·{" "}
                    {data.status === "ANULADO" ? "Anulado" : liveBuyerLabel(p.status)}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Operación {p.operationNumber || "pendiente"}
                  </p>
                  {p.reason ? <p className="mt-2 text-sm text-rose-200">{p.reason}</p> : null}
                  {p.status === "REJECTED" && data.status !== "ANULADO" ? (
                    <button
                      className="mt-3 min-h-11 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-slate-950"
                      onClick={() => setCheckout(p.checkoutId)}
                    >
                      Enviar otro comprobante
                    </button>
                  ) : null}
                </article>
              ))}
            </section>
            {checkout ? (
              <LiveManualPaymentDialog
                storeId={data.storeId}
                visitor={token}
                checkoutId={checkout}
                onClose={() => setCheckout(null)}
                onUpdated={() => setRevision((n) => n + 1)}
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
