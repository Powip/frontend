"use client";

import { AlertCircle, Package, RefreshCw } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";
import type { LiveProduct } from "./types";

export function LiveProductImage({
  product,
  className = "",
}: {
  product: LiveProduct;
  className?: string;
}) {
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 ${className}`}
    >
      {product.imageUrl ? (
        <Image
          width={128}
          height={128}
          unoptimized
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <Package className="h-6 w-6" aria-hidden="true" />
      )}
    </div>
  );
}
export function LiveCountdown({
  expiresAt,
  serverNow,
}: {
  expiresAt: string | null;
  serverNow: string;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }
    const ends = Date.parse(expiresAt) - Date.parse(serverNow);
    const started = Date.now();
    const tick = () => setRemaining(Math.max(0, ends - (Date.now() - started)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, serverNow]);
  if (!expiresAt)
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
        Sin vencimiento
      </span>
    );
  const seconds = Math.floor(
    (remaining ?? Math.max(0, Date.parse(expiresAt) - Date.parse(serverNow))) / 1000,
  );
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${seconds <= 120 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}
    >
      {seconds <= 0
        ? "Vencido"
        : `${Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`}
    </span>
  );
}
export function LivePanel({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border bg-card p-5 shadow-sm ${className}`}>
      {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
  );
}
export function LiveEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
export function LiveErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-red-100"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function LiveReservationTimer({
  reservation,
  serverNow,
}: {
  reservation: { expiresAt: string | null; reviewHold?: boolean };
  serverNow: string;
}) {
  return reservation.reviewHold ? (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
      Comprobante en revisión
    </span>
  ) : (
    <LiveCountdown expiresAt={reservation.expiresAt} serverNow={serverNow} />
  );
}
