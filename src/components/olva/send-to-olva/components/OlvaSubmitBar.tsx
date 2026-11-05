"use client";

import { Loader2, Truck } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import type { OlvaHeadquarter } from "@/features/olva/olva-catalog/models/olva-headquarter";
import { formatOlvaAmount } from "@/features/olva/olva-quote/utils/format-olva-amount";
import { OLVA_CURRENCIES } from "@/features/olva/shared/constants/olva-enums.constants";
import { useOlvaQuoteTotal } from "../hooks/use-olva-quote-total";
import { hasOlvaPayerForEveryRow } from "../utils/derive-olva-lot-payer";
import type { SendToOlvaFormItem } from "../utils/order-to-olva-form-item";
import type { SendToOlvaFormValues } from "./fields/olva-form-types";

interface OlvaSubmitBarProps {
  headquarter: OlvaHeadquarter | undefined;
  isSubmitting: boolean;
  onCancel: () => void;
}

/** Footer of the form: how many shipments, the estimated total and the send button. */
export function OlvaSubmitBar({ headquarter, isSubmitting, onCancel }: OlvaSubmitBarProps) {
  const { control } = useFormContext<SendToOlvaFormValues>();
  const items = (useWatch({ control, name: "items" }) ?? []) as SendToOlvaFormItem[];
  const quote = useOlvaQuoteTotal(items, headquarter);
  const hasPayer = hasOlvaPayerForEveryRow(items);
  const count = items.length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div className="text-sm">
        {quote.quoted > 0 ? (
          <span aria-live="polite">
            Total estimado:{" "}
            <span className="font-semibold">
              {formatOlvaAmount(quote.total, OLVA_CURRENCIES.PEN)}
            </span>
            {quote.quoted < count ? (
              <span className="text-muted-foreground">
                {" "}
                ({quote.quoted} de {count} cotizados)
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">El total aparece al cotizar los envíos.</span>
        )}
        {hasPayer ? null : (
          <p className="text-amber-600 text-xs">Elige quién paga el envío para continuar.</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || count === 0 || !hasPayer}>
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Truck className="mr-2 size-4" />
          )}
          {isSubmitting
            ? "Registrando…"
            : `Registrar ${count} ${count === 1 ? "envío" : "envíos"} en Olva`}
        </Button>
      </div>
    </div>
  );
}
