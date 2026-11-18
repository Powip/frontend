"use client";

import { Gift } from "lucide-react";
import type { EvaluatedGift } from "@/services/promotionsService";

/**
 * FEAT-24 H9 (H9-D5) — regalos de las promociones que aplican al carrito (vienen de `/promos/evaluate`).
 * En la venta manual se suman solos al guardar; en Cotizaciones solo se informan (`title`, `note` y
 * `failedText` cambian el texto).
 */
export default function PromoGiftsPanel({
  gifts,
  failed,
  title = "Regalos que se suman al guardar",
  note,
  failedText = "No se pudieron revisar los regalos de las promociones. Si aplica alguno, se suma igual al guardar.",
}: {
  gifts: EvaluatedGift[];
  failed?: boolean;
  title?: string;
  note?: string;
  failedText?: string;
}) {
  if (failed) {
    return <p className="text-xs text-muted-foreground" role="status">{failedText}</p>;
  }
  if (!gifts.length) return null;
  return (
    <section aria-label="Regalos de promociones" className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
      <p className="flex items-center gap-1.5 font-medium">
        <Gift className="h-4 w-4" aria-hidden="true" />
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {gifts.map((gift) => (
          <li key={`${gift.promoId}-${gift.variantId}`} className="flex flex-wrap items-baseline justify-between gap-2">
            <span>
              {gift.quantity} × {gift.productName}
              {gift.sku ? <span className="ml-1 font-mono text-xs opacity-80">{gift.sku}</span> : null}
            </span>
            <span className="text-xs opacity-80">{gift.name} · S/ 0.00</span>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-1.5 text-xs opacity-80">{note}</p> : null}
    </section>
  );
}
