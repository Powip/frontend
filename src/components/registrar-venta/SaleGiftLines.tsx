"use client";

import { Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SaleEngineGift } from "@/services/promotionsService";

const REASONS: Record<Exclude<SaleEngineGift["status"], "GIVEN">, string> = {
  NOT_SUMMED: "no se suma",
  NO_STOCK: "sin stock en este almacén",
};

/**
 * FEAT-32 M6a (spec §6.17, §7.17) — el regalo del motor como línea virtual «Regalo · S/ 0» en el Detalle de la
 * venta (no se edita: el backend la suma al guardar con el SKU regalado). Debajo, en gris, los regalos cumplidos
 * que no entran y por qué.
 */
export default function SaleGiftLines({ gifts, skipped }: { gifts: SaleEngineGift[]; skipped: SaleEngineGift[] }) {
  if (!gifts.length && !skipped.length) return null;
  return (
    <section aria-label="Regalo de la promoción" className="space-y-2">
      {gifts.map((gift) => (
        <div
          key={`${gift.promoId}-${gift.variantId}`}
          className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-500/10"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
              <Gift className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {gift.quantity > 1 ? `${gift.quantity} × ` : ""}
                  {gift.giftName}
                </span>
                <Badge className="bg-amber-500 text-white hover:bg-amber-500">Regalo · S/ 0</Badge>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                <span className="font-mono">{gift.sku || "Sin SKU"}</span> · {gift.name} · se reserva y se descuenta del almacén
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-400">S/ 0.00</span>
          </div>
        </div>
      ))}
      {skipped.map((gift) => (
        <p key={`${gift.promoId}-${gift.variantId}-${gift.status}`} className="text-xs text-muted-foreground">
          {gift.name} ({gift.giftName}): {gift.status === "GIVEN" ? "" : REASONS[gift.status]}
        </p>
      ))}
    </section>
  );
}
