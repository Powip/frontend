import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useOlvaStandardSizes } from "@/features/olva/olva-catalog/hooks/use-olva-standard-sizes";
import type {
  BulkCreateOlvaShipmentsFormInput,
  BulkCreateOlvaShipmentsFormValues,
} from "@/features/olva/olva-shipment/schemas/olva-bulk-shipments.schema";
import { buildSendToOlvaSchema } from "../utils/build-send-to-olva-schema";

/**
 * One form for the whole lot: `items` has a row per order, validated by the schema the data layer
 * exposes plus the weight-fits-the-size rule. Three generics because the schema turns text inputs
 * into numbers.
 */
export function useSendToOlvaForm(defaultValues: BulkCreateOlvaShipmentsFormInput) {
  const sizes = useOlvaStandardSizes().data;
  const schema = useMemo(() => buildSendToOlvaSchema(sizes ?? []), [sizes]);
  const form = useForm<
    BulkCreateOlvaShipmentsFormInput,
    unknown,
    BulkCreateOlvaShipmentsFormValues
  >({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onTouched",
  });

  const { fields, remove } = useFieldArray({ control: form.control, name: "items" });

  /** Drops the rows whose order is done, keeping what the user typed in the others. */
  const keepOnly = useCallback(
    (itemKeys: readonly string[]) => {
      const keep = new Set(itemKeys);
      const drop = form
        .getValues("items")
        .flatMap((item, index) => (keep.has(item.itemKey) ? [] : [index]));

      if (drop.length > 0) remove(drop);
    },
    [form, remove],
  );

  return { form, fields, keepOnly };
}
