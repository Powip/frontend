"use client";

import type { CartItem } from "@/interfaces/IOrder";
import { saleDiscountBreakdown } from "@/app/registrar-venta/saleEnginePricing";

/**
 * FEAT-32 M6a (spec §7.17) — primeras filas del resumen de la venta nueva: Subtotal (a precio de lista),
 * Descuentos por promociones y Descuento manual (solo si hay). IGV, envío y total siguen como hoy.
 */
export default function SalePromoTotals({
  lines,
  moneyPrefix,
  pending,
}: {
  lines: readonly CartItem[];
  moneyPrefix: string;
  pending?: boolean;
}) {
  const totals = saleDiscountBreakdown(lines);
  return (
    <>
      <div className="flex justify-between py-0.5 text-muted-foreground">
        <span>Subtotal</span>
        <span className="text-foreground">{moneyPrefix} {totals.listSubtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between py-0.5 text-emerald-600 dark:text-emerald-400">
        <span>Descuentos por promociones</span>
        <span>- {moneyPrefix} {totals.promoDiscount.toFixed(2)}</span>
      </div>
      {totals.manualDiscount > 0 && (
        <div className="flex justify-between py-0.5 text-emerald-600 dark:text-emerald-400">
          <span>Descuento manual</span>
          <span>- {moneyPrefix} {totals.manualDiscount.toFixed(2)}</span>
        </div>
      )}
      {pending && (
        <p role="status" className="py-0.5 text-[11px] text-muted-foreground">
          Calculando promociones…
        </p>
      )}
    </>
  );
}
