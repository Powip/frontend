"use client";

import { Gift } from "lucide-react";
import type { EvaluatedGift } from "@/services/promotionsService";

/** FEAT-24 H9 (H9-D5) — regalos que se suman solos al guardar la venta (vienen de `/promos/evaluate`). */
export default function PromoGiftsPanel({ gifts, failed }: { gifts: EvaluatedGift[]; failed?: boolean }) {
  if (failed) {
    return <p className="text-xs text-muted-foreground" role="status">No se pudieron revisar los regalos de las promociones. Si aplica alguno, se suma igual al guardar.</p>;
  }
  if (!gifts.length) return null;
  return (
    <section aria-label="Regalos de promociones" className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
      <p className="flex items-center gap-1.5 font-medium">
        <Gift className="h-4 w-4" aria-hidden="true" />
        Regalos que se suman al guardar
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
    </section>
  );
}
