"use client";

import { useFormContext, useWatch } from "react-hook-form";
import type { OlvaHeadquarter } from "@/features/olva/olva-catalog/models/olva-headquarter";
import { formatOlvaAmount } from "@/features/olva/olva-quote/utils/format-olva-amount";
import { useOlvaItemQuote } from "../hooks/use-olva-item-quote";
import type { SendToOlvaFormValues } from "./fields/olva-form-types";

interface OlvaQuoteSummaryProps {
  index: number;
  headquarter: OlvaHeadquarter | undefined;
}

/** The price of this order, live, as soon as origin, destination (agency or district) and weight are known. */
export function OlvaQuoteSummary({ index, headquarter }: OlvaQuoteSummaryProps) {
  const { control } = useFormContext<SendToOlvaFormValues>();
  const agencyCode = useWatch({ control, name: `items.${index}.destination.agencyCode` });
  const ubigeoCode = useWatch({ control, name: `items.${index}.destination.ubigeoCode` });
  const deliveryType = useWatch({ control, name: `items.${index}.deliveryType` });
  const weightKg = useWatch({ control, name: `items.${index}.package.weightKg` });
  const sizeId = useWatch({ control, name: `items.${index}.package.sizeId` });
  const { quote, sizes, weightError } = useOlvaItemQuote({
    headquarter,
    agencyCode,
    ubigeoCode,
    deliveryType,
    weightKg,
    sizeId,
  });

  if (weightError) {
    return (
      <p className="text-muted-foreground text-sm">
        Corrige el peso o el tamaño para calcular el costo.
      </p>
    );
  }

  if (sizes.isError) {
    return (
      <p className="text-muted-foreground text-sm">
        No se pudieron cargar los tamaños de Olva: el costo lo define Olva al registrar.
      </p>
    );
  }

  if (quote.isError) {
    return <p className="text-destructive text-sm">No se pudo calcular el costo.</p>;
  }

  if (!quote.data) {
    return (
      <p className="text-muted-foreground text-sm">
        {quote.isFetching ? "Calculando costo…" : "El costo aparece al elegir sede y destino."}
      </p>
    );
  }

  return (
    <p className="text-sm" aria-live="polite">
      Costo estimado:{" "}
      <span className="font-semibold">
        {formatOlvaAmount(quote.data.amount, quote.data.currency)}
      </span>
      {quote.data.excessWeightKg > 0 ? (
        <span className="text-muted-foreground">
          {" "}
          (incluye {quote.data.excessWeightKg} kg de exceso)
        </span>
      ) : null}
    </p>
  );
}
