"use client";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { liveMoney } from "./liveService";

/** Clases del mockup que comparten los pasos de pago. */
export const payCta =
  "min-h-[52px] w-full rounded-2xl bg-[var(--acc)] px-4 py-3.5 text-base font-bold text-[var(--acc-ink)] disabled:bg-[var(--b-dis)] disabled:text-[var(--b-dis-ink)]";
export const payGhost =
  "min-h-11 w-full rounded-2xl border-[1.5px] border-[var(--b-line)] bg-transparent px-4 py-3 text-sm font-semibold text-[var(--b-ink)]";
export const payLink = "mx-auto block min-h-11 px-2 py-2 text-sm font-semibold text-[var(--acc-tx)]";
export const payLabel = "mb-1.5 mt-3.5 block text-[13px] font-semibold text-[var(--b-ink2)]";
export const payTiny = "text-xs text-[var(--b-mut)]";
export const payNote = "rounded-xl bg-[var(--b-pur-bg)] p-3 text-[13px] leading-relaxed text-[var(--b-pur)]";

const STEPS = ["Entrega", "Paga", "Confirma"] as const;

/**
 * FEAT-33 L4 (mockup): pantalla de pago a lo alto del celular. Arriba «←» y el título; debajo los
 * 3 pasos; abajo el total y el botón. `center` es la pantalla final (sin pasos ni «←»).
 */
export default function LivePayFrame({
  title,
  description,
  step,
  backLabel = "Atrás",
  onBack,
  onClose,
  busy = false,
  icon,
  footer,
  children,
}: {
  title: string;
  description: string;
  step?: 1 | 2 | 3;
  backLabel?: "Atrás" | "Cerrar";
  onBack?: () => void;
  onClose: () => void;
  busy?: boolean;
  icon?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-0 left-1/2 flex h-dvh max-h-dvh w-full max-w-[430px] -translate-x-1/2 translate-y-0 flex-col gap-0 rounded-none border-x border-y-0 border-[var(--b-line)] bg-[var(--b-bg)] p-0 text-[var(--b-ink)] sm:max-w-[430px]"
      >
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {onBack ? (
          <header className="flex items-center gap-2.5 border-b border-[var(--b-line)] px-4 py-3.5">
            <button
              type="button"
              aria-label={backLabel}
              disabled={busy}
              onClick={onBack}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--b-line)] bg-[var(--b-card)] text-lg disabled:opacity-40"
            >
              <span aria-hidden="true">←</span>
            </button>
            <DialogTitle className="text-[17px] font-bold">{title}</DialogTitle>
          </header>
        ) : null}
        {step ? (
          <ol aria-label="Pasos de la compra" className="flex gap-1.5 px-4 pt-3">
            {STEPS.map((name, index) => {
              const n = index + 1;
              return (
                <li
                  key={name}
                  aria-current={n === step ? "step" : undefined}
                  className={`flex-1 rounded-full px-2 py-1.5 text-center text-xs font-semibold ${
                    n === step
                      ? "bg-[var(--acc)] text-[var(--acc-ink)]"
                      : n < step
                        ? "bg-[var(--acc-soft)] text-[var(--acc-tx)]"
                        : "bg-[var(--b-in)] text-[var(--b-mut)]"
                  }`}
                >
                  {n < step ? "✓ " : `${n}. `}
                  {name}
                </li>
              );
            })}
          </ol>
        ) : null}
        <div
          className={`flex-1 overflow-y-auto px-4 py-4 ${onBack ? "" : "flex flex-col items-center text-center"}`}
        >
          {onBack ? null : (
            <>
              {icon}
              <DialogTitle className="mt-1 text-2xl font-bold">{title}</DialogTitle>
            </>
          )}
          {children}
        </div>
        {footer ? (
          <footer className="space-y-3 border-t border-[var(--b-line)] bg-[var(--b-bg)] px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))]">
            {footer}
          </footer>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Pie con el total: «3 prendas · productos S/ …», la línea del envío y el total grande. */
export function LivePayTotal({
  units,
  products,
  shipping,
  total,
  discount,
  gift,
}: {
  units?: number | null;
  products: number;
  shipping: string;
  total: string;
  /** FEAT-33 L7b: lo que bajó el volumen del live (ya restado en `products`; se muestra aparte). */
  discount?: number;
  /** FEAT-33 L7b: nombre del regalo que va gratis. */
  gift?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 text-xs leading-relaxed text-[var(--b-mut)]">
        <small className="block text-xs">
          {units ? `${units} prenda${units === 1 ? "" : "s"} · productos` : "Productos"}{" "}
          {/* FEAT-33 L7b: con promo se muestra a precio live y abajo «Promo −S/ X», así suma como un recibo. */}
          {liveMoney(discount && discount > 0 ? Math.round((products + discount) * 100) / 100 : products)}
        </small>
        {discount && discount > 0 ? (
          <small className="block text-xs font-semibold text-[var(--acc-tx)]">{`Promo −${liveMoney(discount)}`}</small>
        ) : null}
        {gift ? <small className="block text-xs font-semibold text-[var(--acc-tx)]">{`🎁 Regalo: ${gift}`}</small> : null}
        <small className="block text-xs">{shipping}</small>
      </div>
      <b className="shrink-0 text-2xl">{total}</b>
    </div>
  );
}

export const COURIER_NAMES: Record<string, string> = {
  SHALOM: "Shalom",
  OLVA: "Olva Courier",
  MOTORIZADO: "Motorizado",
};
