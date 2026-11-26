"use client";

import { useFormContext, useWatch } from "react-hook-form";

import type { CreateSunatDocumentsFormValues } from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import {
  describeLinesWithoutValue,
  findLinesWithoutValue,
} from "@/features/sunat/sunat-document/utils/find-lines-without-value";
import { isGiftCandidate, isGiftTaxType } from "@/features/sunat/sunat-document/utils/gift-lines";

/**
 * Why the document cannot be issued yet. It points to the gift panel above
 * only for the lines that panel actually handles.
 */
export function ZeroValueLinesAlert() {
  const { control } = useFormContext<CreateSunatDocumentsFormValues>();
  const items = useWatch({ control, name: "documents.0.items" }) ?? [];
  const lines = findLinesWithoutValue(items);

  if (lines.length === 0) {
    return null;
  }

  const blocked = lines.map((line) => items[line.lineNumber - 1]);
  const toChoose = blocked.some((item) => isGiftCandidate(item) && !isGiftTaxType(item.taxType));
  const toPrice = blocked.some((item) => isGiftTaxType(item.taxType));

  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-900 dark:bg-red-950/40"
    >
      <span className="font-semibold">
        No se puede emitir: {describeLinesWithoutValue(lines)}{" "}
        {lines.length === 1 ? "queda" : "quedan"} en S/ 0.00.{" "}
      </span>
      SUNAT rechaza el comprobante completo cuando una línea no tiene valor (error 3105) y el número
      se pierde. Ponle su valor a esa línea o quítala con el ícono de papelera.
      {toChoose && " Si es un regalo, elige arriba cómo mandarlo."}
      {toPrice && " Al regalo le falta su precio normal: escríbelo arriba."}
    </div>
  );
}
