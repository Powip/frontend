"use client";

import { AlertCircle, Package, RefreshCw } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";
import type { LiveProduct } from "./types";

export function LiveProductImage({
  product,
  src,
  className = "",
}: {
  product: LiveProduct;
  /** FEAT-32 M7: foto del contenido del producto (la principal del canal); sin ella, la de la variante. */
  src?: string | null;
  className?: string;
}) {
  const url = src || product.imageUrl;
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 ${className}`}
    >
      {url ? (
        <Image
          width={128}
          height={128}
          unoptimized
          src={url}
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
        : seconds >= 3600
          ? `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)
              .toString()
              .padStart(2, "0")} min`
          : `${Math.floor(seconds / 60)
              .toString()
              .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`}
    </span>
  );
}
export function LivePanel({
  title,
  description,
  aside,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  /** Algo a la derecha del título, p. ej. «✓ Guardado 4:10 p. m.». */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border bg-card p-5 shadow-sm ${className}`}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {aside}
        </div>
      ) : null}
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
  );
}
/** FEAT-33 A1: estado de guardado junto al título, como el mockup. */
export function LiveSaveState({ dirty, savedAt }: { dirty: boolean; savedAt: string | null }) {
  if (dirty)
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
        ● Cambios sin guardar
      </span>
    );
  return savedAt ? (
    <span
      role="status"
      className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"
    >
      ✓ Guardado {savedAt}
    </span>
  ) : null;
}
/** FEAT-33 A1: el error va debajo de su campo. */
export function LiveFieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span id={id} className="text-xs font-medium text-red-600">
      {message}
    </span>
  ) : null;
}
/** FEAT-33 A1: barra fija abajo mientras haya cambios sin guardar. */
export function LiveSaveBar({ message, children }: { message: string; children: ReactNode }) {
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
      <span className="min-w-48 flex-1">{message}</span>
      {children}
    </div>
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
