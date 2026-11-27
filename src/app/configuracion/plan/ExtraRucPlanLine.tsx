"use client";

import Link from "next/link";
import { useExtraRucSummary } from "@/features/sunat/extra-ruc/hooks/use-extra-ruc-summary";
import { DEFAULT_EXTRA_RUC_PRICE, formatSoles } from "@/features/sunat/extra-ruc/utils/ruc-slots";

/**
 * Cómo se cobra el RUC extra dentro de la tarjeta del add-on Facturación SUNAT: 1 RUC incluido y S/ 30/mes por cada
 * RUC adicional, siempre mensual (también con plan anual). Los RUC se agregan y se dan de baja desde
 * Facturación → Emisores (RUC).
 */
export function ExtraRucPlanLine() {
  const { data: summary } = useExtraRucSummary();
  const price = formatSoles(summary?.pricePerRuc ?? DEFAULT_EXTRA_RUC_PRICE);

  return (
    <span className="mt-2 block rounded-md bg-muted/50 p-2 text-xs text-foreground">
      Incluye <b>1 RUC emisor</b>. Cada RUC adicional cuesta <b>S/ {price}/mes</b> (siempre mensual,
      también con plan anual) y se paga por adelantado al agregarlo.
      {summary && summary.extraRucsPaid > 0 && (
        <>
          {" "}
          Hoy tienes <b>{summary.extraRucsPaid}</b> RUC extra
          {summary.renewingRucs > 0 && (
            <>
              : pagas <b>S/ {formatSoles(summary.monthlyExtraTotal)}/mes</b>
            </>
          )}
          .
        </>
      )}{" "}
      <Link
        href="/facturacion"
        className="font-medium text-primary underline-offset-2 hover:underline"
      >
        Administrar RUC
      </Link>
    </span>
  );
}
