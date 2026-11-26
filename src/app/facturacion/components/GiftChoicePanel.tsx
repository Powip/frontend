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
  isGiftOnlyDocument,
  isGiftTaxType,
  toReferenceUnitValue,
} from "@/features/sunat/sunat-document/utils/gift-lines";
import { isNuevoRus } from "@/features/sunat/sunat-profile/utils/tax-regime";
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
function NormalPriceInput({ index, taxRegime }: { index: number; taxRegime?: string }) {
  const { control, setValue } = useFormContext<CreateSunatDocumentsFormValues>();
  const item = useWatch({ control, name: `documents.0.items.${index}` });
  const normal = getGiftNormalUnitPrice(item, taxRegime);
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
          toReferenceUnitValue(Number(event.target.value) || 0, taxRegime),
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
export function GiftChoicePanel({ taxRegime }: { taxRegime?: string } = {}) {
  const { control, getValues, setValue } = useFormContext<CreateSunatDocumentsFormValues>();
  const items = useWatch({ control, name: "documents.0.items" }) ?? [];

  // Removing the purchase can leave a «regalo de promoción» with nothing to
  // go with: it goes back to unchosen.
  const notAllowed =
    isGiftOnlyDocument(items) && items.some((item) => item.taxType === GIFT_MODES.PROMOCION);

  useEffect(() => {
    if (notAllowed) {
      setValue(
        "documents.0.items",
        applyGiftMode(getValues("documents.0.items"), GIFT_MODES.NONE),
        { shouldDirty: true, shouldValidate: true },
      );
    }
  }, [notAllowed, getValues, setValue]);

  if (!hasGiftCandidates(items)) {
    return null;
  }

  const mode = getCurrentGiftMode(items);
  const allowed = getAllowedGiftModes(items, taxRegime);
  const giftOnly = isGiftOnlyDocument(items);
  const companyIgv = getCompanyPaidGiftIgv(items, taxRegime);
  // Nuevo RUS: gifts go only as «regalo de promoción» (31), with no IGV.
  const nuevoRus = isNuevoRus(taxRegime);

  function choose(next: GiftMode) {
    // Touching the selected option again removes the choice.
    const target = next === mode ? GIFT_MODES.NONE : next;

    setValue("documents.0.items", applyGiftMode(getValues("documents.0.items"), target), {
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

      {giftOnly && !nuevoRus && (
        <p className="text-xs text-muted-foreground">
          El comprobante es solo de regalos (S/ 0.00): va como regalo aparte.
        </p>
      )}

      {nuevoRus && (
        <p className="text-xs text-muted-foreground">
          {giftOnly
            ? "Este RUC está en el Nuevo RUS: un comprobante solo de regalos no se puede emitir (el regalo aparte lleva IGV)."
            : "Este RUC está en el Nuevo RUS: los regalos van como regalo de promoción, sin IGV."}
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

      {mode === GIFT_MODES.NONE && allowed.length === 0 ? null : (
        <p className="text-xs text-muted-foreground">
          {mode === GIFT_MODES.NONE
            ? "Elige una opción. Sin elegir, el regalo queda en S/ 0.00 y no se puede emitir."
            : "Para quitar la elección y volver a editar la línea, toca la opción marcada."}
        </p>
      )}

      {items.some((item) => isGiftTaxType(item.taxType)) && (
        <div className="space-y-2">
          {items.map((item, index) =>
            isGiftTaxType(item.taxType) ? (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: lines have no id; order is stable here
                key={index}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
              >
                <span className="text-xs">
                  <span className="font-medium">{item.productName}</span> × {item.quantity}
                </span>

                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <label htmlFor={`gift-normal-price-${index}`}>
                    {nuevoRus ? "Precio normal c/u" : "Precio normal c/u (con IGV)"}
                  </label>
                  <NormalPriceInput index={index} taxRegime={taxRegime} />
                </span>

                {getGiftLineValue(item) > 0 ? (
                  <span className="w-full text-xs text-muted-foreground">
                    Valor referencial {soles(getGiftLineValue(item))}
                    {nuevoRus ? "" : " sin IGV"} · se cobra S/ 0.00
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
