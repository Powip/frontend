"use client";

import { Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { Input } from "@/components/ui/input";
import type { CreateSunatDocumentsFormValues } from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import {
  applyGiftMode,
  GIFT_MODES,
  type GiftMode,
  getAllowedGiftModes,
  getCompanyPaidGiftIgv,
  getCurrentGiftMode,
  getGiftLineValue,
  getGiftNormalUnitPrice,
  hasGiftCandidates,
  isGiftCandidate,
  isGiftOnlyDocument,
  toReferenceUnitValue,
} from "@/features/sunat/sunat-document/utils/gift-lines";
import { cn } from "@/lib/utils";

const OPTIONS: Record<Exclude<GiftMode, "none">, { title: string; help: string }> = {
  [GIFT_MODES.PROMOCION]: {
    title: "Regalo de promoción",
    help: "Va con la compra y no lleva IGV. La promoción es igual para todos los que compran lo mismo.",
  },
  [GIFT_MODES.APARTE]: {
    title: "Regalo aparte",
    help: "El cliente paga S/ 0 y la empresa paga el IGV del regalo.",
  },
};

function soles(value: number): string {
  return `S/ ${value.toFixed(2)}`;
}

/** Normal price per unit (with IGV) the user types for a gift. */
function NormalPriceInput({ index }: { index: number }) {
  const { control, setValue } = useFormContext<CreateSunatDocumentsFormValues>();
  const item = useWatch({ control, name: `documents.0.items.${index}` });
  const normal = getGiftNormalUnitPrice(item);
  const [text, setText] = useState(normal ? normal.toFixed(2) : "");

  useEffect(() => {
    setText((current) => (Number(current) === normal ? current : normal ? normal.toFixed(2) : ""));
  }, [normal]);

  return (
    <Input
      id={`gift-normal-price-${index}`}
      type="number"
      min={0}
      step="0.01"
      inputMode="decimal"
      placeholder="0.00"
      aria-label={`Precio normal de ${item.productName}`}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        setValue(
          `documents.0.items.${index}.referenceUnitValue`,
          toReferenceUnitValue(Number(event.target.value) || 0),
          { shouldDirty: true, shouldValidate: true },
        );
      }}
      className={cn("h-8 w-28 text-xs", !normal && "border-red-400")}
    />
  );
}

/**
 * «Hay regalos en tu pedido»: the user chooses how the gifts go to SUNAT
 * (31 promoción / 13 aparte) and confirms each gift's normal price, which is
 * declared as valor referencial (without IGV) while the charge stays S/ 0.00.
 * A gift-only document can only go as «regalo aparte» (13).
 */
export function GiftChoicePanel() {
  const { control, getValues, setValue } = useFormContext<CreateSunatDocumentsFormValues>();
  const items = useWatch({ control, name: "documents.0.items" }) ?? [];

  if (!hasGiftCandidates(items)) {
    return null;
  }

  const mode = getCurrentGiftMode(items);
  const allowed = getAllowedGiftModes(items);
  const giftOnly = isGiftOnlyDocument(items);
  const companyIgv = getCompanyPaidGiftIgv(items);

  function choose(next: GiftMode) {
    setValue("documents.0.items", applyGiftMode(getValues("documents.0.items"), next), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <section
      aria-label="Regalos del pedido"
      className="space-y-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
    >
      <p className="flex items-center gap-2 font-semibold">
        <Gift className="h-4 w-4 text-primary" aria-hidden />
        Hay regalos en tu pedido: ¿cómo los quieres mandar?
      </p>

      {giftOnly && (
        <p className="text-xs text-muted-foreground">
          El comprobante es solo de regalos (S/ 0.00): va como regalo aparte.
        </p>
      )}

      <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
        {allowed.map((option) => {
          const { title, help } = OPTIONS[option as Exclude<GiftMode, "none">];
          const selected = mode === option;

          return (
            // biome-ignore lint/a11y/useSemanticElements: styled card acting as a radio
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(option)}
              className={cn(
                "rounded-md border bg-background px-3 py-2 text-left transition-colors",
                selected ? "border-primary ring-1 ring-primary" : "hover:border-primary/50",
              )}
            >
              <span className="block font-semibold">{title}</span>
              <span className="block text-xs text-muted-foreground">{help}</span>
            </button>
          );
        })}
      </div>

      {mode === GIFT_MODES.NONE ? (
        <p className="text-xs text-muted-foreground">
          Elige una opción. Sin elegir, el regalo queda en S/ 0.00 y no se puede emitir.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) =>
            isGiftCandidate(item) ? (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: lines have no id; order is stable here
                key={index}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
              >
                <span className="text-xs">
                  <span className="font-medium">{item.productName}</span> × {item.quantity}
                </span>

                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <label htmlFor={`gift-normal-price-${index}`}>Precio normal c/u (con IGV)</label>
                  <NormalPriceInput index={index} />
                </span>

                {getGiftLineValue(item) > 0 ? (
                  <span className="w-full text-xs text-muted-foreground">
                    Valor referencial {soles(getGiftLineValue(item))} sin IGV · se cobra S/ 0.00
                  </span>
                ) : (
                  <span className="w-full text-xs font-medium text-red-600">
                    Escribe el precio normal: SUNAT no acepta un regalo con valor 0.
                  </span>
                )}
              </div>
            ) : null,
          )}

          {mode === GIFT_MODES.APARTE && (
            <p className="text-xs font-medium">
              IGV que paga la empresa: {soles(companyIgv)}. No se le cobra al cliente.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
