"use client";

import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useOlvaArticleCategories } from "@/features/olva/olva-catalog/hooks/use-olva-article-categories";
import { useOlvaStandardSizes } from "@/features/olva/olva-catalog/hooks/use-olva-standard-sizes";
import type { OlvaHeadquarter } from "@/features/olva/olva-catalog/models/olva-headquarter";
import type { OlvaStandardSize } from "@/features/olva/olva-catalog/models/olva-standard-size";
import type { SendToOlvaFormValues } from "./fields/olva-form-types";
import { OlvaSelectField } from "./fields/olva-select-field";
import { OlvaTextField } from "./fields/olva-text-field";

interface OlvaPackageFieldsProps {
  index: number;
  headquarter: OlvaHeadquarter | undefined;
}

/** Normalizes "1,5" / "1.5" typed by the user: digits and a single decimal point. */
const toDecimalText = (value: string) => {
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole, ...decimals] = cleaned.split(".");

  return decimals.length > 0 ? `${whole}.${decimals.join("")}` : whole;
};

/** "M · 40×30×20 cm · hasta 5 kg": what the user needs to pick a size without a tape measure. */
const formatOlvaSizeLabel = (size: OlvaStandardSize) => {
  const { lengthCm, widthCm, heightCm } = size;
  const measures =
    lengthCm !== null && widthCm !== null && heightCm !== null
      ? `${lengthCm}×${widthCm}×${heightCm} cm · `
      : "";

  return `${size.label} · ${measures}hasta ${size.maxWeightKg} kg`;
};

/** What goes in the box: weight, size, declared value and content. */
export function OlvaPackageFields({ index, headquarter }: OlvaPackageFieldsProps) {
  const { control, trigger } = useFormContext<SendToOlvaFormValues>();
  const sizes = useOlvaStandardSizes();
  const categories = useOlvaArticleCategories();
  const base = `items.${index}.package` as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <OlvaTextField
        name={`${base}.weightKg`}
        label="Peso (kg)"
        inputMode="decimal"
        transform={toDecimalText}
      />
      <OlvaSelectField
        name={`${base}.sizeId`}
        label="Tamaño"
        emptyLabel="Automático (según peso)"
        placeholder="Automático (según peso)"
        options={(sizes.data ?? []).map((size) => ({
          value: size.id,
          label: formatOlvaSizeLabel(size),
        }))}
        // The weight has to fit the size, so changing the size re-checks the weight
        onValueChange={() => void trigger(`${base}.weightKg`)}
      />
      <OlvaTextField
        name={`${base}.declaredValue`}
        label="Valor declarado (S/)"
        inputMode="decimal"
        transform={toDecimalText}
      />
      <OlvaSelectField
        name={`${base}.articleId`}
        label="Categoría del artículo"
        emptyLabel="Sin categoría"
        placeholder="Seleccionar"
        hint="Si no eliges una categoría, Olva usa «Documentos» por defecto. Esa categoría solo es válida con la talla Sobre (hasta 0.2 kg): con una caja, Olva rechaza el envío. Para cajas elige otra categoría."
        options={(categories.data ?? []).map((category) => ({
          value: String(category.id),
          label: category.name,
        }))}
      />
      <div className="sm:col-span-2 lg:col-span-3">
        <OlvaTextField name={`${base}.description`} label="Contenido" />
      </div>
      {headquarter?.showInsuranceOption ? (
        <FormField
          control={control}
          name={`${base}.insuranceAccepted`}
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 self-end pb-2">
              <Switch checked={field.value === true} onCheckedChange={field.onChange} />
              <FormLabel>Asegurar envío</FormLabel>
            </FormItem>
          )}
        />
      ) : null}
    </div>
  );
}
